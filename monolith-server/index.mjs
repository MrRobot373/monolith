// MONOLITH sidecar: scheduled tasks (Cowork "Scheduled").
// Dependency-free ESM. Embedded by native/serve-ui.mjs (and, in the Docker
// path, by a small standalone server) under /__monolith/schedules*.
//
// A schedule fires by creating an opencode session through openwork-server's
// workspace-mounted proxy and sending the prompt with prompt_async:
//   POST {openworkUrl}/workspace/{wsId}/opencode/session?directory={dir}
//   POST {openworkUrl}/workspace/{wsId}/opencode/session/{id}/prompt_async
// The engine's seeded default model/agent apply (no model pinned here).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const MAX_RUNS_KEPT = 20;
const TICK_MS = 30_000;

function nowMs() {
  return Date.now();
}

/** Compute the next fire time (ms epoch) for a cadence, strictly after `after`. */
export function computeNextRun(cadence, after = nowMs()) {
  if (!cadence || typeof cadence !== "object") return null;
  if (cadence.type === "every") {
    const minutes = Math.max(1, Number(cadence.minutes) || 0);
    return after + minutes * 60_000;
  }
  const [hh, mm] = String(cadence.time || "09:00")
    .split(":")
    .map((value) => Number(value) || 0);
  const next = new Date(after);
  next.setSeconds(0, 0);
  next.setHours(hh, mm, 0, 0);
  if (cadence.type === "daily") {
    if (next.getTime() <= after) next.setDate(next.getDate() + 1);
    return next.getTime();
  }
  if (cadence.type === "weekly") {
    const day = Math.min(6, Math.max(0, Number(cadence.day) || 0));
    while (next.getDay() !== day || next.getTime() <= after) {
      next.setDate(next.getDate() + 1);
      next.setHours(hh, mm, 0, 0);
    }
    return next.getTime();
  }
  return null;
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req, maxBytes = 256 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += String(chunk);
      if (Buffer.byteLength(body, "utf8") > maxBytes) {
        reject(new Error("request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body.trim() ? JSON.parse(body) : {});
      } catch {
        reject(new Error("invalid json"));
      }
    });
    req.on("error", reject);
  });
}

export function createMonolithScheduler(options) {
  const dataDir = options.dataDir;
  const openworkUrl = String(options.openworkUrl || "http://127.0.0.1:8787").replace(/\/+$/, "");
  const token = options.token || "";
  const hostToken = options.hostToken || "";
  const log = options.log || ((...args) => console.log("[monolith-scheduler]", ...args));
  const storePath = path.join(dataDir, "schedules.json");

  fs.mkdirSync(dataDir, { recursive: true });

  function loadStore() {
    try {
      const parsed = JSON.parse(fs.readFileSync(storePath, "utf8"));
      return Array.isArray(parsed?.schedules) ? parsed : { schedules: [] };
    } catch {
      return { schedules: [] };
    }
  }

  function saveStore(store) {
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2) + "\n");
  }

  function authHeaders() {
    const headers = { "content-type": "application/json" };
    if (token) headers.authorization = `Bearer ${token}`;
    if (hostToken) headers["x-openwork-host-token"] = hostToken;
    return headers;
  }

  async function engineFetch(pathname, init = {}) {
    const response = await fetch(openworkUrl + pathname, {
      ...init,
      headers: { ...authHeaders(), ...(init.headers || {}) },
      signal: AbortSignal.timeout(30_000),
    });
    const text = await response.text().catch(() => "");
    if (!response.ok) {
      throw new Error(`engine ${pathname} -> ${response.status} ${text.slice(0, 200)}`);
    }
    // Some engine endpoints (e.g. prompt_async) reply with an empty body.
    return text.trim() ? JSON.parse(text) : null;
  }

  async function fire(schedule) {
    const wsId = encodeURIComponent(schedule.workspaceId);
    const dirQuery = schedule.directory
      ? `?directory=${encodeURIComponent(schedule.directory)}`
      : "";
    const session = await engineFetch(`/workspace/${wsId}/opencode/session${dirQuery}`, {
      method: "POST",
      body: JSON.stringify({ title: `⏰ ${schedule.name}` }),
    });
    const sessionId = session?.id || session?.session?.id;
    if (!sessionId) throw new Error("session create returned no id");
    await engineFetch(
      `/workspace/${wsId}/opencode/session/${encodeURIComponent(sessionId)}/prompt_async${dirQuery}`,
      {
        method: "POST",
        body: JSON.stringify({ parts: [{ type: "text", text: schedule.prompt }] }),
      },
    );
    return sessionId;
  }

  async function runSchedule(store, schedule, { manual = false } = {}) {
    const run = { at: nowMs(), ok: false, manual };
    try {
      run.sessionId = await fire(schedule);
      run.ok = true;
      log(`fired "${schedule.name}" -> session ${run.sessionId}`);
    } catch (error) {
      run.error = error instanceof Error ? error.message : String(error);
      log(`FAILED "${schedule.name}": ${run.error}`);
    }
    schedule.lastRunAt = run.at;
    schedule.runs = [run, ...(schedule.runs || [])].slice(0, MAX_RUNS_KEPT);
    schedule.nextRunAt = schedule.enabled ? computeNextRun(schedule.cadence) : null;
    saveStore(store);
    return run;
  }

  let ticking = false;
  async function tick() {
    if (ticking) return;
    ticking = true;
    try {
      const store = loadStore();
      const due = store.schedules.filter(
        (schedule) => schedule.enabled && schedule.nextRunAt && schedule.nextRunAt <= nowMs(),
      );
      for (const schedule of due) {
        await runSchedule(store, schedule);
      }
    } catch (error) {
      log("tick failed:", error instanceof Error ? error.message : String(error));
    } finally {
      ticking = false;
    }
  }

  const interval = setInterval(() => void tick(), TICK_MS);
  interval.unref?.();

  function normalizeInput(payload, existing = {}) {
    const cadence = payload.cadence && typeof payload.cadence === "object" ? payload.cadence : existing.cadence;
    return {
      ...existing,
      name: String(payload.name ?? existing.name ?? "").trim() || "Scheduled task",
      prompt: String(payload.prompt ?? existing.prompt ?? "").trim(),
      workspaceId: String(payload.workspaceId ?? existing.workspaceId ?? "").trim(),
      directory: String(payload.directory ?? existing.directory ?? "").trim(),
      cadence,
      enabled: payload.enabled ?? existing.enabled ?? true,
    };
  }

  /** Returns true when the request was handled. */
  function handle(req, res, urlPath) {
    if (!urlPath.startsWith("/__monolith/schedules")) return false;
    const rest = urlPath.slice("/__monolith/schedules".length).replace(/^\//, "");
    const [id, action] = rest.split("/");

    const respond = async () => {
      const store = loadStore();

      if (req.method === "GET" && !id) {
        sendJson(res, 200, { schedules: store.schedules });
        return;
      }

      if (req.method === "POST" && !id) {
        const payload = await readJsonBody(req);
        const schedule = normalizeInput(payload);
        if (!schedule.prompt || !schedule.workspaceId || !schedule.cadence) {
          sendJson(res, 400, { ok: false, error: "prompt, workspaceId, and cadence are required" });
          return;
        }
        schedule.id = crypto.randomBytes(8).toString("hex");
        schedule.createdAt = nowMs();
        schedule.runs = [];
        schedule.nextRunAt = schedule.enabled ? computeNextRun(schedule.cadence) : null;
        store.schedules.push(schedule);
        saveStore(store);
        sendJson(res, 201, { ok: true, schedule });
        return;
      }

      const schedule = store.schedules.find((entry) => entry.id === id);
      if (!schedule) {
        sendJson(res, 404, { ok: false, error: "schedule not found" });
        return;
      }

      if (req.method === "POST" && action === "run") {
        const run = await runSchedule(store, schedule, { manual: true });
        sendJson(res, run.ok ? 200 : 502, { ok: run.ok, run, schedule });
        return;
      }

      if (req.method === "PATCH") {
        const payload = await readJsonBody(req);
        const updated = normalizeInput(payload, schedule);
        Object.assign(schedule, updated);
        schedule.nextRunAt = schedule.enabled ? computeNextRun(schedule.cadence) : null;
        saveStore(store);
        sendJson(res, 200, { ok: true, schedule });
        return;
      }

      if (req.method === "DELETE") {
        store.schedules = store.schedules.filter((entry) => entry.id !== id);
        saveStore(store);
        sendJson(res, 200, { ok: true });
        return;
      }

      sendJson(res, 405, { ok: false, error: "method not allowed" });
    };

    respond().catch((error) => {
      sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
    });
    return true;
  }

  return { handle, tick };
}

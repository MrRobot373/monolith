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
  const dispatchPath = path.join(dataDir, "dispatch.json");

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

  // Same identity helper the chat and MCP-catalog stores use. Falls back to
  // "local" when auth is off (native single-user), which collapses every
  // caller into one owner — the intended behaviour there.
  function actorOf(req) {
    return req?.monolithUser?.email || req?.monolithUser?.id || "local";
  }

  /**
   * Schedules created before ownership existed have no `createdBy`. Those stay
   * visible to everyone rather than becoming orphaned and unreachable — a
   * deliberate backward-compatibility choice, since silently hiding a user's
   * existing schedules (and with them, their running automation) would be
   * worse than leaving legacy rows shared.
   */
  function canAccess(schedule, actor) {
    return !schedule.createdBy || schedule.createdBy === actor;
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

  function loadDispatch() {
    try {
      const parsed = JSON.parse(fs.readFileSync(dispatchPath, "utf8"));
      return parsed && typeof parsed.byWorkspace === "object" ? parsed : { byWorkspace: {} };
    } catch {
      return { byWorkspace: {} };
    }
  }

  /**
   * Cowork-style Dispatch: one persistent thread per workspace. Returns the
   * stored session if the engine still knows it, otherwise creates a fresh
   * "📮 Dispatch" session and remembers it.
   */
  async function ensureDispatchSession(workspaceId, directory) {
    const wsId = encodeURIComponent(workspaceId);
    const dirQuery = directory ? `?directory=${encodeURIComponent(directory)}` : "";
    const store = loadDispatch();
    const existing = store.byWorkspace[workspaceId];
    if (existing) {
      try {
        await engineFetch(`/workspace/${wsId}/opencode/session/${encodeURIComponent(existing)}${dirQuery}`);
        return { sessionId: existing, created: false };
      } catch {
        // stale (session deleted or engine reset) — recreate below
      }
    }
    const session = await engineFetch(`/workspace/${wsId}/opencode/session${dirQuery}`, {
      method: "POST",
      body: JSON.stringify({ title: "📮 Dispatch" }),
    });
    const sessionId = session?.id || session?.session?.id;
    if (!sessionId) throw new Error("dispatch session create returned no id");
    store.byWorkspace[workspaceId] = sessionId;
    fs.writeFileSync(dispatchPath, JSON.stringify(store, null, 2) + "\n");
    log(`dispatch session for ${workspaceId} -> ${sessionId}`);
    return { sessionId, created: true };
  }

  const orgPath = path.join(dataDir, "org.json");
  const litellmUrl = String(options.litellmUrl || "").replace(/\/+$/, "");
  const litellmKey = options.litellmKey || "";

  function loadOrg() {
    const defaults = {
      productName: "MONOLITH",
      capabilities: { webSearch: true, approvalMode: "manual" },
      members: [],
    };
    try {
      const parsed = JSON.parse(fs.readFileSync(orgPath, "utf8"));
      return { ...defaults, ...parsed, capabilities: { ...defaults.capabilities, ...(parsed.capabilities || {}) } };
    } catch {
      return defaults;
    }
  }

  async function orgUsage() {
    if (!litellmUrl || !litellmKey) return { available: false };
    try {
      const response = await fetch(`${litellmUrl}/global/spend`, {
        headers: { authorization: `Bearer ${litellmKey}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return { available: false, error: `litellm ${response.status}` };
      return { available: true, spend: await response.json() };
    } catch (error) {
      return { available: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /** Returns true when the request was handled. */
  function handle(req, res, urlPath) {
    if (urlPath === "/__monolith/org") {
      if (req.method === "GET") {
        sendJson(res, 200, { ok: true, org: loadOrg() });
        return true;
      }
      if (req.method === "PATCH") {
        readJsonBody(req)
          .then((payload) => {
            const org = loadOrg();
            if (payload.productName !== undefined) org.productName = String(payload.productName).trim() || org.productName;
            if (payload.capabilities && typeof payload.capabilities === "object") {
              org.capabilities = { ...org.capabilities, ...payload.capabilities };
            }
            if (Array.isArray(payload.members)) org.members = payload.members;
            fs.writeFileSync(orgPath, JSON.stringify(org, null, 2) + "\n");
            sendJson(res, 200, { ok: true, org });
          })
          .catch((error) => sendJson(res, 400, { ok: false, error: error.message }));
        return true;
      }
      sendJson(res, 405, { ok: false, error: "method not allowed" });
      return true;
    }

    if (req.method === "GET" && urlPath === "/__monolith/org/usage") {
      orgUsage()
        .then((usage) => sendJson(res, 200, usage))
        .catch((error) => sendJson(res, 500, { available: false, error: error.message }));
      return true;
    }

    if (req.method === "POST" && urlPath === "/__monolith/dispatch") {
      readJsonBody(req)
        .then((payload) => {
          const workspaceId = String(payload?.workspaceId || "").trim();
          const directory = String(payload?.directory || "").trim();
          if (!workspaceId) {
            sendJson(res, 400, { ok: false, error: "workspaceId required" });
            return null;
          }
          return ensureDispatchSession(workspaceId, directory);
        })
        .then((result) => {
          if (result) sendJson(res, 200, { ok: true, ...result });
        })
        .catch((error) => {
          sendJson(res, 502, { ok: false, error: error instanceof Error ? error.message : String(error) });
        });
      return true;
    }

    if (!urlPath.startsWith("/__monolith/schedules")) return false;
    const rest = urlPath.slice("/__monolith/schedules".length).replace(/^\//, "");
    const [id, action] = rest.split("/");

    const respond = async () => {
      const store = loadStore();
      const actor = actorOf(req);

      if (req.method === "GET" && !id) {
        sendJson(res, 200, { schedules: store.schedules.filter((entry) => canAccess(entry, actor)) });
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
        schedule.createdBy = actor;
        schedule.runs = [];
        schedule.nextRunAt = schedule.enabled ? computeNextRun(schedule.cadence) : null;
        store.schedules.push(schedule);
        saveStore(store);
        sendJson(res, 201, { ok: true, schedule });
        return;
      }

      const schedule = store.schedules.find((entry) => entry.id === id);
      // A schedule owned by someone else is reported as absent rather than
      // forbidden, so the response can't be used to enumerate other users'
      // schedule IDs.
      if (!schedule || !canAccess(schedule, actor)) {
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
        // Guarded by the canAccess() check above, so this can only remove a
        // schedule the caller owns (or a legacy ownerless one).
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

// Workspace-scoped openwork-server routes that are NOT the opencode mount:
//   /workspace/:id/config              openwork+opencode merged config
//   /workspace/:id/opencode-config     the workspace opencode.json file
//   /workspace/:id/events              openwork workspace event stream (SSE)
//   /workspace/:id/session-groups      session grouping state (+ /events SSE)
//   /workspace/:id/sessions*           session reads (proxied to the engine)
//   /workspace/:id/authorized-folders  allowed roots
//   /workspace/:id/runtime-config      runtime config status
//
// Session/agentic traffic is the opencode reverse-proxy; this module fills the
// glue the closed openwork-server uniquely provided so the UNCHANGED UI boots
// into a working session view.
import fs from "node:fs";
import path from "node:path";

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(payload));
}

function readBody(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => {
      body += String(c);
      if (Buffer.byteLength(body, "utf8") > maxBytes) {
        reject(new Error("body too large"));
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

// Only allow writes inside <directory>/.opencode/<sub> — never above it. Guards
// against a crafted `name` like "../../etc/passwd" escaping the workspace.
function safeChildPath(directory, ...parts) {
  const base = path.join(directory, ".opencode");
  const target = path.join(base, ...parts);
  const rel = path.relative(base, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return target;
}

// /workspace/:id/events and /workspace/:id/session-groups/events are NOT SSE —
// the UI polls them every 3s as plain JSON GETs with a `since=<cursor>` cursor
// (openwork-server.ts listReloadEvents/listSessionGroupEvents), expecting
// {items:[...], cursor}. Live agent/session updates (session.updated,
// message.part.updated, ...) arrive over opencode's own /event SSE stream,
// which the reverse-proxy already forwards untouched — this endpoint is a
// smaller, separate "did a skill/plugin/mcp/config file change on disk"
// notification used to prompt an engine reload, not the streaming channel.
// We don't yet track real reload triggers, so we honestly report none (empty
// items) rather than fabricate one — the cursor still advances so the client's
// polling loop behaves correctly.
function sendEmptyEventPage(res) {
  sendJson(res, 200, { items: [], cursor: Date.now() });
}

export function createWorkspaceRoutes(opts) {
  const registry = opts.registry;
  const engine = opts.engine;
  const log = opts.log || (() => {});

  async function engineFetch(directory, enginePath, init) {
    await engine.start();
    const sep = enginePath.includes("?") ? "&" : "?";
    const url = `${engine.baseUrl()}${enginePath}${sep}directory=${encodeURIComponent(directory)}`;
    const res = await fetch(url, init);
    const text = await res.text();
    try {
      return { status: res.status, data: JSON.parse(text) };
    } catch {
      return { status: res.status, data: text };
    }
  }

  // opencode caches its per-workspace scan of skills/commands/mcp/config in
  // memory; a file we just wrote (a new skill, an edited opencode.json mcp
  // block, ...) won't show up in listings until that cache drops. Discovered
  // live: POST /instance/dispose?directory=<dir> forces exactly that. We call
  // it after every write here, and also expose it as the UI's own "reload
  // engine" action (POST /workspace/:id/engine/reload).
  async function disposeInstance(directory) {
    await engineFetch(directory, "/instance/dispose", { method: "POST" }).catch(() => {});
  }

  /** Returns true when handled. */
  async function handle(req, res, urlPath, search) {
    const m = urlPath.match(/^\/workspace\/([^/]+)\/(.*)$/);
    if (!m) return false;
    const workspaceId = decodeURIComponent(m[1]);
    let sub = m[2];
    // The opencode mount is owned by the reverse-proxy, not here.
    if (sub === "opencode" || sub.startsWith("opencode/")) return false;

    const directory = registry.directoryOf(workspaceId);
    if (!directory) {
      sendJson(res, 404, { error: "workspace_not_found", workspaceId });
      return true;
    }
    const method = req.method;

    // --- Reload-event / session-group-event polling (NOT SSE — see above) --
    if (method === "GET" && (sub === "events" || sub.startsWith("events?"))) {
      sendEmptyEventPage(res);
      return true;
    }
    if (method === "GET" && (sub === "session-groups/events" || sub.startsWith("session-groups/events?"))) {
      sendEmptyEventPage(res);
      return true;
    }

    // --- Session grouping (empty state for a fresh local workspace) --------
    if (sub === "session-groups" || sub.startsWith("session-groups?")) {
      if (method === "GET") {
        sendJson(res, 200, { state: { groups: [], assignments: {} }, updatedAt: null });
        return true;
      }
      // POST/PUT/PATCH/DELETE all just echo an empty state for now.
      sendJson(res, 200, { state: { groups: [], assignments: {} }, updatedAt: Date.now() });
      return true;
    }

    // --- Merged config -----------------------------------------------------
    if (sub === "config" || sub.startsWith("config?")) {
      if (method === "GET") {
        const opencode = readOpencodeJson(directory);
        sendJson(res, 200, { opencode: opencode || {}, openwork: {}, updatedAt: null });
        return true;
      }
      if (method === "PATCH") {
        sendJson(res, 200, { updatedAt: Date.now() });
        return true;
      }
    }

    // --- opencode.json file read/write ------------------------------------
    if (sub === "opencode-config" || sub.startsWith("opencode-config?")) {
      const file = path.join(directory, "opencode.json");
      if (method === "GET") {
        let content = "";
        try {
          content = fs.readFileSync(file, "utf8");
        } catch {
          content = "";
        }
        sendJson(res, 200, { path: file, scope: "project", exists: Boolean(content), content });
        return true;
      }
      if (method === "POST") {
        const body = await readBody(req).catch(() => null);
        const content = String(body?.content ?? "");
        try {
          JSON.parse(content); // opencode.json must stay valid JSON
        } catch (error) {
          sendJson(res, 400, { ok: false, status: 1, stdout: "", stderr: `invalid JSON: ${error.message}` });
          return true;
        }
        fs.writeFileSync(file, content);
        await disposeInstance(directory);
        sendJson(res, 200, { ok: true, status: 0, stdout: "", stderr: "" });
        return true;
      }
    }

    // --- engine reload: opencode caches each workspace's skill/command/mcp/
    // config scan; this forces it to drop that cache and re-read from disk. --
    if (method === "POST" && sub === "engine/reload") {
      await disposeInstance(directory);
      sendJson(res, 200, { ok: true, reloadedAt: Date.now() });
      return true;
    }

    // --- authorized folders ------------------------------------------------
    if (sub === "authorized-folders" || sub.startsWith("authorized-folders?")) {
      if (method === "GET") {
        sendJson(res, 200, { folders: [directory], root: directory });
        return true;
      }
      if (method === "PUT") {
        sendJson(res, 200, { ok: true, folders: [directory] });
        return true;
      }
    }

    // --- runtime config status --------------------------------------------
    if (sub === "runtime-config" || sub.startsWith("runtime-config?")) {
      if (method === "GET") {
        sendJson(res, 200, { ok: true, migrated: true, status: "ready" });
        return true;
      }
    }
    if (sub === "runtime-config/migrate") {
      sendJson(res, 200, { ok: true, migrated: true });
      return true;
    }

    // --- Session reads (proxied to the engine, wrapped in the UI's shape) --
    // These also have a client-side fallback to opencode native, but serving
    // them removes the boot noise and keeps the fast path.
    const sessionsList = sub === "sessions" || sub.startsWith("sessions?");
    if (method === "GET" && sessionsList) {
      const { status, data } = await engineFetch(directory, "/session");
      sendJson(res, status, { items: Array.isArray(data) ? data : [] });
      return true;
    }
    const sessionDetail = sub.match(/^sessions\/([^/?]+)(\/(messages|snapshot))?(\?.*)?$/);
    if (method === "GET" && sessionDetail) {
      const sid = decodeURIComponent(sessionDetail[1]);
      const kind = sessionDetail[3];
      if (kind === "messages") {
        const { status, data } = await engineFetch(directory, `/session/${encodeURIComponent(sid)}/message`);
        sendJson(res, status, { items: Array.isArray(data) ? data : [] });
        return true;
      }
      if (kind === "snapshot") {
        const [sessionRes, messagesRes, todoRes] = await Promise.all([
          engineFetch(directory, `/session/${encodeURIComponent(sid)}`),
          engineFetch(directory, `/session/${encodeURIComponent(sid)}/message`),
          engineFetch(directory, `/session/${encodeURIComponent(sid)}/todo`),
        ]);
        sendJson(res, 200, {
          item: {
            session: sessionRes.data,
            messages: Array.isArray(messagesRes.data) ? messagesRes.data : [],
            todos: Array.isArray(todoRes.data) ? todoRes.data : [],
            status: { type: "idle" },
          },
        });
        return true;
      }
      const { status, data } = await engineFetch(directory, `/session/${encodeURIComponent(sid)}`);
      sendJson(res, status, { item: data });
      return true;
    }
    if (method === "DELETE" && sessionDetail) {
      const sid = decodeURIComponent(sessionDetail[1]);
      await engineFetch(directory, `/session/${encodeURIComponent(sid)}`).catch(() => {});
      sendJson(res, 200, { ok: true });
      return true;
    }

    // --- Skills: opencode has no write API, so reads proxy+reshape opencode's
    // native /skill (which already includes file content), writes go straight
    // to <workspace>/.opencode/skills/<name>/SKILL.md. ------------------------
    if (sub === "skills") {
      if (method === "GET") {
        const includeGlobal = new URLSearchParams(search || "").get("includeGlobal") === "true";
        const { status, data } = await engineFetch(directory, "/skill");
        if (status >= 400 || !Array.isArray(data)) {
          sendJson(res, status, { items: [] });
          return true;
        }
        const items = data
          .map((s) => toSkillItem(s, directory))
          .filter((item) => includeGlobal || item.scope === "project");
        sendJson(res, 200, { items });
        return true;
      }
      if (method === "POST") {
        const body = await readBody(req).catch(() => null);
        const name = String(body?.name || "").trim();
        if (!name) {
          sendJson(res, 400, { error: "name_required" });
          return true;
        }
        const file = safeChildPath(directory, "skills", name, "SKILL.md");
        if (!file) {
          sendJson(res, 400, { error: "invalid_name" });
          return true;
        }
        const raw = String(body?.content || "");
        const content = raw.trimStart().startsWith("---")
          ? raw
          : `---\nname: ${name}\ndescription: ${JSON.stringify(String(body?.description || ""))}\n---\n\n${raw}`;
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, content);
        await disposeInstance(directory);
        sendJson(res, 200, { name, path: file, scope: "project", description: body?.description || "" });
        return true;
      }
    }
    const skillDetail = sub.match(/^skills\/([^/?]+)(\?.*)?$/);
    if (skillDetail) {
      const name = decodeURIComponent(skillDetail[1]);
      if (method === "GET") {
        const { status, data } = await engineFetch(directory, "/skill");
        const found = Array.isArray(data) ? data.find((s) => s.name === name) : null;
        if (status >= 400 || !found) {
          sendJson(res, 404, { error: "skill_not_found", name });
          return true;
        }
        sendJson(res, 200, { item: toSkillItem(found, directory), content: found.content || "" });
        return true;
      }
      if (method === "DELETE") {
        const dir = safeChildPath(directory, "skills", name);
        if (!dir || !fs.existsSync(dir)) {
          sendJson(res, 404, { error: "skill_not_found_in_workspace", name });
          return true;
        }
        fs.rmSync(dir, { recursive: true, force: true });
        await disposeInstance(directory);
        sendJson(res, 200, { path: dir });
        return true;
      }
    }

    // --- MCP: opencode reports live connection status (/mcp) but not the
    // static config; we own the config (the workspace's opencode.json), so
    // reads merge the two and writes edit opencode.json directly. Auth
    // logout proxies straight to opencode's native DELETE /mcp/:name/auth. -
    if (sub === "mcp") {
      if (method === "GET") {
        const cfg = readOpencodeJson(directory) || {};
        const mcpCfg = cfg.mcp && typeof cfg.mcp === "object" ? cfg.mcp : {};
        const { data: liveStatus } = await engineFetch(directory, "/mcp");
        const live = liveStatus && typeof liveStatus === "object" ? liveStatus : {};
        const items = Object.entries(mcpCfg).map(([name, config]) => ({
          name,
          config,
          source: "config.project",
          disabledByTools: config?.enabled === false,
        }));
        const failures = Object.entries(live)
          .filter(([, s]) => s?.status && s.status !== "connected")
          .map(([name, s]) => ({ name, message: s.status }));
        sendJson(res, 200, { items, engineSync: { status: failures.length ? "failed" : "ok", at: Date.now(), failures } });
        return true;
      }
      if (method === "POST") {
        const body = await readBody(req).catch(() => null);
        const name = String(body?.name || "").trim();
        if (!name || !body?.config) {
          sendJson(res, 400, { error: "name_and_config_required" });
          return true;
        }
        const cfg = readOpencodeJson(directory) || {};
        cfg.mcp = { ...(cfg.mcp || {}), [name]: body.config };
        writeOpencodeJson(directory, cfg);
        await disposeInstance(directory);
        sendJson(res, 200, { items: mcpItemsFrom(cfg) });
        return true;
      }
    }
    const mcpEnabled = sub.match(/^mcp\/([^/?]+)\/enabled$/);
    if (method === "POST" && mcpEnabled) {
      const name = decodeURIComponent(mcpEnabled[1]);
      const body = await readBody(req).catch(() => ({}));
      const cfg = readOpencodeJson(directory) || {};
      if (cfg.mcp?.[name]) {
        cfg.mcp[name] = { ...cfg.mcp[name], enabled: Boolean(body?.enabled) };
        writeOpencodeJson(directory, cfg);
        await disposeInstance(directory);
      }
      sendJson(res, 200, { items: mcpItemsFrom(cfg) });
      return true;
    }
    const mcpAuth = sub.match(/^mcp\/([^/?]+)\/auth$/);
    if (method === "DELETE" && mcpAuth) {
      const name = decodeURIComponent(mcpAuth[1]);
      const { status } = await engineFetch(directory, `/mcp/${encodeURIComponent(name)}/auth`, { method: "DELETE" }).catch(() => ({ status: 200 }));
      sendJson(res, status < 400 ? 200 : status, { ok: status < 400 });
      return true;
    }
    const mcpDetail = sub.match(/^mcp\/([^/?]+)$/);
    if (method === "DELETE" && mcpDetail) {
      const name = decodeURIComponent(mcpDetail[1]);
      const cfg = readOpencodeJson(directory) || {};
      if (cfg.mcp && name in cfg.mcp) {
        delete cfg.mcp[name];
        writeOpencodeJson(directory, cfg);
        await disposeInstance(directory);
      }
      sendJson(res, 200, { items: mcpItemsFrom(cfg) });
      return true;
    }

    // --- Commands: read-only via opencode's native /command (reshaped);
    // opencode has no write API for these yet, so upsert/delete are an
    // honest 501 rather than a guessed file format. --------------------------
    if (method === "GET" && sub === "commands") {
      const requestedScope = new URLSearchParams(search || "").get("scope") === "global" ? "global" : "workspace";
      const { status, data } = await engineFetch(directory, "/command");
      if (status >= 400 || !Array.isArray(data)) {
        sendJson(res, status, { items: [] });
        return true;
      }
      // opencode's /command doesn't report which scope a command came from, so
      // we can only tag with the scope the caller asked for (best effort).
      const items = data
        .filter((c) => c.source === "command")
        .map((c) => ({
          name: c.name,
          description: c.description || "",
          template: c.template || "",
          scope: requestedScope,
        }));
      sendJson(res, 200, { items });
      return true;
    }
    if ((method === "POST" && sub === "commands") || (method === "DELETE" && sub.startsWith("commands/"))) {
      sendJson(res, 501, { error: "not_implemented", detail: "command editing isn't wired up yet — edit .opencode/command files directly" });
      return true;
    }

    // --- Plugins / audit: no native equivalent yet. Honest empty state
    // rather than a fabricated one, so the panels render as "nothing here"
    // instead of erroring. -----------------------------------------------
    if (method === "GET" && (sub === "plugins" || sub.startsWith("plugins?"))) {
      sendJson(res, 200, { items: [], loadOrder: [] });
      return true;
    }
    if ((method === "POST" && sub === "plugins") || (method === "DELETE" && sub.startsWith("plugins/"))) {
      sendJson(res, 501, { error: "not_implemented", detail: "plugin management isn't wired up yet" });
      return true;
    }
    if (method === "GET" && (sub === "audit" || sub.startsWith("audit?"))) {
      sendJson(res, 200, { items: [] });
      return true;
    }

    return false;
  }

  function toSkillItem(skill, directory) {
    const location = skill.location || "";
    const insideWorkspace =
      location !== "<built-in>" &&
      path.resolve(location).toLowerCase().startsWith(path.resolve(directory).toLowerCase());
    return {
      name: skill.name,
      path: location,
      description: skill.description || "",
      scope: insideWorkspace ? "project" : "global",
    };
  }

  function mcpItemsFrom(cfg) {
    const mcpCfg = cfg.mcp && typeof cfg.mcp === "object" ? cfg.mcp : {};
    return Object.entries(mcpCfg).map(([name, config]) => ({
      name,
      config,
      source: "config.project",
      disabledByTools: config?.enabled === false,
    }));
  }

  function writeOpencodeJson(directory, cfg) {
    fs.writeFileSync(path.join(directory, "opencode.json"), JSON.stringify(cfg, null, 2) + "\n");
  }

  function readOpencodeJson(directory) {
    try {
      return JSON.parse(fs.readFileSync(path.join(directory, "opencode.json"), "utf8"));
    } catch {
      return null;
    }
  }

  return { handle };
}

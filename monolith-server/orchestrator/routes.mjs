// Top-level openwork-server routes the UI hits at boot and for workspace
// lifecycle. Response shapes match the UI's client contract exactly
// (openwork/apps/app/src/app/lib/openwork-server.ts): health, runtime/versions,
// status, capabilities, and /workspaces*. Everything session/agentic is handled
// by the opencode reverse-proxy; this module owns the glue openwork uniquely had.
import crypto from "node:crypto";

const STARTED_AT = Date.now();
const ORCH_VERSION = "monolith-0.1.0";

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

// registry publicView → the UI's WorkspaceWire shape.
function toWire(ws) {
  return {
    id: ws.id,
    name: ws.name,
    path: ws.path,
    preset: ws.preset || "starter",
    workspaceType: ws.workspaceType || "local",
    displayName: ws.displayName ?? null,
    directory: ws.path,
    baseUrl: null,
    opencode: null,
  };
}

export function createOrchestratorRoutes(opts) {
  const registry = opts.registry;
  const engine = opts.engine;
  const host = opts.host || "127.0.0.1";
  const port = opts.port || 0;
  const approval = opts.approval || "manual";

  function workspaceListPayload() {
    const items = registry.list().map(toWire);
    return { items, workspaces: items, activeId: registry.activeId() };
  }

  function capabilities() {
    return {
      skills: { read: true, write: true, source: "opencode" },
      plugins: { read: true, write: false },
      mcp: { read: true, write: true },
      commands: { read: true, write: false },
      config: { read: true, write: true },
      sandbox: { enabled: false, backend: "none" },
      proxy: { opencode: true },
    };
  }

  function diagnostics() {
    const activeId = registry.activeId();
    const active = activeId ? registry.get(activeId) : null;
    return {
      ok: true,
      version: ORCH_VERSION,
      uptimeMs: Date.now() - STARTED_AT,
      readOnly: false,
      approval: { mode: approval === "auto" ? "auto" : "manual", timeoutMs: 0 },
      corsOrigins: ["*"],
      workspaceCount: registry.list().length,
      activeWorkspaceId: activeId,
      selectedWorkspaceId: activeId,
      workspace: active ? toWire(registry.publicView(active)) : null,
      authorizedRoots: registry.list().map((w) => w.path),
      server: { host, port, configPath: null },
      tokenSource: { client: "none", host: "none" },
    };
  }

  function runtimeSnapshot() {
    return {
      ok: true,
      orchestrator: { version: ORCH_VERSION, startedAt: STARTED_AT },
      services: [
        { name: "openwork-server", enabled: true, running: true, targetVersion: ORCH_VERSION, actualVersion: ORCH_VERSION, upgradeAvailable: false },
        { name: "opencode", enabled: true, running: engine.ready(), targetVersion: "1.18.10", actualVersion: "1.18.10", upgradeAvailable: false },
      ],
    };
  }

  /** Returns true when handled. */
  async function handle(req, res, urlPath) {
    const method = req.method;

    if (method === "GET" && urlPath === "/health") {
      sendJson(res, 200, { ok: true, version: ORCH_VERSION, uptimeMs: Date.now() - STARTED_AT });
      return true;
    }
    if (method === "GET" && urlPath === "/runtime/versions") {
      sendJson(res, 200, runtimeSnapshot());
      return true;
    }
    if (method === "GET" && urlPath === "/status") {
      sendJson(res, 200, diagnostics());
      return true;
    }
    if (method === "GET" && urlPath === "/capabilities") {
      sendJson(res, 200, capabilities());
      return true;
    }
    if (method === "GET" && urlPath === "/workspaces") {
      sendJson(res, 200, workspaceListPayload());
      return true;
    }
    if (method === "POST" && urlPath === "/workspaces/local") {
      const body = await readBody(req);
      const folderPath = String(body.folderPath || "").trim();
      if (!folderPath) {
        sendJson(res, 400, { error: "folderPath_required" });
        return true;
      }
      registry.ensure(folderPath, { name: body.name, preset: body.preset, activate: true });
      sendJson(res, 200, workspaceListPayload());
      return true;
    }

    const activateMatch = urlPath.match(/^\/workspaces\/([^/]+)\/activate$/);
    if (method === "POST" && activateMatch) {
      const id = decodeURIComponent(activateMatch[1]);
      if (!registry.activate(id)) {
        sendJson(res, 404, { error: "workspace_not_found" });
        return true;
      }
      const ws = registry.get(id);
      sendJson(res, 200, { activeId: id, workspace: toWire(registry.publicView(ws)), persisted: true });
      return true;
    }

    const displayNameMatch = urlPath.match(/^\/workspaces\/([^/]+)\/display-name$/);
    if (method === "PATCH" && displayNameMatch) {
      const id = decodeURIComponent(displayNameMatch[1]);
      const body = await readBody(req);
      if (!registry.rename(id, body.displayName)) {
        sendJson(res, 404, { error: "workspace_not_found" });
        return true;
      }
      sendJson(res, 200, workspaceListPayload());
      return true;
    }

    const deleteMatch = urlPath.match(/^\/workspaces\/([^/]+)$/);
    if (method === "DELETE" && deleteMatch) {
      const id = decodeURIComponent(deleteMatch[1]);
      const deleted = registry.remove(id);
      sendJson(res, 200, {
        ok: true,
        deleted,
        persisted: true,
        activeId: registry.activeId(),
        items: registry.list().map(toWire),
        workspaces: registry.list().map(toWire),
      });
      return true;
    }

    return false;
  }

  return { handle };
}

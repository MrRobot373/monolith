// MONOLITH orchestrator — our own replacement for the closed openwork-server.
//
// Composes: engine supervisor (vendored opencode via bun) + workspace registry +
// opencode reverse-proxy + top-level openwork-server routes. Speaks the exact API
// the UNCHANGED OpenWork UI expects, so the UI can point VITE_OPENWORK_URL here
// and drop the prebuilt openwork.exe entirely.
//
// Run: node monolith-server/orchestrator.mjs
//   OPENCODE_DIR   path to vendored engine/opencode (default ../engine/opencode)
//   ORCH_PORT      listen port (default 8787)
//   DATA_DIR       registry/store dir (default ./.monolith-data)
//   OPENWORK_WORKSPACE  seed + activate this workspace on boot
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createEngine } from "./orchestrator/engine.mjs";
import { createWorkspaceRegistry } from "./orchestrator/workspaces.mjs";
import { createOpencodeProxy } from "./orchestrator/opencode-proxy.mjs";
import { createOrchestratorRoutes } from "./orchestrator/routes.mjs";
import { createWorkspaceRoutes } from "./orchestrator/workspace-routes.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export function createOrchestrator(options = {}) {
  const opencodeDir = options.opencodeDir || process.env.OPENCODE_DIR || path.resolve(HERE, "..", "engine", "opencode");
  const dataDir = options.dataDir || process.env.DATA_DIR || path.resolve(HERE, "..", ".monolith-data");
  // Default 127.0.0.1 (native/local dev — no reason to expose beyond the box).
  // In Docker, other containers reach this over the bridge network, not
  // loopback, so entrypoint.sh sets ORCH_HOST=0.0.0.0 there.
  const host = options.host || process.env.ORCH_HOST || "127.0.0.1";
  const port = Number(options.port || process.env.ORCH_PORT || 8787);
  const log = options.log || ((...a) => console.log("[orchestrator]", ...a));
  fs.mkdirSync(dataDir, { recursive: true });

  const enginePort = Number(options.opencodePort || process.env.OPENCODE_PORT || 4096);
  const engine = createEngine({ opencodeDir, port: enginePort, log: (...a) => log(...a) });
  const registry = createWorkspaceRegistry({ dataDir, log });
  const proxy = createOpencodeProxy({ engine, registry, log });
  const workspaceRoutes = createWorkspaceRoutes({ registry, engine, log });
  const routes = createOrchestratorRoutes({ registry, engine, host, port });

  // Seed + activate the configured workspace (native launcher parity).
  const seedWs = options.workspace || process.env.OPENWORK_WORKSPACE;
  if (seedWs) registry.ensure(seedWs, { activate: true });

  function applyCors(res, req) {
    // The UI is served cross-origin (UI :8080 → orchestrator :8787), matching
    // the old openwork-server which sent Access-Control-Allow-Origin: * .
    res.setHeader("access-control-allow-origin", req.headers.origin || "*");
    res.setHeader("access-control-allow-credentials", "true");
    res.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader(
      "access-control-allow-headers",
      req.headers["access-control-request-headers"] || "content-type,authorization,x-openwork-token,x-openwork-host-token",
    );
  }

  const server = http.createServer(async (req, res) => {
    applyCors(res, req);
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    const url = new URL(req.url, `http://${host}:${port}`);
    const urlPath = decodeURIComponent(url.pathname);
    const search = url.search.replace(/^\?/, "");

    try {
      // 1) opencode reverse-proxy (the agentic core).
      if (proxy.matches(urlPath)) {
        if (process.env.ORCH_LOG_REQUESTS) log(`→ ${req.method} ${urlPath.slice(0, 80)} [proxy]`);
        await proxy.handle(req, res, urlPath, search);
        return;
      }
      // 2) workspace-scoped openwork routes (config, events, sessions, groups).
      if (await workspaceRoutes.handle(req, res, urlPath, search)) {
        if (process.env.ORCH_LOG_REQUESTS) log(`→ ${req.method} ${urlPath.slice(0, 80)} [ws]`);
        return;
      }
      // 3) top-level openwork-server routes.
      if (await routes.handle(req, res, urlPath)) {
        if (process.env.ORCH_LOG_REQUESTS) log(`→ ${req.method} ${urlPath}`);
        return;
      }

      // Unhandled = a contract gap the UI expects us to fill (Phase 1+ surface).
      log(`✗ 404 ${req.method} ${urlPath}`);
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not_found", path: urlPath }));
    } catch (error) {
      log(`request failed ${urlPath}: ${error.message}`);
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "internal_error", detail: error.message }));
      } else {
        res.end();
      }
    }
  });

  async function start() {
    // Kick the engine early so the first session isn't cold.
    engine.start().catch((e) => log(`engine start error: ${e.message}`));
    await new Promise((resolve) => server.listen(port, host, resolve));
    log(`orchestrator listening on http://${host}:${port}  (opencode dir: ${opencodeDir})`);
    return { host, port };
  }

  function stop() {
    engine.stop();
    server.close();
  }

  return { start, stop, server, engine, registry };
}

// Direct-run entrypoint. (Robust on Windows: compare file URLs, not raw strings —
// import.meta.url is file:///C:/… while `file://`+path gives file://C:/…)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const orch = createOrchestrator();
  orch.start();
  const shutdown = () => {
    orch.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

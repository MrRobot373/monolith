// Reverse proxy: /workspace/:id/opencode/*  →  our opencode engine.
//
// This is the load-bearing piece that lets the UNCHANGED OpenWork UI talk to our
// own engine. The UI's opencode client (@opencode-ai/sdk) targets
//   <baseUrl>/workspace/<id>/opencode/<path>
// so we strip that prefix, look the workspace directory up in the registry, force
// ?directory=<path> (the workspace id is authoritative — the browser doesn't know
// the absolute server path), and forward to the engine, streaming the response
// back verbatim (including SSE for /event).
import http from "node:http";

// Hop-by-hop headers must not be forwarded.
const STRIP_REQ = new Set(["host", "connection", "content-length", "accept-encoding"]);
const STRIP_RES = new Set(["connection", "transfer-encoding", "content-encoding"]);

function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(chunks.length ? Buffer.concat(chunks) : null));
    req.on("error", reject);
  });
}

export function createOpencodeProxy(opts) {
  const engine = opts.engine; // { baseUrl(), start() }
  const registry = opts.registry;
  const log = opts.log || (() => {});

  // Two mounts the UI uses:
  //   /workspace/:id/opencode/*  → engine scoped to that workspace's directory
  //   /opencode/*                → engine scoped to the ACTIVE workspace (used for
  //                                the global router health/event checks at boot)
  const WS_MOUNT_RE = /^\/workspace\/([^/]+)\/opencode(\/.*)?$/;
  const ROOT_MOUNT_RE = /^\/opencode(\/.*)?$/;

  function matches(urlPath) {
    return WS_MOUNT_RE.test(urlPath) || ROOT_MOUNT_RE.test(urlPath);
  }

  /** Returns true when handled. */
  async function handle(req, res, urlPath, search) {
    const wsMatch = urlPath.match(WS_MOUNT_RE);
    const rootMatch = wsMatch ? null : urlPath.match(ROOT_MOUNT_RE);
    if (!wsMatch && !rootMatch) return false;

    const workspaceId = wsMatch ? decodeURIComponent(wsMatch[1]) : registry.activeId();
    const rest = (wsMatch ? wsMatch[2] : rootMatch[1]) || "/";
    const directory = workspaceId ? registry.directoryOf(workspaceId) : null;
    if (!directory) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "workspace_not_found", workspaceId }));
      return true;
    }

    await engine.start();
    const engineBase = engine.baseUrl();
    if (!engineBase) {
      res.writeHead(503, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "engine_unavailable" }));
      return true;
    }

    // Force the workspace directory into the query string.
    const params = new URLSearchParams(search || "");
    params.set("directory", directory);
    const target = `${engineBase}${rest}?${params.toString()}`;

    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (!STRIP_REQ.has(k.toLowerCase()) && typeof v === "string") headers[k] = v;
    }

    const body = req.method === "GET" || req.method === "HEAD" ? null : await collectBody(req);

    let upstream;
    try {
      upstream = await fetch(target, {
        method: req.method,
        headers,
        body,
        // Never buffer: needed for the /event SSE stream.
        duplex: body ? "half" : undefined,
        redirect: "manual",
      });
    } catch (error) {
      log(`proxy error → ${rest}: ${error.message}`);
      if (!res.headersSent) {
        res.writeHead(502, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "engine_proxy_failed", detail: error.message }));
      }
      return true;
    }

    const outHeaders = {};
    upstream.headers.forEach((value, key) => {
      if (!STRIP_RES.has(key.toLowerCase())) outHeaders[key] = value;
    });
    res.writeHead(upstream.status, outHeaders);

    if (!upstream.body) {
      res.end();
      return true;
    }
    // Stream the web ReadableStream to the node response (works for SSE too).
    const reader = upstream.body.getReader();
    const pump = async () => {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!res.write(Buffer.from(value))) {
            await new Promise((r) => res.once("drain", r));
          }
        }
      } catch (error) {
        log(`proxy stream aborted → ${rest}: ${error.message}`);
      } finally {
        res.end();
      }
    };
    // Abort the upstream read if the client disconnects.
    res.on("close", () => reader.cancel().catch(() => {}));
    void pump();
    return true;
  }

  return { matches, handle };
}

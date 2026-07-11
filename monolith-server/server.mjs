// Standalone MONOLITH sidecar for the Docker stack (native embeds index.mjs
// into serve-ui.mjs instead). Serves /__monolith/* (schedules + dispatch).
// Caddy routes work.localhost/__monolith/* here behind the site login.
import http from "node:http";
import { createMonolithScheduler } from "./index.mjs";

const PORT = Number(process.env.PORT || 8790);

const scheduler = createMonolithScheduler({
  dataDir: process.env.DATA_DIR || "/data",
  openworkUrl: process.env.OPENWORK_URL || "http://openwork-host:8787",
  token: process.env.OPENWORK_TOKEN || "",
  hostToken: process.env.OPENWORK_HOST_TOKEN || "",
  litellmUrl: process.env.LITELLM_URL || "",
  litellmKey: process.env.LITELLM_MASTER_KEY || "",
  log: (...args) => console.log("[monolith-server]", ...args),
});

http
  .createServer((req, res) => {
    try {
      const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (scheduler.handle(req, res, urlPath)) return;
      if (urlPath === "/health") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end('{"ok":true}');
        return;
      }
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
    } catch (error) {
      res.writeHead(500, { "content-type": "text/plain" });
      res.end("server error");
      console.error("[monolith-server]", error instanceof Error ? error.message : error);
    }
  })
  .listen(PORT, "0.0.0.0", () => {
    console.log(`[monolith-server] listening on :${PORT}`);
  });

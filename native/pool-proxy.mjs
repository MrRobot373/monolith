// Ollama Cloud key-pool proxy.
// Presents an OpenAI-compatible endpoint on http://127.0.0.1:<POOL_PORT>/v1 and
// round-robins requests across OLLAMA_KEY_1..N -> OLLAMA_POOL_BASE (default
// https://ollama.com/v1). Keys never leave this machine and are read only from
// native/.env. This is the native (no-LiteLLM) replacement for the pooling that
// scripts/build-litellm-pool.mjs used to do.
//
// Run:  node native/pool-proxy.mjs
import http from "node:http";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.join(HERE, ".env")); } catch { /* no .env yet */ }

const PORT = Number(process.env.POOL_PORT || 11435);
const BASE = (process.env.OLLAMA_POOL_BASE || "https://ollama.com/v1").trim().replace(/\/+$/, "");

const KEYS = Object.keys(process.env)
  .filter((k) => /^OLLAMA_KEY_\d+$/.test(k) && (process.env[k] || "").trim())
  .sort((a, b) => Number(a.split("_").pop()) - Number(b.split("_").pop()))
  .map((k) => process.env[k].trim());

if (KEYS.length === 0) {
  console.error("[pool-proxy] no OLLAMA_KEY_* set in native/.env — nothing to pool. Exiting.");
  process.exit(0); // not an error: cloud pool is simply disabled
}

let cursor = 0;
const nextIndex = () => (cursor = (cursor + 1) % KEYS.length);

async function forward(req, res, body) {
  // Map incoming /v1/<rest> onto BASE (which already ends in /v1): BASE + /<rest>.
  const rest = req.url.replace(/^\/v1/, "");
  const target = BASE + rest;

  // Try up to KEYS.length keys, advancing on auth/rate-limit failures.
  let lastStatus = 502;
  for (let attempt = 0; attempt < KEYS.length; attempt++) {
    const key = KEYS[cursor];
    const headers = new Headers();
    for (const [h, v] of Object.entries(req.headers)) {
      if (["host", "authorization", "content-length", "connection"].includes(h.toLowerCase())) continue;
      headers.set(h, Array.isArray(v) ? v.join(", ") : v);
    }
    headers.set("authorization", `Bearer ${key}`);

    let upstream;
    try {
      upstream = await fetch(target, {
        method: req.method,
        headers,
        body: ["GET", "HEAD"].includes(req.method) ? undefined : body,
        duplex: "half",
      });
    } catch (err) {
      console.error(`[pool-proxy] key #${cursor + 1} network error: ${err.message}`);
      nextIndex();
      continue;
    }

    if ((upstream.status === 401 || upstream.status === 429) && attempt < KEYS.length - 1) {
      console.warn(`[pool-proxy] key #${cursor + 1} -> ${upstream.status}, rotating`);
      lastStatus = upstream.status;
      nextIndex();
      continue;
    }

    res.writeHead(upstream.status, Object.fromEntries(upstream.headers));
    if (upstream.body) Readable.fromWeb(upstream.body).pipe(res);
    else res.end();
    nextIndex(); // spread load for the next request
    return;
  }
  res.writeHead(lastStatus, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "all pooled keys failed" }));
}

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, keys: KEYS.length, base: BASE }));
    return;
  }
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => forward(req, res, Buffer.concat(chunks)).catch((e) => {
    console.error("[pool-proxy] error:", e);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[pool-proxy] listening on http://127.0.0.1:${PORT}/v1 -> ${BASE} (${KEYS.length} keys)`);
});

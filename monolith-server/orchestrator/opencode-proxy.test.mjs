// Run: node --test monolith-server/orchestrator/opencode-proxy.test.mjs
//
// Regression test for a real bug found via live testing (2026-08-04): opencode
// returned a stale/wrong Content-Length header (714) for a body that was
// actually longer (2911 bytes) — real repro: fetching /session directly from
// opencode with the SDK's own client correctly read the full 2911-byte body
// (undici followed the real chunked framing over the misleading header), but
// through our proxy the client only received 714 bytes, because we forwarded
// upstream's Content-Length verbatim while re-streaming the body through a
// fresh reader/writer pump — Node's http.ServerResponse then truncated OUR
// response to match the wrong header we'd declared, silently corrupting JSON
// (in the real UI, this degraded an actual generated reply down to "Empty
// message"). Fix: never forward content-length on the proxied response — let
// Node fall back to chunked transfer-encoding, correct for a re-streamed body
// whose length isn't known at header-write time anyway.
//
// This suite couldn't reliably hand-construct the exact wire-level anomaly
// (a response with both a wrong content-length AND real chunked framing) —
// Node's http server normalizes response framing in ways that fought every
// attempt to send both deliberately. Instead it tests the actual code
// invariant the fix establishes directly: content-length is unconditionally
// stripped from the proxied response, regardless of what upstream sends. That
// invariant is what a future refactor could accidentally undo (e.g. trimming
// STRIP_RES "to simplify it") — this test catches exactly that regression.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { createOpencodeProxy } from "./opencode-proxy.mjs";
import { createWorkspaceRegistry } from "./workspaces.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const realBody = JSON.stringify({ items: Array.from({ length: 200 }, (_, i) => ({ id: `ses_${i}`, note: "x".repeat(20) })) });

// A well-behaved fake engine (correct, matching content-length) — the test
// asserts our proxy strips it anyway, unconditionally.
const fakeEngine = http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "application/json", "content-length": String(Buffer.byteLength(realBody)) });
  res.end(realBody);
});
await new Promise((resolve) => fakeEngine.listen(0, "127.0.0.1", resolve));
const engineBaseUrl = `http://127.0.0.1:${fakeEngine.address().port}`;
const engine = { baseUrl: () => engineBaseUrl, start: async () => engineBaseUrl, ready: () => true };

const registry = createWorkspaceRegistry({ dataDir: fs.mkdtempSync(path.join(os.tmpdir(), "monolith-proxy-test-")) });
const workspace = registry.ensure(fs.mkdtempSync(path.join(os.tmpdir(), "monolith-proxy-ws-")), { activate: true });
const proxy = createOpencodeProxy({ engine, registry, log: () => {} });

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const urlPath = decodeURIComponent(url.pathname);
  const search = url.search.replace(/^\?/, "");
  if (proxy.matches(urlPath)) {
    proxy.handle(req, res, urlPath, search);
  } else {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/workspace/${workspace.id}/opencode`;

test.after(() => {
  server.close();
  fakeEngine.close();
});

test("proxy never forwards upstream's content-length (the fix's actual mechanism)", async () => {
  const res = await fetch(`${base}/session`);
  assert.equal(res.status, 200);
  assert.equal(
    res.headers.get("content-length"),
    null,
    "content-length must be stripped, not relayed — a stale upstream value would truncate a re-streamed body (the real bug)",
  );
  assert.equal(res.headers.get("transfer-encoding"), "chunked", "response falls back to chunked framing instead");
});

test("proxy still delivers the correct full body and content-type when upstream is well-behaved", async () => {
  const res = await fetch(`${base}/session`);
  assert.equal(res.headers.get("content-type"), "application/json");
  const text = await res.text();
  assert.equal(text, realBody);
  assert.equal(JSON.parse(text).items.length, 200);
});

test("workspace-scoped mount injects ?directory= from the registry, not the client", async () => {
  let capturedUrl = null;
  fakeEngine.once("request", (req) => {
    capturedUrl = req.url;
  });
  await fetch(`${base}/session`);
  const params = new URLSearchParams(capturedUrl.split("?")[1]);
  assert.equal(params.get("directory"), workspace.path);
});

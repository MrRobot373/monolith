// Run: node --test monolith-server/orchestrator/routes.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createOrchestratorRoutes } from "./routes.mjs";
import { createWorkspaceRegistry } from "./workspaces.mjs";

const registry = createWorkspaceRegistry({ dataDir: fs.mkdtempSync(path.join(os.tmpdir(), "monolith-routes-data-")) });
const engine = { ready: () => true, baseUrl: () => "http://127.0.0.1:9" };
const routes = createOrchestratorRoutes({ registry, engine, host: "127.0.0.1", port: 8787, approval: "manual" });

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  routes.handle(req, res, urlPath).then((handled) => {
    if (!handled) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not_found" }));
    }
  });
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

async function api(method, route, body) {
  const response = await fetch(`${base}${route}`, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, json: await response.json() };
}

test.after(() => server.close());

test("health returns ok with version and uptime", async () => {
  const { status, json } = await api("GET", "/health");
  assert.equal(status, 200);
  assert.equal(json.ok, true);
  assert.equal(typeof json.uptimeMs, "number");
});

test("capabilities declares the opencode proxy as available", async () => {
  const { json } = await api("GET", "/capabilities");
  assert.equal(json.proxy.opencode, true);
  assert.equal(json.skills.source, "opencode");
});

test("workspace lifecycle: empty -> create -> activate -> rename -> delete", async () => {
  const empty = await api("GET", "/workspaces");
  assert.deepEqual(empty.json.items, []);
  assert.equal(empty.json.activeId, null);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "monolith-routes-ws-"));
  const created = await api("POST", "/workspaces/local", { folderPath: dir, name: "Test WS", preset: "starter" });
  assert.equal(created.status, 200);
  assert.equal(created.json.items.length, 1);
  const id = created.json.items[0].id;
  assert.equal(created.json.activeId, id, "creating a workspace auto-activates it");

  const activated = await api("POST", `/workspaces/${id}/activate`);
  assert.equal(activated.status, 200);
  assert.equal(activated.json.activeId, id);
  assert.equal(activated.json.persisted, true);

  const renamed = await api("PATCH", `/workspaces/${id}/display-name`, { displayName: "Renamed WS" });
  assert.equal(renamed.status, 200);

  const activateMissing = await api("POST", "/workspaces/does-not-exist/activate");
  assert.equal(activateMissing.status, 404);

  const deleted = await api("DELETE", `/workspaces/${id}`);
  assert.equal(deleted.status, 200);
  assert.equal(deleted.json.deleted, true);
  assert.equal(deleted.json.items.length, 0);
});

test("second POST /workspaces/local for the same folder is idempotent (dedup at the routes layer too)", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "monolith-routes-dedup-"));
  const first = await api("POST", "/workspaces/local", { folderPath: dir, name: "A" });
  const second = await api("POST", "/workspaces/local", { folderPath: dir, name: "B" });
  assert.equal(first.json.items.length, 1);
  assert.equal(second.json.items.length, 1);
});

test("POST /workspaces/local without folderPath is rejected", async () => {
  const { status, json } = await api("POST", "/workspaces/local", {});
  assert.equal(status, 400);
  assert.equal(json.error, "folderPath_required");
});

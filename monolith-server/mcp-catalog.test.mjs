// Run: node --test monolith-server/mcp-catalog.test.mjs
// Exercises the MCP catalog over HTTP: listing, enable with config templating,
// required-field validation, secret masking, disable, and the seeder-side
// loadEnabledCatalogEntries() view.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createMcpCatalog, loadEnabledCatalogEntries, buildEntry, CATALOG } from "./mcp-catalog.mjs";

const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "monolith-mcp-"));
const catalog = createMcpCatalog({ dataDir: tmpBase, log: () => {} });

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  // Simulates the Supabase auth layer: requests may carry a test user identity.
  const testUser = req.headers["x-test-user"];
  if (testUser) req.monolithUser = { email: String(testUser) };
  if (catalog.handle(req, res, urlPath)) return;
  res.writeHead(404);
  res.end();
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/__monolith/mcp`;

async function api(method, route, body) {
  const response = await fetch(`${base}${route}`, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, json: await response.json() };
}

test.after(() => {
  server.close();
  fs.rmSync(tmpBase, { recursive: true, force: true });
});

test("catalog lists entries with status and config fields", async () => {
  const { status, json } = await api("GET", "/catalog");
  assert.equal(status, 200);
  assert.ok(json.catalog.length >= 50, `expected >= 50 catalog entries, got ${json.catalog.length}`);
  const web = json.catalog.find((item) => item.id === "monolith-web");
  assert.equal(web.builtin, true);
  assert.equal(web.enabled, true);
  const github = json.catalog.find((item) => item.id === "github");
  assert.equal(github.enabled, false);
  assert.deepEqual(github.config[0], { key: "token", label: "Personal access token", secret: true, required: true });
  // Catalog responses never include command/url internals with placeholders
  assert.ok(!JSON.stringify(json).includes("{token}"));
});

test("enable validates required config", async () => {
  const missing = await api("POST", "/servers", { id: "github", config: {} });
  assert.equal(missing.status, 400);
  assert.equal(missing.json.error, "config_required:token");
  const unknown = await api("POST", "/servers", { id: "does-not-exist" });
  assert.equal(unknown.status, 404);
  const builtin = await api("POST", "/servers", { id: "monolith-web" });
  assert.equal(builtin.status, 400);
});

test("enable github: templated entry, secret masked in responses", async () => {
  const enabled = await api("POST", "/servers", { id: "github", config: { token: "ghp_SECRET123" } });
  assert.equal(enabled.status, 200);
  assert.equal(enabled.json.entry.type, "remote");
  assert.ok(!JSON.stringify(enabled.json).includes("ghp_SECRET123"), "response must mask the token");

  const listed = await api("GET", "/servers");
  assert.ok(!JSON.stringify(listed.json).includes("ghp_SECRET123"));
  assert.match(listed.json.servers.github.entry.headers.Authorization, /Bearer •+/);

  const view = await api("GET", "/catalog");
  assert.equal(view.json.catalog.find((item) => item.id === "github").enabled, true);

  // The store on disk keeps the real value (dataDir is secret storage),
  // keyed under the "local" user in unauthenticated native mode…
  const store = JSON.parse(fs.readFileSync(path.join(tmpBase, "mcp-servers.json"), "utf8"));
  assert.equal(store.users.local.servers.github.entry.headers.Authorization, "Bearer ghp_SECRET123");
  // …and the seeder view exposes concrete entries for opencode.json.
  const entries = loadEnabledCatalogEntries(tmpBase);
  assert.equal(entries.github.type, "remote");
  assert.equal(entries.github.url, "https://api.githubcopilot.com/mcp/");
});

test("optional config: blank optional args and headers are dropped", async () => {
  const supabase = buildEntry(
    CATALOG.find((item) => item.id === "supabase"),
    { token: "sbp_x" },
  );
  assert.ok(!supabase.command.some((part) => part.includes("--project-ref")));
  const supabaseScoped = buildEntry(
    CATALOG.find((item) => item.id === "supabase"),
    { token: "sbp_x", projectRef: "abc123" },
  );
  assert.ok(supabaseScoped.command.includes("--project-ref=abc123"));
  assert.ok(supabaseScoped.command.includes("--read-only"), "supabase stays read-only");

  const context7 = buildEntry(CATALOG.find((item) => item.id === "context7"), {});
  assert.equal(context7.headers, undefined, "blank optional header omitted");
});

test("disable removes the server", async () => {
  const disabled = await api("DELETE", "/servers/github");
  assert.equal(disabled.status, 200);
  const view = await api("GET", "/catalog");
  assert.equal(view.json.catalog.find((item) => item.id === "github").enabled, false);
  assert.deepEqual(loadEnabledCatalogEntries(tmpBase), {});
  const again = await api("DELETE", "/servers/github");
  assert.equal(again.status, 404);
});

test("per-user isolation: users only see and manage their own servers", async () => {
  const asUser = (user) => ({ "x-test-user": user, "content-type": "application/json" });

  const aliceEnable = await fetch(`${base}/servers`, {
    method: "POST",
    headers: asUser("alice@example.com"),
    body: JSON.stringify({ id: "todoist", config: { apiToken: "alice-token" } }),
  });
  assert.equal(aliceEnable.status, 200);

  // Bob does not see Alice's server as enabled and cannot disable it.
  const bobCatalog = await (await fetch(`${base}/catalog`, { headers: asUser("bob@example.com") })).json();
  assert.equal(bobCatalog.catalog.find((item) => item.id === "todoist").enabled, false);
  const bobServers = await (await fetch(`${base}/servers`, { headers: asUser("bob@example.com") })).json();
  assert.deepEqual(bobServers.servers, {});
  const bobDisable = await fetch(`${base}/servers/todoist`, { method: "DELETE", headers: asUser("bob@example.com") });
  assert.equal(bobDisable.status, 404);

  // Alice still has it; the local (unauthenticated) user does not.
  const aliceCatalog = await (await fetch(`${base}/catalog`, { headers: asUser("alice@example.com") })).json();
  assert.equal(aliceCatalog.catalog.find((item) => item.id === "todoist").enabled, true);
  const localCatalog = await (await fetch(`${base}/catalog`)).json();
  assert.equal(localCatalog.catalog.find((item) => item.id === "todoist").enabled, false);

  // Cleanup: Alice disables her own.
  const aliceDisable = await fetch(`${base}/servers/todoist`, { method: "DELETE", headers: asUser("alice@example.com") });
  assert.equal(aliceDisable.status, 200);
});

test("catalog integrity: unique ids, complete metadata, every entry builds", () => {
  const seen = new Set();
  for (const item of CATALOG) {
    assert.ok(/^[a-z0-9-]+$/.test(item.id), `${item.id} id is url-safe`);
    assert.ok(!seen.has(item.id), `${item.id} is unique`);
    seen.add(item.id);
    assert.ok(item.name && item.category && item.description, `${item.id} has metadata`);
    if (item.builtin) continue;
    assert.ok(Boolean(item.local) !== Boolean(item.remote), `${item.id} is local XOR remote`);

    // Build with every config field filled with a dummy value.
    const fullConfig = Object.fromEntries((item.config || []).map((field) => [field.key, `dummy-${field.key}`]));
    const entry = buildEntry(item, fullConfig);
    assert.ok(entry.type === "local" || entry.type === "remote", `${item.id} builds`);
    if (entry.type === "local") {
      assert.ok(entry.command.length >= 1, `${item.id} has a command`);
      assert.ok(["npx", "uvx"].includes(entry.command[0]), `${item.id} runs via npx/uvx`);
    }
    assert.ok(!/\{[a-zA-Z0-9_]+\}/.test(JSON.stringify(entry)), `${item.id} full-config: no unresolved placeholders`);

    // Build again with only required fields — optional blanks must drop cleanly.
    const minimalConfig = Object.fromEntries(
      (item.config || []).filter((field) => field.required).map((field) => [field.key, `dummy-${field.key}`]),
    );
    const minimalEntry = buildEntry(item, minimalConfig);
    assert.ok(!/\{[a-zA-Z0-9_]+\}/.test(JSON.stringify(minimalEntry)), `${item.id} minimal-config: no unresolved placeholders`);
  }
});

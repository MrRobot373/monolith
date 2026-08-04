// Run: node --test monolith-server/orchestrator/workspace-routes.test.mjs
// Exercises workspace-routes.mjs over real HTTP with a fake opencode engine
// (a real http.createServer standing in for `bun ... serve`, same pattern as
// chat.test.mjs's fake provider) plus a real tmpdir workspace directory, so
// skill/config file writes are verified against the actual filesystem.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createWorkspaceRoutes } from "./workspace-routes.mjs";
import { createWorkspaceRegistry } from "./workspaces.mjs";

// ---- fake opencode engine ---------------------------------------------------
const fakeSkills = [
  { name: "web-search", description: "search the web", location: "<built-in>", content: "built-in body" },
];
const fakeCommands = [
  { name: "init", description: "guided setup", source: "command", template: "do the thing" },
  { name: "shadow", description: "auto from skill", source: "skill", template: "n/a" },
];
let mcpLiveStatus = { "monolith-web": { status: "connected" } };
let disposeCalls = 0;

const fakeEngine = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const send = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (url.pathname === "/skill" && req.method === "GET") return send(200, fakeSkills);
  if (url.pathname === "/command" && req.method === "GET") return send(200, fakeCommands);
  if (url.pathname === "/mcp" && req.method === "GET") return send(200, mcpLiveStatus);
  if (url.pathname.startsWith("/mcp/") && url.pathname.endsWith("/auth") && req.method === "DELETE") return send(200, { ok: true });
  if (url.pathname === "/instance/dispose" && req.method === "POST") {
    disposeCalls++;
    return send(200, { ok: true });
  }
  send(404, { error: "unhandled_in_fake_engine", path: url.pathname });
});
await new Promise((resolve) => fakeEngine.listen(0, "127.0.0.1", resolve));
const engineBaseUrl = `http://127.0.0.1:${fakeEngine.address().port}`;
const engine = {
  baseUrl: () => engineBaseUrl,
  start: async () => engineBaseUrl,
  ready: () => true,
};

// ---- real workspace directory + registry -----------------------------------
const wsDir = fs.mkdtempSync(path.join(os.tmpdir(), "monolith-wsroutes-"));
fs.writeFileSync(path.join(wsDir, "opencode.json"), JSON.stringify({ mcp: { "monolith-web": { type: "local", enabled: true } } }, null, 2));
const registry = createWorkspaceRegistry({ dataDir: fs.mkdtempSync(path.join(os.tmpdir(), "monolith-wsroutes-data-")) });
const workspace = registry.ensure(wsDir, { activate: true });

const workspaceRoutes = createWorkspaceRoutes({ registry, engine, log: () => {} });

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const urlPath = decodeURIComponent(url.pathname);
  const search = url.search.replace(/^\?/, "");
  workspaceRoutes.handle(req, res, urlPath, search).then((handled) => {
    if (!handled) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not_found" }));
    }
  });
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/workspace/${workspace.id}`;

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
  fakeEngine.close();
  fs.rmSync(wsDir, { recursive: true, force: true });
});

test("unknown workspace id returns 404", async () => {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/workspace/nope/skills`);
  assert.equal(response.status, 404);
});

test("events and session-groups/events are polled JSON, not hung SSE", async () => {
  const events = await api("GET", "/events");
  assert.equal(events.status, 200);
  assert.deepEqual(events.json.items, []);
  assert.equal(typeof events.json.cursor, "number");
  const groupEvents = await api("GET", "/session-groups/events");
  assert.deepEqual(groupEvents.json.items, []);
});

test("skills: default list excludes global/built-in scope; includeGlobal=true includes it", async () => {
  const defaultList = await api("GET", "/skills");
  assert.equal(defaultList.status, 200);
  assert.equal(
    defaultList.json.items.some((i) => i.name === "web-search"),
    false,
    "built-in (global-scope) skill is excluded by default",
  );

  const withGlobal = await api("GET", "/skills?includeGlobal=true");
  const item = withGlobal.json.items.find((i) => i.name === "web-search");
  assert.ok(item);
  assert.equal(item.scope, "global", "built-in location is not inside the workspace dir");
  assert.equal(item.description, "search the web");
});

test("skills: create writes a real SKILL.md, appears immediately (dispose), then deletes cleanly", async () => {
  const before = disposeCalls;
  const created = await api("POST", "/skills", { name: "my-skill", description: "desc", content: "body text" });
  assert.equal(created.status, 200);
  assert.ok(disposeCalls > before, "dispose was called after the write");

  const file = path.join(wsDir, ".opencode", "skills", "my-skill", "SKILL.md");
  const content = fs.readFileSync(file, "utf8");
  assert.match(content, /^---/, "frontmatter was added");
  assert.match(content, /name: my-skill/);
  assert.match(content, /body text/);

  const del = await api("DELETE", "/skills/my-skill");
  assert.equal(del.status, 200);
  assert.equal(fs.existsSync(path.join(wsDir, ".opencode", "skills", "my-skill")), false);
});

test("skills: create rejects a path-traversal name (safeChildPath boundary)", async () => {
  const escapeAttempt = await api("POST", "/skills", { name: "../../evil", description: "", content: "x" });
  assert.equal(escapeAttempt.status, 400);
  // Nothing was written outside the workspace's own skills directory.
  assert.equal(fs.existsSync(path.join(wsDir, "..", "evil")), false);
});

test("skills: delete of a skill not present in the workspace's own dir 404s (won't touch built-in/global)", async () => {
  const del = await api("DELETE", "/skills/web-search"); // built-in, not in <ws>/.opencode/skills
  assert.equal(del.status, 404);
});

test("mcp: list merges opencode.json config with live status", async () => {
  const { status, json } = await api("GET", "/mcp");
  assert.equal(status, 200);
  assert.equal(json.items.length, 1);
  assert.equal(json.items[0].name, "monolith-web");
  assert.equal(json.engineSync.status, "ok");
});

test("mcp: engineSync reports failures for non-connected servers", async () => {
  mcpLiveStatus = { "monolith-web": { status: "error" } };
  const { json } = await api("GET", "/mcp");
  assert.equal(json.engineSync.status, "failed");
  assert.equal(json.engineSync.failures[0].name, "monolith-web");
  mcpLiveStatus = { "monolith-web": { status: "connected" } };
});

test("mcp: add, enable-toggle, and remove edit opencode.json directly", async () => {
  const add = await api("POST", "/mcp", { name: "test-server", config: { type: "local", enabled: true } });
  assert.equal(add.status, 200);
  assert.ok(add.json.items.some((i) => i.name === "test-server"));

  const cfgAfterAdd = JSON.parse(fs.readFileSync(path.join(wsDir, "opencode.json"), "utf8"));
  assert.ok(cfgAfterAdd.mcp["test-server"]);

  const toggled = await api("POST", "/mcp/test-server/enabled", { enabled: false });
  const item = toggled.json.items.find((i) => i.name === "test-server");
  assert.equal(item.disabledByTools, true);

  const removed = await api("DELETE", "/mcp/test-server");
  assert.equal(removed.json.items.some((i) => i.name === "test-server"), false);
  const cfgAfterRemove = JSON.parse(fs.readFileSync(path.join(wsDir, "opencode.json"), "utf8"));
  assert.equal(cfgAfterRemove.mcp["test-server"], undefined);
});

test("mcp: auth logout proxies to the engine's native DELETE /mcp/:name/auth", async () => {
  const { status, json } = await api("DELETE", "/mcp/monolith-web/auth");
  assert.equal(status, 200);
  assert.equal(json.ok, true);
});

test("commands: read-only, filters out skill-shadow entries", async () => {
  const { status, json } = await api("GET", "/commands");
  assert.equal(status, 200);
  assert.equal(json.items.length, 1);
  assert.equal(json.items[0].name, "init");
  assert.equal(json.items.some((i) => i.name === "shadow"), false, "skill-sourced entries are excluded");
});

test("commands: write endpoints are an honest 501, not a guessed file format", async () => {
  const post = await api("POST", "/commands", { name: "x" });
  assert.equal(post.status, 501);
  const del = await api("DELETE", "/commands/x");
  assert.equal(del.status, 501);
});

test("plugins and audit are honest empty states", async () => {
  const plugins = await api("GET", "/plugins");
  assert.deepEqual(plugins.json, { items: [], loadOrder: [] });
  const audit = await api("GET", "/audit");
  assert.deepEqual(audit.json, { items: [] });
});

test("opencode-config: GET reads, POST validates JSON before writing", async () => {
  const get = await api("GET", "/opencode-config");
  assert.equal(get.status, 200);
  const cfg = JSON.parse(get.json.content);
  assert.ok(cfg.mcp);

  const badWrite = await api("POST", "/opencode-config", { content: "{not valid json" });
  assert.equal(badWrite.status, 400);
  assert.equal(badWrite.json.ok, false);

  cfg.small_model = "ollama/roundtrip-test";
  const goodWrite = await api("POST", "/opencode-config", { content: JSON.stringify(cfg) });
  assert.equal(goodWrite.status, 200);
  assert.equal(goodWrite.json.ok, true);

  const after = JSON.parse(fs.readFileSync(path.join(wsDir, "opencode.json"), "utf8"));
  assert.equal(after.small_model, "ollama/roundtrip-test");
});

test("engine/reload triggers a dispose and returns reloadedAt", async () => {
  const before = disposeCalls;
  const { status, json } = await api("POST", "/engine/reload");
  assert.equal(status, 200);
  assert.equal(json.ok, true);
  assert.equal(typeof json.reloadedAt, "number");
  assert.ok(disposeCalls > before);
});

test("unrelated/unhandled sub-paths fall through (return false) for the outer dispatcher to 404", async () => {
  const response = await fetch(`${base}/definitely-not-a-real-route`);
  assert.equal(response.status, 404); // this test server's own fallback
});

// Run: node --test monolith-server/workspace-files.test.mjs
// Exercises the WorkspaceFileService over real HTTP against a throwaway
// workspace, including the security-critical paths: traversal, junction
// escape, revision conflicts, protected files, trash/restore, ledger.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createWorkspaceFileService } from "./workspace-files.mjs";

const WS_ID = "test-ws";
const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "monolith-wfs-"));
const workspaceRoot = path.join(tmpBase, "workspace");
const outsideDir = path.join(tmpBase, "outside");
const dataDir = path.join(tmpBase, "data");
fs.mkdirSync(path.join(workspaceRoot, "src"), { recursive: true });
fs.mkdirSync(outsideDir, { recursive: true });
fs.writeFileSync(path.join(workspaceRoot, "src", "app.js"), "console.log('hello monolith');\n");
fs.writeFileSync(path.join(workspaceRoot, "README.md"), "# Test project\n");
fs.writeFileSync(path.join(workspaceRoot, ".env"), "SECRET_KEY=super-secret-value\n");
fs.writeFileSync(path.join(outsideDir, "loot.txt"), "outside the workspace\n");

const service = createWorkspaceFileService({
  dataDir,
  resolveWorkspaceRoot: async (id) => (id === WS_ID ? workspaceRoot : null),
  log: () => {},
});

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (service.handle(req, res, urlPath)) return;
  res.writeHead(404);
  res.end("unhandled");
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/__monolith/workspaces/${WS_ID}`;

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

test("tree lists entries with protected flags", async () => {
  const { status, json } = await api("GET", "/tree");
  assert.equal(status, 200);
  const names = json.entries.map((entry) => entry.name);
  assert.ok(names.includes("src") && names.includes("README.md") && names.includes(".env"));
  assert.equal(json.entries.find((entry) => entry.name === ".env").protected, true);
  assert.equal(json.entries.find((entry) => entry.name === "src").type, "directory");
});

test("read returns content + revision; write enforces revisions", async () => {
  const read = await api("GET", "/file?path=src/app.js");
  assert.equal(read.status, 200);
  assert.match(read.json.file.content, /hello monolith/);
  const revision = read.json.file.revision;
  assert.equal(typeof revision, "string");

  // Write without revision on an existing file -> 409
  const noRev = await api("PUT", "/file?path=src/app.js", { content: "x" });
  assert.equal(noRev.status, 409);
  assert.equal(noRev.json.error, "revision_required");

  // Wrong revision -> 409 conflict with current revision
  const wrong = await api("PUT", "/file?path=src/app.js", { content: "x", expectedRevision: "deadbeefdeadbeef" });
  assert.equal(wrong.status, 409);
  assert.equal(wrong.json.error, "revision_conflict");
  assert.equal(wrong.json.currentRevision, revision);

  // Correct revision -> write succeeds, disk updated
  const good = await api("PUT", "/file?path=src/app.js", {
    content: "console.log('updated');\n",
    expectedRevision: revision,
  });
  assert.equal(good.status, 200);
  assert.match(fs.readFileSync(path.join(workspaceRoot, "src", "app.js"), "utf8"), /updated/);

  // New file via PUT without revision -> created
  const created = await api("PUT", "/file?path=src/new.js", { content: "// new\n" });
  assert.equal(created.status, 200);
  assert.equal(created.json.created, true);
});

test("path traversal and absolute paths are rejected", async () => {
  for (const bad of ["..%2Foutside%2Floot.txt", "src%2F..%2F..%2Foutside%2Floot.txt"]) {
    const { status, json } = await api("GET", `/file?path=${bad}`);
    assert.equal(status, 403, `expected 403 for ${bad}`);
    assert.equal(json.error, "path_traversal_rejected");
  }
  const absolute = await api("GET", `/file?path=${encodeURIComponent("C:\\Windows\\win.ini")}`);
  assert.equal(absolute.status, 400);
  assert.equal(absolute.json.error, "path_must_be_workspace_relative");
});

test("junction/symlink escape is rejected", async (t) => {
  const link = path.join(workspaceRoot, "escape");
  try {
    fs.symlinkSync(outsideDir, link, "junction");
  } catch {
    t.skip("cannot create junction on this filesystem");
    return;
  }
  const read = await api("GET", "/file?path=escape/loot.txt");
  assert.equal(read.status, 403);
  assert.equal(read.json.error, "symlink_escape_rejected");
  const write = await api("PUT", "/file?path=escape/planted.txt", { content: "x" });
  assert.equal(write.status, 403);
  assert.equal(write.json.error, "symlink_escape_rejected");
  assert.ok(!fs.existsSync(path.join(outsideDir, "planted.txt")), "no file may appear outside workspace");
});

test("protected files: content read, write, and trash all denied", async () => {
  const read = await api("GET", "/file?path=.env");
  assert.equal(read.status, 403);
  assert.equal(read.json.error, "protected_file");
  assert.ok(!JSON.stringify(read.json).includes("super-secret-value"), "secret value must not leak");

  const write = await api("PUT", "/file?path=.env", { content: "SECRET_KEY=changed" });
  assert.equal(write.status, 403);

  const trash = await api("POST", "/trash", { path: ".env" });
  assert.equal(trash.status, 403);
  assert.ok(fs.existsSync(path.join(workspaceRoot, ".env")));

  const gitInternals = await api("GET", "/file?path=.git/config");
  assert.equal(gitInternals.status, 403);
});

test("create, move, trash, restore roundtrip", async () => {
  const created = await api("POST", "/files", { path: "docs/notes.md", content: "# notes\n" });
  assert.equal(created.status, 201);
  assert.ok(fs.existsSync(path.join(workspaceRoot, "docs", "notes.md")));

  const moved = await api("POST", "/move", { from: "docs/notes.md", to: "docs/renamed.md" });
  assert.equal(moved.status, 200);
  assert.ok(fs.existsSync(path.join(workspaceRoot, "docs", "renamed.md")));

  const trashed = await api("POST", "/trash", { path: "docs/renamed.md" });
  assert.equal(trashed.status, 200);
  const trashId = trashed.json.trashId;
  assert.ok(!fs.existsSync(path.join(workspaceRoot, "docs", "renamed.md")));

  const listed = await api("GET", "/trash");
  assert.equal(listed.json.items[0].trashId, trashId);

  const restored = await api("POST", "/restore", { trashId });
  assert.equal(restored.status, 200);
  assert.ok(fs.existsSync(path.join(workspaceRoot, "docs", "renamed.md")));
  assert.match(fs.readFileSync(path.join(workspaceRoot, "docs", "renamed.md"), "utf8"), /# notes/);
});

test("search finds content and skips protected files", async () => {
  const { status, json } = await api("GET", "/search?q=updated");
  assert.equal(status, 200);
  assert.ok(json.results.some((result) => result.path === "src/app.js"));

  const secret = await api("GET", "/search?q=super-secret");
  assert.equal(secret.json.results.length, 0, "search must not read protected files");
});

test("ledger records writes and blocked operations", async () => {
  const { json } = await api("GET", "/ledger?limit=100");
  const ops = json.events.map((event) => `${event.op}:${event.status}`);
  assert.ok(ops.includes("write:ok"), "write event recorded");
  assert.ok(ops.includes("trash:ok"), "trash event recorded");
  assert.ok(ops.includes("restore:ok"), "restore event recorded");
  assert.ok(
    json.events.some((event) => event.status === "blocked" && event.rule === "protected_file"),
    "blocked protected-file attempt recorded",
  );
  assert.ok(
    !JSON.stringify(json.events).includes("super-secret-value"),
    "ledger must not contain secret values",
  );
});

test("unknown workspace is 404 and nothing leaks", async () => {
  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/__monolith/workspaces/other-ws/file?path=README.md`,
  );
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "workspace_not_found");
});

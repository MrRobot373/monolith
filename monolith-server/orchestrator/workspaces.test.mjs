// Run: node --test monolith-server/orchestrator/workspaces.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createWorkspaceRegistry } from "./workspaces.mjs";

function tmpDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "monolith-ws-registry-"));
}
function tmpWorkspaceDir(name = "ws") {
  return fs.mkdtempSync(path.join(os.tmpdir(), `monolith-${name}-`));
}

test("ensure registers a new workspace and activates it by default", () => {
  const registry = createWorkspaceRegistry({ dataDir: tmpDataDir() });
  const dir = tmpWorkspaceDir();
  const ws = registry.ensure(dir);
  assert.equal(ws.path, path.resolve(dir));
  assert.equal(ws.active, true);
  assert.equal(registry.activeId(), ws.id);
  assert.equal(registry.list().length, 1);
});

test("ensure is idempotent for the same directory (dedup, no duplicate entries)", () => {
  const registry = createWorkspaceRegistry({ dataDir: tmpDataDir() });
  const dir = tmpWorkspaceDir();
  const first = registry.ensure(dir, { name: "One" });
  const second = registry.ensure(dir, { name: "Two" });
  assert.equal(first.id, second.id);
  assert.equal(registry.list().length, 1);
});

test("directoryOf resolves a registered id and null for unknown ids", () => {
  const registry = createWorkspaceRegistry({ dataDir: tmpDataDir() });
  const dir = tmpWorkspaceDir();
  const ws = registry.ensure(dir);
  assert.equal(registry.directoryOf(ws.id), path.resolve(dir));
  assert.equal(registry.directoryOf("nope"), null);
});

test("activate switches the active workspace and persists", () => {
  const dataDir = tmpDataDir();
  const registry = createWorkspaceRegistry({ dataDir });
  const a = registry.ensure(tmpWorkspaceDir("a"));
  const b = registry.ensure(tmpWorkspaceDir("b"));
  assert.equal(registry.activeId(), b.id, "second ensure auto-activates");
  assert.equal(registry.activate(a.id), true);
  assert.equal(registry.activeId(), a.id);
  assert.equal(registry.activate("missing"), false);

  // Persistence: a fresh registry instance over the same dataDir sees it.
  const reopened = createWorkspaceRegistry({ dataDir });
  assert.equal(reopened.activeId(), a.id);
});

test("rename updates the display name without changing the id", () => {
  const registry = createWorkspaceRegistry({ dataDir: tmpDataDir() });
  const ws = registry.ensure(tmpWorkspaceDir(), { name: "Original" });
  const renamed = registry.rename(ws.id, "Renamed");
  assert.equal(renamed.name, "Renamed");
  assert.equal(renamed.id, ws.id);
  assert.equal(registry.rename("missing", "x"), null);
});

test("remove deletes the workspace and reassigns active if it was active", () => {
  const registry = createWorkspaceRegistry({ dataDir: tmpDataDir() });
  const a = registry.ensure(tmpWorkspaceDir("a"));
  const b = registry.ensure(tmpWorkspaceDir("b"));
  registry.activate(b.id);
  assert.equal(registry.remove(b.id), true);
  assert.equal(registry.list().length, 1);
  assert.equal(registry.activeId(), a.id, "active workspace reassigned after removing the active one");
  assert.equal(registry.remove("already-gone"), false);
});

test("publicView never leaks the internal record beyond its documented fields", () => {
  const registry = createWorkspaceRegistry({ dataDir: tmpDataDir() });
  const ws = registry.ensure(tmpWorkspaceDir());
  assert.deepEqual(Object.keys(ws).sort(), ["active", "createdAt", "id", "name", "path", "preset", "workspaceType"].sort());
});

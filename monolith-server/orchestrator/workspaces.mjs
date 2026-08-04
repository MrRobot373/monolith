// Workspace registry — the piece the closed openwork-server uniquely owned.
//
// Maps a workspace id ↔ an absolute directory on disk. The opencode engine is
// directory-scoped (every request carries ?directory=<path>), so this registry
// is what lets one engine serve many workspaces. Persisted as JSON, mirroring
// the store pattern used by monolith-server/{chat,mcp-catalog}.mjs.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function workspaceIdFromPath(dir) {
  // Stable, path-derived id (matches the existing native launcher convention:
  // basename, with a short hash suffix to disambiguate same-named folders).
  const resolved = path.resolve(dir);
  const base = path.basename(resolved) || "workspace";
  const hash = crypto.createHash("sha256").update(process.platform === "win32" ? resolved.toLowerCase() : resolved).digest("hex").slice(0, 8);
  return `${base.replace(/[^a-zA-Z0-9_-]+/g, "-")}-${hash}`;
}

export function createWorkspaceRegistry(opts) {
  const dataDir = opts.dataDir;
  const log = opts.log || (() => {});
  const storePath = path.join(dataDir, "workspaces.json");
  fs.mkdirSync(dataDir, { recursive: true });

  function load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(storePath, "utf8"));
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.workspaces)) return parsed;
    } catch {
      // fresh store
    }
    return { workspaces: [], activeId: null };
  }

  function save(state) {
    const tmp = `${storePath}.tmp-${crypto.randomBytes(4).toString("hex")}`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n");
    fs.renameSync(tmp, storePath);
  }

  let state = load();

  function publicView(ws) {
    return {
      id: ws.id,
      name: ws.name,
      path: ws.path,
      workspaceType: ws.workspaceType || "local",
      preset: ws.preset || "starter",
      active: ws.id === state.activeId,
      createdAt: ws.createdAt,
    };
  }

  function list() {
    return state.workspaces.map(publicView);
  }

  function get(id) {
    return state.workspaces.find((w) => w.id === id) || null;
  }

  function directoryOf(id) {
    return get(id)?.path || null;
  }

  function ensure(dir, opts2 = {}) {
    const resolved = path.resolve(dir);
    const existing = state.workspaces.find(
      (w) => path.resolve(w.path) === resolved || (process.platform === "win32" && w.path.toLowerCase() === resolved.toLowerCase()),
    );
    if (existing) {
      if (opts2.activate) state.activeId = existing.id;
      save(state);
      return publicView(existing);
    }
    fs.mkdirSync(resolved, { recursive: true });
    const ws = {
      id: workspaceIdFromPath(resolved),
      name: opts2.name?.trim() || path.basename(resolved) || "workspace",
      path: resolved,
      workspaceType: "local",
      preset: opts2.preset || "starter",
      createdAt: Date.now(),
    };
    state.workspaces.push(ws);
    if (opts2.activate !== false) state.activeId = ws.id;
    save(state);
    log(`registered workspace ${ws.name} (${ws.id}) → ${ws.path}`);
    return publicView(ws);
  }

  function activate(id) {
    if (!get(id)) return false;
    state.activeId = id;
    save(state);
    return true;
  }

  function rename(id, name) {
    const ws = get(id);
    if (!ws) return null;
    ws.name = String(name || "").trim() || ws.name;
    save(state);
    return publicView(ws);
  }

  function remove(id) {
    const before = state.workspaces.length;
    state.workspaces = state.workspaces.filter((w) => w.id !== id);
    if (state.activeId === id) state.activeId = state.workspaces[0]?.id || null;
    save(state);
    return state.workspaces.length < before;
  }

  function activeId() {
    return state.activeId;
  }

  return { list, get, directoryOf, ensure, activate, rename, remove, activeId, publicView };
}

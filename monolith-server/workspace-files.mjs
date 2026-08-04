// MONOLITH WorkspaceFileService (Code IDE plan, P0).
// Dependency-free ESM, embedded like the scheduler: native/serve-ui.mjs and the
// Docker server.mjs mount handle() under /__monolith/workspaces/*, behind
// Supabase auth. Every operation authorizes the workspace, canonicalizes the
// path (symlink/junction escapes rejected), enforces protected-file rules,
// uses content-hash revisions to prevent silent overwrites, and appends
// write/delete/rename events to the task ledger (JSONL under dataDir/ledger).
//
// Routes (all JSON):
//   GET  /__monolith/workspaces/:id/tree?path=&depth=
//   GET  /__monolith/workspaces/:id/file?path=
//   PUT  /__monolith/workspaces/:id/file?path=      { content, expectedRevision? }
//   POST /__monolith/workspaces/:id/files           { path, type: "file"|"directory", content? }
//   POST /__monolith/workspaces/:id/move            { from, to }
//   POST /__monolith/workspaces/:id/trash           { path }
//   GET  /__monolith/workspaces/:id/trash
//   POST /__monolith/workspaces/:id/restore         { trashId }
//   GET  /__monolith/workspaces/:id/search?q=&mode=name|content
//   GET  /__monolith/workspaces/:id/ledger?limit=
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const MAX_TREE_DEPTH = 5;
const MAX_DIR_ENTRIES = 2000;
const MAX_SEARCH_RESULTS = 200;
const SEARCH_TIME_BUDGET_MS = 5000;
const SEARCH_SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".turbo", ".pnpm-store", ".next"]);

// Sensitive-by-default files (Code plan "Permissions and sensitive files").
// Metadata is listable; content read, write, move, and trash are denied.
const PROTECTED_NAME_PATTERNS = [
  /^\.env(\..+)?$/i,
  /\.pem$/i,
  /\.key$/i,
  /^id_rsa/i,
  /^id_ed25519/i,
  /^credentials(\..+)?$/i,
  /^secrets(\..+)?$/i,
  /^opencode\.json$/i, // seeded engine config may carry provider keys
];

class OpError extends Error {
  constructor(status, code, extra = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

function isProtectedRelPath(relPath) {
  const segments = relPath.split("/");
  if (segments.includes(".git")) return true;
  const base = segments[segments.length - 1] || "";
  return PROTECTED_NAME_PATTERNS.some((pattern) => pattern.test(base));
}

/** Normalize a client-supplied workspace-relative path. Throws on absolute/traversal forms. */
function normalizeRelPath(input, { allowEmpty = false } = {}) {
  const raw = String(input ?? "").trim().replace(/\\/g, "/");
  if (!raw || raw === "/" || raw === ".") {
    if (allowEmpty) return "";
    throw new OpError(400, "path_required");
  }
  if (/^[a-zA-Z]:/.test(raw) || raw.startsWith("/") || raw.startsWith("\\") || raw.includes("\0")) {
    throw new OpError(400, "path_must_be_workspace_relative");
  }
  const segments = [];
  for (const segment of raw.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === ".." ) throw new OpError(403, "path_traversal_rejected");
    segments.push(segment);
  }
  if (segments.length === 0) {
    if (allowEmpty) return "";
    throw new OpError(400, "path_required");
  }
  return segments.join("/");
}

function realpathSafe(target) {
  try {
    return fs.realpathSync.native(target);
  } catch {
    return fs.realpathSync(target);
  }
}

function isInside(rootReal, candidate) {
  const rel = path.relative(rootReal, candidate);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/**
 * Resolve a normalized relative path against the canonical workspace root and
 * verify the result stays inside it after resolving symlinks/junctions on the
 * deepest existing ancestor (and the target itself when it exists).
 */
function resolveSafe(rootReal, relPath) {
  const target = path.resolve(rootReal, relPath);
  if (!isInside(rootReal, target)) throw new OpError(403, "outside_workspace");
  let probe = target;
  while (!fs.existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe) break;
    probe = parent;
  }
  const probeReal = realpathSafe(probe);
  if (!isInside(rootReal, probeReal)) throw new OpError(403, "symlink_escape_rejected");
  return target;
}

function revisionOf(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);
}

function looksBinary(buffer) {
  const slice = buffer.subarray(0, 8192);
  return slice.includes(0);
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req, maxBytes = 4 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += String(chunk);
      if (Buffer.byteLength(body, "utf8") > maxBytes) {
        reject(new OpError(413, "request_body_too_large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body.trim() ? JSON.parse(body) : {});
      } catch {
        reject(new OpError(400, "invalid_json"));
      }
    });
    req.on("error", reject);
  });
}

function atomicWrite(target, content) {
  const dir = path.dirname(target);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.monolith-tmp-${crypto.randomBytes(6).toString("hex")}`);
  fs.writeFileSync(tmp, content);
  try {
    fs.renameSync(tmp, target);
  } catch (error) {
    fs.rmSync(tmp, { force: true });
    throw error;
  }
}

export function createWorkspaceFileService(options) {
  const dataDir = options.dataDir;
  const resolveWorkspaceRoot = options.resolveWorkspaceRoot;
  const log = options.log || ((...args) => console.log("[workspace-files]", ...args));
  const ledgerDir = path.join(dataDir, "ledger");
  const trashDir = path.join(dataDir, "trash");
  fs.mkdirSync(ledgerDir, { recursive: true });
  fs.mkdirSync(trashDir, { recursive: true });

  function ledgerAppend(event) {
    const entry = { ts: Date.now(), ...event };
    const file = path.join(ledgerDir, `${new Date().toISOString().slice(0, 10)}.jsonl`);
    try {
      fs.appendFileSync(file, JSON.stringify(entry) + "\n");
    } catch (error) {
      log("ledger append failed:", error.message);
    }
    return entry;
  }

  function ledgerRead(workspaceId, limit) {
    const files = fs
      .readdirSync(ledgerDir)
      .filter((file) => file.endsWith(".jsonl"))
      .sort()
      .slice(-3);
    const events = [];
    for (const file of files) {
      for (const line of fs.readFileSync(path.join(ledgerDir, file), "utf8").split("\n")) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.workspaceId === workspaceId) events.push(event);
        } catch {
          // skip corrupt line
        }
      }
    }
    return events.slice(-limit);
  }

  async function workspaceRootOf(workspaceId) {
    const root = await resolveWorkspaceRoot(workspaceId);
    if (!root) throw new OpError(404, "workspace_not_found");
    let rootReal;
    try {
      rootReal = realpathSafe(root);
    } catch {
      throw new OpError(404, "workspace_root_missing");
    }
    if (!fs.statSync(rootReal).isDirectory()) throw new OpError(404, "workspace_root_missing");
    return rootReal;
  }

  function entryFor(rootReal, relPath, dirent, stat) {
    const entryRel = relPath ? `${relPath}/${dirent.name}` : dirent.name;
    return {
      name: dirent.name,
      path: entryRel,
      type: dirent.isDirectory() ? "directory" : "file",
      size: dirent.isDirectory() ? null : stat?.size ?? null,
      mtime: stat?.mtimeMs ?? null,
      protected: isProtectedRelPath(entryRel),
      symlink: dirent.isSymbolicLink(),
    };
  }

  function listTree(rootReal, relPath, depth) {
    const target = relPath ? resolveSafe(rootReal, relPath) : rootReal;
    if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
      throw new OpError(404, "directory_not_found");
    }
    const dirents = fs.readdirSync(target, { withFileTypes: true });
    const truncated = dirents.length > MAX_DIR_ENTRIES;
    const entries = [];
    for (const dirent of dirents.slice(0, MAX_DIR_ENTRIES)) {
      let stat = null;
      try {
        stat = fs.statSync(path.join(target, dirent.name));
      } catch {
        continue; // broken symlink etc.
      }
      const entry = entryFor(rootReal, relPath, dirent, stat);
      if (entry.type === "directory" && depth > 1 && !SEARCH_SKIP_DIRS.has(dirent.name)) {
        try {
          entry.children = listTree(rootReal, entry.path, depth - 1);
        } catch {
          entry.children = { entries: [], truncated: false };
        }
      }
      entries.push(entry);
    }
    entries.sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type === "directory" ? -1 : 1,
    );
    return { entries, truncated };
  }

  function readTextFile(rootReal, relPath) {
    if (isProtectedRelPath(relPath)) throw new OpError(403, "protected_file");
    const target = resolveSafe(rootReal, relPath);
    if (!fs.existsSync(target)) throw new OpError(404, "file_not_found");
    const stat = fs.statSync(target);
    if (stat.isDirectory()) throw new OpError(400, "is_a_directory");
    if (stat.size > MAX_TEXT_BYTES) throw new OpError(413, "file_too_large", { size: stat.size });
    const buffer = fs.readFileSync(target);
    if (looksBinary(buffer)) throw new OpError(415, "binary_file", { size: stat.size });
    return {
      path: relPath,
      content: buffer.toString("utf8"),
      revision: revisionOf(buffer),
      size: stat.size,
      mtime: stat.mtimeMs,
    };
  }

  function writeTextFile(rootReal, relPath, content, expectedRevision) {
    if (isProtectedRelPath(relPath)) throw new OpError(403, "protected_file");
    if (typeof content !== "string") throw new OpError(400, "content_must_be_string");
    const buffer = Buffer.from(content, "utf8");
    if (buffer.length > MAX_TEXT_BYTES) throw new OpError(413, "file_too_large", { size: buffer.length });
    const target = resolveSafe(rootReal, relPath);
    const exists = fs.existsSync(target);
    if (exists && fs.statSync(target).isDirectory()) throw new OpError(400, "is_a_directory");
    if (exists) {
      const current = revisionOf(fs.readFileSync(target));
      if (!expectedRevision) {
        throw new OpError(409, "revision_required", { currentRevision: current });
      }
      if (expectedRevision !== current) {
        throw new OpError(409, "revision_conflict", { currentRevision: current });
      }
    } else if (expectedRevision) {
      throw new OpError(409, "file_deleted_externally");
    }
    atomicWrite(target, buffer);
    return { path: relPath, revision: revisionOf(buffer), size: buffer.length, created: !exists };
  }

  function createEntry(rootReal, relPath, type, content) {
    if (isProtectedRelPath(relPath)) throw new OpError(403, "protected_file");
    const target = resolveSafe(rootReal, relPath);
    if (fs.existsSync(target)) throw new OpError(409, "already_exists");
    if (type === "directory") {
      fs.mkdirSync(target, { recursive: true });
      return { path: relPath, type: "directory" };
    }
    const buffer = Buffer.from(typeof content === "string" ? content : "", "utf8");
    atomicWrite(target, buffer);
    return { path: relPath, type: "file", revision: revisionOf(buffer), size: buffer.length };
  }

  function moveEntry(rootReal, fromRel, toRel) {
    if (isProtectedRelPath(fromRel) || isProtectedRelPath(toRel)) throw new OpError(403, "protected_file");
    const from = resolveSafe(rootReal, fromRel);
    const to = resolveSafe(rootReal, toRel);
    if (!fs.existsSync(from)) throw new OpError(404, "file_not_found");
    if (fs.existsSync(to)) throw new OpError(409, "destination_exists");
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(from, to);
    return { from: fromRel, to: toRel };
  }

  function trashEntry(rootReal, workspaceId, relPath) {
    if (isProtectedRelPath(relPath)) throw new OpError(403, "protected_file");
    const target = resolveSafe(rootReal, relPath);
    if (!fs.existsSync(target)) throw new OpError(404, "file_not_found");
    const stat = fs.statSync(target);
    const trashId = crypto.randomBytes(8).toString("hex");
    const slot = path.join(trashDir, trashId);
    fs.mkdirSync(slot, { recursive: true });
    fs.renameSync(target, path.join(slot, "payload"));
    fs.writeFileSync(
      path.join(slot, "meta.json"),
      JSON.stringify(
        {
          trashId,
          workspaceId,
          originalPath: relPath,
          type: stat.isDirectory() ? "directory" : "file",
          deletedAt: Date.now(),
        },
        null,
        2,
      ) + "\n",
    );
    return { trashId, path: relPath };
  }

  function listTrash(workspaceId) {
    const items = [];
    for (const trashId of fs.readdirSync(trashDir)) {
      try {
        const meta = JSON.parse(fs.readFileSync(path.join(trashDir, trashId, "meta.json"), "utf8"));
        if (meta.workspaceId === workspaceId) items.push(meta);
      } catch {
        // ignore malformed slot
      }
    }
    items.sort((a, b) => b.deletedAt - a.deletedAt);
    return items;
  }

  function restoreEntry(rootReal, workspaceId, trashId) {
    if (!/^[a-f0-9]{16}$/.test(String(trashId || ""))) throw new OpError(400, "trash_id_invalid");
    const slot = path.join(trashDir, trashId);
    let meta;
    try {
      meta = JSON.parse(fs.readFileSync(path.join(slot, "meta.json"), "utf8"));
    } catch {
      throw new OpError(404, "trash_item_not_found");
    }
    if (meta.workspaceId !== workspaceId) throw new OpError(404, "trash_item_not_found");
    const target = resolveSafe(rootReal, normalizeRelPath(meta.originalPath));
    if (fs.existsSync(target)) throw new OpError(409, "destination_exists", { path: meta.originalPath });
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.renameSync(path.join(slot, "payload"), target);
    fs.rmSync(slot, { recursive: true, force: true });
    return { trashId, path: meta.originalPath };
  }

  function search(rootReal, query, mode) {
    const needle = query.toLowerCase();
    const results = [];
    const deadline = Date.now() + SEARCH_TIME_BUDGET_MS;
    const stack = [""];
    while (stack.length && results.length < MAX_SEARCH_RESULTS && Date.now() < deadline) {
      const relDir = stack.pop();
      const dir = relDir ? path.join(rootReal, relDir) : rootReal;
      let dirents;
      try {
        dirents = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const dirent of dirents) {
        if (results.length >= MAX_SEARCH_RESULTS) break;
        const entryRel = relDir ? `${relDir}/${dirent.name}` : dirent.name;
        if (dirent.isDirectory()) {
          if (!SEARCH_SKIP_DIRS.has(dirent.name)) stack.push(entryRel);
          if (mode === "name" && dirent.name.toLowerCase().includes(needle)) {
            results.push({ path: entryRel, type: "directory" });
          }
          continue;
        }
        if (dirent.isSymbolicLink()) continue;
        if (mode === "name") {
          if (dirent.name.toLowerCase().includes(needle)) {
            results.push({ path: entryRel, type: "file" });
          }
          continue;
        }
        if (isProtectedRelPath(entryRel)) continue;
        let stat;
        try {
          stat = fs.statSync(path.join(dir, dirent.name));
        } catch {
          continue;
        }
        if (stat.size > 512 * 1024) continue;
        let buffer;
        try {
          buffer = fs.readFileSync(path.join(dir, dirent.name));
        } catch {
          continue;
        }
        if (looksBinary(buffer)) continue;
        const lines = buffer.toString("utf8").split("\n");
        for (let i = 0; i < lines.length && results.length < MAX_SEARCH_RESULTS; i++) {
          if (lines[i].toLowerCase().includes(needle)) {
            results.push({ path: entryRel, type: "file", line: i + 1, preview: lines[i].trim().slice(0, 200) });
          }
        }
      }
    }
    return { results, truncated: results.length >= MAX_SEARCH_RESULTS };
  }

  function actorOf(req) {
    return req.monolithUser?.email || req.monolithUser?.id || "local";
  }

  /** Returns true when the request was handled. */
  function handle(req, res, urlPath, searchParams) {
    const match = urlPath.match(/^\/__monolith\/workspaces\/([^/]+)\/([a-z]+)$/);
    if (!match) return false;
    const workspaceId = match[1];
    const action = match[2];
    const params = searchParams || new URL(req.url, "http://x").searchParams;

    const respond = async () => {
      const rootReal = await workspaceRootOf(workspaceId);
      const actor = actorOf(req);

      if (req.method === "GET" && action === "tree") {
        const relPath = normalizeRelPath(params.get("path") || "", { allowEmpty: true });
        const depth = Math.min(MAX_TREE_DEPTH, Math.max(1, Number(params.get("depth")) || 1));
        sendJson(res, 200, { ok: true, root: relPath, ...listTree(rootReal, relPath, depth) });
        return;
      }

      if (req.method === "GET" && action === "file") {
        const relPath = normalizeRelPath(params.get("path"));
        sendJson(res, 200, { ok: true, file: readTextFile(rootReal, relPath) });
        return;
      }

      if (req.method === "PUT" && action === "file") {
        const relPath = normalizeRelPath(params.get("path"));
        const body = await readJsonBody(req);
        const expected = body.expectedRevision || req.headers["if-match"] || "";
        const result = writeTextFile(rootReal, relPath, body.content, String(expected || "").trim());
        ledgerAppend({
          workspaceId, actor, op: result.created ? "create" : "write",
          path: relPath, revision: result.revision, bytes: result.size, status: "ok",
        });
        sendJson(res, 200, { ok: true, ...result });
        return;
      }

      if (req.method === "POST" && action === "files") {
        const body = await readJsonBody(req);
        const relPath = normalizeRelPath(body.path);
        const type = body.type === "directory" ? "directory" : "file";
        const result = createEntry(rootReal, relPath, type, body.content);
        ledgerAppend({ workspaceId, actor, op: "create", path: relPath, type, status: "ok" });
        sendJson(res, 201, { ok: true, ...result });
        return;
      }

      if (req.method === "POST" && action === "move") {
        const body = await readJsonBody(req);
        const result = moveEntry(rootReal, normalizeRelPath(body.from), normalizeRelPath(body.to));
        ledgerAppend({ workspaceId, actor, op: "move", path: result.from, to: result.to, status: "ok" });
        sendJson(res, 200, { ok: true, ...result });
        return;
      }

      if (req.method === "POST" && action === "trash") {
        const body = await readJsonBody(req);
        const result = trashEntry(rootReal, workspaceId, normalizeRelPath(body.path));
        ledgerAppend({ workspaceId, actor, op: "trash", path: result.path, trashId: result.trashId, status: "ok" });
        sendJson(res, 200, { ok: true, ...result });
        return;
      }

      if (req.method === "GET" && action === "trash") {
        sendJson(res, 200, { ok: true, items: listTrash(workspaceId) });
        return;
      }

      if (req.method === "POST" && action === "restore") {
        const body = await readJsonBody(req);
        const result = restoreEntry(rootReal, workspaceId, body.trashId);
        ledgerAppend({ workspaceId, actor, op: "restore", path: result.path, trashId: result.trashId, status: "ok" });
        sendJson(res, 200, { ok: true, ...result });
        return;
      }

      if (req.method === "GET" && action === "search") {
        const query = String(params.get("q") || "").trim();
        if (query.length < 2) throw new OpError(400, "query_too_short");
        const mode = params.get("mode") === "name" ? "name" : "content";
        sendJson(res, 200, { ok: true, mode, ...search(rootReal, query, mode) });
        return;
      }

      if (req.method === "GET" && action === "ledger") {
        const limit = Math.min(500, Math.max(1, Number(params.get("limit")) || 100));
        sendJson(res, 200, { ok: true, events: ledgerRead(workspaceId, limit) });
        return;
      }

      throw new OpError(405, "method_not_allowed");
    };

    respond().catch((error) => {
      if (error instanceof OpError) {
        if (error.status === 403) {
          ledgerAppend({
            workspaceId, actor: actorOf(req), op: action,
            path: params.get("path") || "", status: "blocked", rule: error.code,
          });
        }
        sendJson(res, error.status, { ok: false, error: error.code, ...error.extra });
        return;
      }
      log(`${action} failed:`, error.message);
      sendJson(res, 500, { ok: false, error: "internal_error" });
    });
    return true;
  }

  return { handle };
}

/**
 * Workspace-root resolver backed by the OpenWork engine's workspace list
 * (GET {openworkUrl}/workspaces). Results cached briefly; only workspaces the
 * engine knows about are addressable — arbitrary disk paths are not.
 */
export function createEngineWorkspaceResolver({ openworkUrl, token, hostToken, cacheMs = 10_000 }) {
  const base = String(openworkUrl || "").replace(/\/+$/, "");
  let cache = { at: 0, byId: new Map() };

  return async function resolveWorkspaceRoot(workspaceId) {
    if (Date.now() - cache.at > cacheMs) {
      const headers = {};
      if (token) headers.authorization = `Bearer ${token}`;
      if (hostToken) headers["x-openwork-host-token"] = hostToken;
      const response = await fetch(`${base}/workspaces`, {
        headers,
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`engine /workspaces -> ${response.status}`);
      const payload = await response.json().catch(() => null);
      const items = payload?.items || payload?.workspaces || [];
      const byId = new Map();
      for (const workspace of items) {
        const root = workspace?.directory || workspace?.path;
        if (workspace?.id && typeof root === "string" && root.trim()) {
          byId.set(String(workspace.id), root.trim());
        }
      }
      cache = { at: Date.now(), byId };
    }
    return cache.byId.get(String(workspaceId)) || null;
  };
}

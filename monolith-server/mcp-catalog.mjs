// MONOLITH MCP catalog (Tools guide Tier 4): a curated list of well-known MCP
// servers users can enable with one click (+ token where needed). Enabled
// servers are stored in dataDir/mcp-servers.json in opencode.json "mcp" shape;
// the native seeder merges them into every workspace config on seed.
//
// Catalog entries live in mcp-catalog-data.mjs. Dependency-free ESM, embedded
// like the scheduler under /__monolith/mcp/*.
//
// Routes:
//   GET    /__monolith/mcp/catalog        catalog + enabled/builtin status
//   GET    /__monolith/mcp/servers        enabled servers (secrets masked)
//   POST   /__monolith/mcp/servers        { id, config: { key: value } } enable
//   DELETE /__monolith/mcp/servers/:id    disable
import fs from "node:fs";
import path from "node:path";

import { CATALOG } from "./mcp-catalog-data.mjs";

export { CATALOG };

const MASK = "••••••••";

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req, maxBytes = 256 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += String(chunk);
      if (Buffer.byteLength(body, "utf8") > maxBytes) {
        reject(new Error("request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body.trim() ? JSON.parse(body) : {});
      } catch {
        reject(new Error("invalid json"));
      }
    });
    req.on("error", reject);
  });
}

function substitute(template, config) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => String(config[key] ?? ""));
}

function hasUnresolvedPlaceholder(template, config) {
  return /\{([a-zA-Z0-9_]+)\}/.test(template) && !substitute(template, config).trim();
}

/** Build a concrete opencode.json "mcp" entry from a catalog item + config. */
export function buildEntry(item, config) {
  for (const field of item.config || []) {
    const value = String(config[field.key] ?? "").trim();
    if (field.required && !value) throw new Error(`config_required:${field.key}`);
  }
  if (item.remote) {
    const entry = { type: "remote", url: substitute(item.remote.url, config), enabled: true };
    const headers = {};
    for (const [name, template] of Object.entries(item.remote.headers || {})) {
      const value = substitute(template, config).trim();
      if (value && !hasUnresolvedPlaceholder(template, config)) headers[name] = value;
    }
    if (Object.keys(headers).length) entry.headers = headers;
    return entry;
  }
  const command = [];
  for (const part of item.local.command) {
    if (hasUnresolvedPlaceholder(part, config)) continue; // optional arg left blank
    command.push(substitute(part, config));
  }
  for (const field of item.config || []) {
    const value = String(config[field.key] ?? "").trim();
    if (field.arg && value) command.push(substitute(field.arg, config));
  }
  const entry = { type: "local", command, enabled: true };
  const environment = {};
  for (const [name, template] of Object.entries(item.local.environment || {})) {
    if (hasUnresolvedPlaceholder(template, config)) continue;
    environment[name] = substitute(template, config);
  }
  if (Object.keys(environment).length) entry.environment = environment;
  return entry;
}

function maskEntry(entry, item, config) {
  const secrets = (item?.config || [])
    .filter((field) => field.secret)
    .map((field) => String(config?.[field.key] ?? "").trim())
    .filter((value) => value.length > 0);
  let json = JSON.stringify(entry);
  for (const secret of secrets) {
    json = json.split(secret).join(MASK);
  }
  return JSON.parse(json);
}

/**
 * The store is PER-USER: MCP servers carry personal tokens and accounts, so
 * each authenticated user (Supabase email/id; "local" in native single-user
 * mode) manages their own set. Shape: { users: { <actor>: { servers } } }.
 * A legacy flat { servers } store migrates to users.local on first load.
 */
export function createMcpCatalog(options) {
  const dataDir = options.dataDir;
  const log = options.log || ((...args) => console.log("[mcp-catalog]", ...args));
  const storePath = path.join(dataDir, "mcp-servers.json");
  fs.mkdirSync(dataDir, { recursive: true });

  function loadStore() {
    try {
      const parsed = JSON.parse(fs.readFileSync(storePath, "utf8"));
      if (parsed && typeof parsed.users === "object") return parsed;
      if (parsed && typeof parsed.servers === "object") {
        return { users: { local: { servers: parsed.servers } } };
      }
      return { users: {} };
    } catch {
      return { users: {} };
    }
  }

  function saveStore(store) {
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2) + "\n");
  }

  function actorOf(req) {
    return req.monolithUser?.email || req.monolithUser?.id || "local";
  }

  function serversOf(store, actor) {
    return store.users[actor]?.servers || {};
  }

  function catalogView(store, actor) {
    const servers = serversOf(store, actor);
    return CATALOG.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      description: item.description,
      docsUrl: item.docsUrl || null,
      notes: item.notes || null,
      builtin: Boolean(item.builtin),
      kind: item.builtin ? "builtin" : item.remote ? "remote" : "local",
      config: (item.config || []).map(({ key, label, secret, required }) => ({
        key, label, secret: Boolean(secret), required: Boolean(required),
      })),
      enabled: Boolean(item.builtin) || Boolean(servers[item.id]),
    }));
  }

  function maskedServers(store, actor) {
    const result = {};
    for (const [id, record] of Object.entries(serversOf(store, actor))) {
      const item = CATALOG.find((entry) => entry.id === id);
      result[id] = {
        entry: maskEntry(record.entry, item, record.config),
        enabledAt: record.enabledAt,
      };
    }
    return result;
  }

  /** Returns true when the request was handled. */
  function handle(req, res, urlPath) {
    if (!urlPath.startsWith("/__monolith/mcp/")) return false;
    const rest = urlPath.slice("/__monolith/mcp/".length);

    const respond = async () => {
      const store = loadStore();
      const actor = actorOf(req);

      if (req.method === "GET" && rest === "catalog") {
        sendJson(res, 200, { ok: true, catalog: catalogView(store, actor) });
        return;
      }

      if (req.method === "GET" && rest === "servers") {
        sendJson(res, 200, { ok: true, servers: maskedServers(store, actor) });
        return;
      }

      if (req.method === "POST" && rest === "servers") {
        const body = await readJsonBody(req);
        const item = CATALOG.find((entry) => entry.id === body.id);
        if (!item) {
          sendJson(res, 404, { ok: false, error: "unknown_catalog_id" });
          return;
        }
        if (item.builtin) {
          sendJson(res, 400, { ok: false, error: "builtin_always_enabled" });
          return;
        }
        const config = body.config && typeof body.config === "object" ? body.config : {};
        let entry;
        try {
          entry = buildEntry(item, config);
        } catch (error) {
          sendJson(res, 400, { ok: false, error: error.message });
          return;
        }
        store.users[actor] = store.users[actor] || { servers: {} };
        store.users[actor].servers[item.id] = { entry, config, enabledAt: Date.now() };
        saveStore(store);
        log(`enabled ${item.id} for ${actor}`);
        sendJson(res, 200, { ok: true, id: item.id, entry: maskEntry(entry, item, config) });
        return;
      }

      const deleteMatch = rest.match(/^servers\/([a-z0-9-]+)$/);
      if (req.method === "DELETE" && deleteMatch) {
        const id = deleteMatch[1];
        if (!serversOf(store, actor)[id]) {
          sendJson(res, 404, { ok: false, error: "not_enabled" });
          return;
        }
        delete store.users[actor].servers[id];
        saveStore(store);
        log(`disabled ${id} for ${actor}`);
        sendJson(res, 200, { ok: true });
        return;
      }

      sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    };

    respond().catch((error) => {
      sendJson(res, 500, { ok: false, error: error.message });
    });
    return true;
  }

  return { handle };
}

/**
 * Enabled catalog entries in opencode.json "mcp" shape — used by the native
 * seeder. Native runs single-user, so this unions all stored users (in
 * practice: the one "local" or signed-in user). Hosted multi-user seeding
 * stays per-container and lands with upgrade-plan Phases 5/6.
 */
export function loadEnabledCatalogEntries(dataDir) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(dataDir, "mcp-servers.json"), "utf8"));
    const users = parsed?.users || (parsed?.servers ? { local: { servers: parsed.servers } } : {});
    const entries = {};
    for (const user of Object.values(users)) {
      for (const [id, record] of Object.entries(user?.servers || {})) {
        if (record?.entry && typeof record.entry === "object") entries[id] = record.entry;
      }
    }
    return entries;
  } catch {
    return {};
  }
}

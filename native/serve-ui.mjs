// Tiny static server for the built OpenWork SPA (openwork/apps/app/dist).
// SPA fallback: unknown non-file routes return index.html so react-router's
// BrowserRouter works on deep links. No external deps.
//
// Run:  node native/serve-ui.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { createSupabaseRequestAuthenticator } from "../monolith-server/auth.mjs";
import { createMonolithScheduler } from "../monolith-server/index.mjs";
import {
  createWorkspaceFileService,
  createEngineWorkspaceResolver,
} from "../monolith-server/workspace-files.mjs";
import { createMonolithChat } from "../monolith-server/chat.mjs";
import { createMcpCatalog } from "../monolith-server/mcp-catalog.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.join(HERE, ".env")); } catch { /* no .env yet */ }

const PORT = Number(process.env.UI_PORT || 8080);
const ROOT = path.resolve(HERE, "..", "openwork", "apps", "app", "dist");

// MONOLITH sidecar features (scheduled tasks) share this server under /__monolith/*.
const scheduler = createMonolithScheduler({
  dataDir: path.join(HERE, "data"),
  openworkUrl: `http://127.0.0.1:${process.env.OPENWORK_PORT || 8787}`,
  token: process.env.OPENWORK_TOKEN || "",
  hostToken: process.env.OPENWORK_HOST_TOKEN || "",
  log: (...args) => console.log("[scheduler]", ...args),
});
const monolithAuth = createSupabaseRequestAuthenticator();

// Code IDE plan P0: authorized workspace file API (tree/read/write/trash/search + ledger).
const workspaceFiles = createWorkspaceFileService({
  dataDir: path.join(HERE, "data"),
  resolveWorkspaceRoot: createEngineWorkspaceResolver({
    openworkUrl: `http://127.0.0.1:${process.env.OPENWORK_PORT || 8787}`,
    token: process.env.OPENWORK_TOKEN || "",
    hostToken: process.env.OPENWORK_HOST_TOKEN || "",
  }),
  log: (...args) => console.log("[workspace-files]", ...args),
});

// Chat/RAG plan P0: product-owned persistent chat + streaming orchestrator.
const monolithChat = createMonolithChat({
  dataDir: path.join(HERE, "data"),
  log: (...args) => console.log("[chat]", ...args),
});

// Tools guide Tier 4: curated MCP catalog; enabled servers flow into every
// workspace opencode.json via seed-opencode-config.mjs.
const mcpCatalog = createMcpCatalog({
  dataDir: path.join(HERE, "data"),
  log: (...args) => console.log("[mcp-catalog]", ...args),
});

if (!fs.existsSync(path.join(ROOT, "index.html"))) {
  console.error(`[serve-ui] no build found at ${ROOT}\n           run  native\\setup.cmd  (or  node native/build-ui.mjs)  first.`);
  process.exit(1);
}

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".ico": "image/x-icon", ".webp": "image/webp",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8", ".wasm": "application/wasm",
};

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, headers);
  res.end(body);
};

function envValue(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function monolithRuntimeConfigScript() {
  const config = {
    supabaseUrl: envValue("VITE_SUPABASE_URL", "SUPABASE_URL"),
    supabasePublishableKey: envValue(
      "VITE_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_PUBLISHABLE_KEY",
      "VITE_SUPABASE_ANON_KEY",
      "SUPABASE_ANON_KEY",
    ),
    supabaseAnonKey: envValue("VITE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"),
    requireSignin: envValue("VITE_MONOLITH_REQUIRE_SIGNIN", "MONOLITH_REQUIRE_AUTH"),
  };
  const json = JSON.stringify(config).replace(/</g, "\\u003c");
  return `<script>window.__MONOLITH_RUNTIME_CONFIG__=${json};</script>`;
}

function readStaticResponseBody(file) {
  const body = fs.readFileSync(file);
  if (path.basename(file) !== "index.html") return body;
  const html = body.toString("utf8");
  const script = monolithRuntimeConfigScript();
  return Buffer.from(
    html.includes("</head>") ? html.replace("</head>", `${script}</head>`) : `${script}${html}`,
    "utf8",
  );
}

function readJsonBody(req, maxBytes = 1024 * 1024) {
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

function pickDirectoryNative() {
  return new Promise((resolve, reject) => {
    if (process.platform !== "win32") {
      resolve({ path: null, cancelled: false, unsupported: true });
      return;
    }

    const script = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = "Select OpenWork workspace folder"
$dialog.ShowNewFolderButton = $true
$result = $dialog.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
  @{ path = $dialog.SelectedPath; cancelled = $false } | ConvertTo-Json -Compress
} else {
  @{ path = $null; cancelled = $true } | ConvertTo-Json -Compress
}
`;

    const child = spawn("powershell.exe", [
      "-NoProfile",
      "-STA",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      script,
    ], {
      windowsHide: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("folder picker timed out"));
    }, 5 * 60 * 1000);

    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(stderr.trim() || `folder picker exited with code ${code}`));
        return;
      }
      const jsonLine = stdout
        .trim()
        .split(/\r?\n/)
        .reverse()
        .find((line) => line.trim().startsWith("{"));
      if (!jsonLine) {
        resolve({ path: null, cancelled: true });
        return;
      }
      try {
        resolve(JSON.parse(jsonLine));
      } catch {
        resolve({ path: null, cancelled: false });
      }
    });
  });
}

function seedOpencodeConfigNative(folderPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      path.join(HERE, "seed-opencode-config.mjs"),
      folderPath,
    ], {
      cwd: path.resolve(HERE, ".."),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("opencode config seeding timed out"));
    }, 120 * 1000);

    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(stderr.trim() || `opencode config seed exited with code ${code}`));
        return;
      }
      resolve(stdout);
    });
  });
}

function revealDirectoryNative(folderPath) {
  return new Promise((resolve, reject) => {
    if (process.platform !== "win32") {
      resolve({ ok: false, unsupported: true });
      return;
    }
    // explorer.exe returns non-zero even on success for some argument forms,
    // so treat spawn failure (not exit code) as the real error.
    const child = spawn("explorer.exe", [folderPath], { windowsHide: false, stdio: "ignore" });
    child.on("error", (error) => reject(error));
    child.on("spawn", () => resolve({ ok: true }));
  });
}

function monolithAuthOptions(req, urlPath) {
  const admin =
    (req.method !== "GET" && urlPath === "/__monolith/org") ||
    urlPath === "/__monolith/org/usage";
  return { admin };
}

http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);

    if (
      urlPath.startsWith("/__monolith/") &&
      !(await monolithAuth.authorize(req, res, monolithAuthOptions(req, urlPath)))
    ) {
      return;
    }

    if (scheduler.handle(req, res, urlPath)) return;
    if (workspaceFiles.handle(req, res, urlPath)) return;
    if (monolithChat.handle(req, res, urlPath)) return;
    if (mcpCatalog.handle(req, res, urlPath)) return;

    if (req.method === "POST" && urlPath === "/__monolith/reveal-directory") {
      readJsonBody(req)
        .then((payload) => {
          const folderPath = typeof payload?.path === "string" ? payload.path.trim() : "";
          if (!folderPath) {
            send(res, 400, JSON.stringify({ ok: false, error: "path_required" }), {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "no-store",
            });
            return null;
          }
          return revealDirectoryNative(folderPath);
        })
        .then((payload) => {
          if (!payload) return;
          const unsupported = payload.unsupported === true;
          send(res, unsupported ? 501 : 200, JSON.stringify(payload), {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
          });
        })
        .catch((error) => {
          console.error("[serve-ui] reveal directory failed:", error.message);
          send(res, 500, JSON.stringify({ ok: false, error: "reveal_failed" }), {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
          });
        });
      return;
    }

    if (req.method === "POST" && urlPath === "/__monolith/pick-directory") {
      pickDirectoryNative()
        .then((payload) => {
          const unsupported = payload && typeof payload === "object" && payload.unsupported === true;
          send(res, unsupported ? 501 : 200, JSON.stringify(payload), {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
          });
        })
        .catch((error) => {
          console.error("[serve-ui] folder picker failed:", error.message);
          send(res, 500, JSON.stringify({ path: null, cancelled: false, error: "folder_picker_failed" }), {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
          });
        });
      return;
    }

    if (req.method === "POST" && urlPath === "/__monolith/seed-opencode-config") {
      readJsonBody(req)
        .then((payload) => {
          const folderPath = typeof payload?.folderPath === "string" ? payload.folderPath.trim() : "";
          if (!folderPath) {
            send(res, 400, JSON.stringify({ ok: false, error: "folder_path_required" }), {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "no-store",
            });
            return null;
          }
          return seedOpencodeConfigNative(folderPath);
        })
        .then((output) => {
          if (output === null) return;
          send(res, 200, JSON.stringify({ ok: true }), {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
          });
        })
        .catch((error) => {
          console.error("[serve-ui] opencode config seed failed:", error.message);
          send(res, 500, JSON.stringify({ ok: false, error: "opencode_config_seed_failed" }), {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
          });
        });
      return;
    }

    let rel = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
    let file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) return send(res, 403, "forbidden");

    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");

    if (!fs.existsSync(file)) {
      // Asset request that misses -> 404; route request -> SPA fallback.
      if (path.extname(urlPath)) return send(res, 404, "not found");
      file = path.join(ROOT, "index.html");
    }

    const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
    const cache = file.includes(`${path.sep}assets${path.sep}`)
      ? "public, max-age=31536000, immutable"
      : "no-cache";
    send(res, 200, readStaticResponseBody(file), { "content-type": type, "cache-control": cache });
  } catch (e) {
    send(res, 500, "server error");
    console.error("[serve-ui]", e.message);
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`[serve-ui] http://127.0.0.1:${PORT}  (serving ${ROOT})`);
});

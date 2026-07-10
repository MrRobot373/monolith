// Native (no-Docker) launcher/supervisor for MONOLITH = OpenWork UI + engine on Ollama.
// Starts everything as children of this process; one console owns the stack.
// Ctrl+C (or closing the window) stops all of it.
//
// Run:  native\start.cmd   (or:  node native/start.mjs)
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.join(HERE, ".env")); } catch {
  console.error("[start] native/.env not found — run native\\setup.cmd first."); process.exit(1);
}

const isWin = process.platform === "win32";
const OPENWORK_PORT = process.env.OPENWORK_PORT || "8787";
const OPENCODE_PORT = process.env.OPENCODE_PORT || "4096";
const UI_PORT = process.env.UI_PORT || "8080";
const POOL_PORT = process.env.POOL_PORT || "11435";
const WS = process.env.OPENWORK_WORKSPACE || path.join(HERE, "workspace");
const SERVER_CONFIG = process.env.OPENWORK_SERVER_CONFIG || path.join(homedir(), ".config", "openwork", "server.json");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5-coder:7b";
const OLLAMA_TAGS = "http://localhost:11434/api/tags";
const hasPoolKeys = Object.keys(process.env).some((k) => /^OLLAMA_KEY_\d+$/.test(k) && (process.env[k] || "").trim());

fs.mkdirSync(WS, { recursive: true });
const dist = path.resolve(HERE, "..", "openwork", "apps", "app", "dist");
if (!fs.existsSync(path.join(dist, "index.html"))) {
  console.error("[start] UI not built — run native\\setup.cmd (or node native/build-ui.mjs) first."); process.exit(1);
}

const children = [];
// Node scripts must be spawned WITHOUT a shell (process.execPath contains a space
// on Windows, e.g. "C:\Program Files\nodejs\node.exe"). External commands like
// `openwork`/`ollama` are .cmd/.exe on PATH and need shell:true on Windows.
function launchNode(name, script, extraEnv = {}) {
  return track(name, spawn(process.execPath, [script], {
    env: { ...process.env, ...extraEnv }, shell: false, stdio: ["ignore", "pipe", "pipe"],
  }));
}
function launchCmd(name, cmd, args, extraEnv = {}) {
  // Under shell:true args are concatenated, so quote any that contain spaces.
  const quoted = args.map((a) => (/\s/.test(a) ? `"${a}"` : a));
  return track(name, spawn(cmd, quoted, {
    env: { ...process.env, ...extraEnv }, shell: isWin, stdio: ["ignore", "pipe", "pipe"],
  }));
}
function track(name, child) {
  const tag = `[${name}]`;
  const pipe = (stream) => stream.on("data", (d) => process.stdout.write(`${tag} ${d}`));
  pipe(child.stdout); pipe(child.stderr);
  child.on("exit", (code) => console.log(`${tag} exited (${code})`));
  children.push(child);
  return child;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(url, label, tries = 60, gapMs = 1000) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return true; } catch {}
    await sleep(gapMs);
  }
  console.error(`[start] timed out waiting for ${label} (${url})`);
  return false;
}

function workspaceNameFromPath(workspacePath) {
  return path.basename(path.resolve(workspacePath)) || "workspace";
}

function pathKey(workspacePath) {
  const resolved = path.resolve(workspacePath);
  return isWin ? resolved.toLowerCase() : resolved;
}

function readServerConfig() {
  try {
    return JSON.parse(fs.readFileSync(SERVER_CONFIG, "utf8"));
  } catch {
    return {};
  }
}

function writeServerConfig(config) {
  fs.mkdirSync(path.dirname(SERVER_CONFIG), { recursive: true });
  fs.writeFileSync(SERVER_CONFIG, `${JSON.stringify(config, null, 2)}\n`);
}

function ensureServerConfigIncludesPrimaryWorkspace() {
  const config = readServerConfig();
  const workspaces = Array.isArray(config.workspaces) ? config.workspaces : [];
  const authorizedRoots = Array.isArray(config.authorizedRoots) ? config.authorizedRoots : [];
  const primaryKey = pathKey(WS);
  let changed = false;

  if (!workspaces.some((workspace) => typeof workspace?.path === "string" && workspace.path.trim() && pathKey(workspace.path) === primaryKey)) {
    workspaces.push({
      path: WS,
      name: workspaceNameFromPath(WS),
      preset: "starter",
      workspaceType: "local",
    });
    changed = true;
  }

  if (!authorizedRoots.some((root) => typeof root === "string" && root.trim() && pathKey(root) === primaryKey)) {
    authorizedRoots.push(WS);
    changed = true;
  }

  if (changed || !Array.isArray(config.workspaces) || !Array.isArray(config.authorizedRoots)) {
    writeServerConfig({ ...config, workspaces, authorizedRoots });
  }
}

function persistedLocalWorkspaces() {
  const config = readServerConfig();
  const workspaces = Array.isArray(config.workspaces) ? config.workspaces : [];
  const seen = new Set();
  return workspaces
    .filter((workspace) => workspace && workspace.workspaceType !== "remote" && typeof workspace.path === "string" && workspace.path.trim())
    .map((workspace) => ({
      path: path.resolve(workspace.path),
      name: typeof workspace.name === "string" && workspace.name.trim() ? workspace.name.trim() : workspaceNameFromPath(workspace.path),
      preset: typeof workspace.preset === "string" && workspace.preset.trim() ? workspace.preset.trim() : "starter",
    }))
    .filter((workspace) => {
      const key = pathKey(workspace.path);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function replayPersistedLocalWorkspaces() {
  const primaryKey = pathKey(WS);
  const extras = persistedLocalWorkspaces().filter((workspace) => pathKey(workspace.path) !== primaryKey);
  if (!extras.length) return;
  const hostToken = process.env.OPENWORK_HOST_TOKEN || "";
  if (!hostToken) {
    console.warn("[start] cannot replay extra local workspaces without OPENWORK_HOST_TOKEN.");
    return;
  }
  for (const workspace of extras) {
    try {
      const response = await fetch(`http://127.0.0.1:${OPENWORK_PORT}/workspaces/local`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-openwork-host-token": hostToken,
        },
        body: JSON.stringify({
          folderPath: workspace.path,
          name: workspace.name,
          preset: workspace.preset,
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) {
        console.warn(`[start] workspace replay failed for ${workspace.name}: HTTP ${response.status}`);
        continue;
      }
      console.log(`[start] registered workspace ${workspace.name}`);
    } catch (error) {
      console.warn(`[start] workspace replay failed for ${workspace.name}: ${error.message}`);
    }
  }
}

function shutdown() {
  console.log("\n[start] shutting down…");
  for (const c of children) {
    if (!c.pid) continue;
    if (isWin) spawnSync("taskkill", ["/PID", String(c.pid), "/T", "/F"], { stdio: "ignore" });
    else try { process.kill(-c.pid, "SIGTERM"); } catch { try { c.kill("SIGTERM"); } catch {} }
  }
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function main() {
  ensureServerConfigIncludesPrimaryWorkspace();

  // 1) Ollama up?
  let ollamaUp = false;
  try { ollamaUp = (await fetch(OLLAMA_TAGS)).ok; } catch {}
  if (!ollamaUp) {
    console.log("[start] starting `ollama serve`…");
    launchCmd("ollama", "ollama", ["serve"]);
    ollamaUp = await waitFor(OLLAMA_TAGS, "ollama", 30, 1000);
    if (!ollamaUp) { console.error("[start] Ollama not reachable. Install/start Ollama, then retry."); shutdown(); }
  } else {
    console.log("[start] Ollama already running.");
  }

  // 2) Ensure the local model is pulled (blocking, shows progress).
  try {
    const tags = await (await fetch(OLLAMA_TAGS)).json();
    const have = (tags.models || []).some((m) => m.name === OLLAMA_MODEL || m.name?.startsWith(OLLAMA_MODEL.split(":")[0]));
    if (!have) {
      console.log(`[start] pulling model ${OLLAMA_MODEL} (one-time download)…`);
      const r = spawnSync("ollama", ["pull", OLLAMA_MODEL], { stdio: "inherit", shell: isWin });
      if (r.status !== 0) console.warn(`[start] ollama pull ${OLLAMA_MODEL} failed — set OLLAMA_MODEL in .env to one you have.`);
    } else {
      console.log(`[start] model ${OLLAMA_MODEL} present.`);
    }
  } catch (e) { console.warn("[start] could not verify models:", e.message); }

  // 3) Cloud pool proxy (only if keys present).
  if (hasPoolKeys) {
    launchNode("pool", path.join(HERE, "pool-proxy.mjs"));
    await waitFor(`http://127.0.0.1:${POOL_PORT}/health`, "pool-proxy", 10, 500);
  } else {
    console.log("[start] no cloud keys set — cloud pool disabled (local Ollama only).");
  }

  // 4) Seed workspace opencode.json files (local + cloud providers, local default).
  const seedPaths = persistedLocalWorkspaces().map((workspace) => workspace.path);
  if (!seedPaths.some((workspacePath) => pathKey(workspacePath) === pathKey(WS))) seedPaths.unshift(WS);
  spawnSync(process.execPath, [path.join(HERE, "seed-opencode-config.mjs"), ...seedPaths], { stdio: "inherit" });

  // 5) Engine: openwork-server + opencode. First run downloads the opencode binary.
  console.log("[start] starting OpenWork engine (openwork serve)… first run downloads the opencode binary.");
  launchCmd("engine", "openwork", [
    "serve",
    "--workspace", WS,
    "--openwork-host", "127.0.0.1",
    "--openwork-port", OPENWORK_PORT,
    "--opencode-host", "127.0.0.1",
    "--opencode-port", OPENCODE_PORT,
    "--openwork-token", process.env.OPENWORK_TOKEN || "",
    "--openwork-host-token", process.env.OPENWORK_HOST_TOKEN || "",
    "--approval", process.env.OPENWORK_APPROVAL_MODE || "manual",
  ], {
    OPENCODE_MODELS_URL: process.env.OPENCODE_MODELS_URL || "https://models.dev/",
  });
  // Generous: the first-ever launch cold-starts a ~116MB server exe (Windows
  // Defender scans it), which can take minutes; warm launches are seconds.
  const engineOk = await waitFor(`http://127.0.0.1:${OPENWORK_PORT}/health`, "openwork engine", 300, 1000);
  await replayPersistedLocalWorkspaces();

  // 6) Serve the UI.
  launchNode("ui", path.join(HERE, "serve-ui.mjs"));
  await waitFor(`http://127.0.0.1:${UI_PORT}/`, "ui", 20, 500);

  const uiUrl = `http://127.0.0.1:${UI_PORT}`;
  console.log(`\n[start] ${engineOk ? "READY" : "UI up (engine still starting)"} -> ${uiUrl}\n`);
  if (isWin) spawnSync("cmd", ["/c", "start", "", uiUrl], { stdio: "ignore" });

  console.log("[start] Leave this window open. Press Ctrl+C to stop everything.");
}

main().catch((e) => { console.error("[start] fatal:", e); shutdown(); });

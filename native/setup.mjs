// One-time setup for the native (no-Docker) launcher:
//   1) ensure native/.env exists (from .env.example)
//   2) enable pnpm (corepack) — repo pins pnpm 11.4
//   3) install the OpenWork orchestrator (engine host) globally
//   4) install app deps + build the real OpenWork UI (phone-home neutralized)
//
// Run:  native\setup.cmd   (or:  node native/setup.mjs)
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(HERE, ".env");
const examplePath = path.join(HERE, ".env.example");

// 1) Seed native/.env
if (!fs.existsSync(envPath)) {
  fs.copyFileSync(examplePath, envPath);
  console.log(`[setup] created ${envPath} from .env.example — edit it to add keys / pick a model.`);
}
try { process.loadEnvFile(envPath); } catch {}

const ORCH = (process.env.ORCHESTRATOR_VERSION || "0.17.8").trim();

const sh = (cmd, args, opts = {}) => {
  console.log(`\n[setup] $ ${cmd} ${args.join(" ")}`);
  return spawnSync(cmd, args, { stdio: "inherit", shell: true, ...opts });
};

// 2) pnpm via corepack (fallback: npm i -g)
let pnpmOk = spawnSync("pnpm", ["--version"], { shell: true }).status === 0;
if (!pnpmOk) {
  sh("corepack", ["enable"]);
  sh("corepack", ["prepare", "pnpm@11.4.0", "--activate"]);
  pnpmOk = spawnSync("pnpm", ["--version"], { shell: true }).status === 0;
  if (!pnpmOk) sh("npm", ["install", "-g", "pnpm@11.4.0"]);
}

// 3) OpenWork orchestrator (provides the `openwork` engine host command)
if (spawnSync("openwork", ["--version"], { shell: true }).status !== 0) {
  const r = sh("npm", ["install", "-g", `openwork-orchestrator@${ORCH}`]);
  if (r.status !== 0) {
    console.error("[setup] failed to install openwork-orchestrator. Check npm/network and retry.");
    process.exit(1);
  }
} else {
  console.log("[setup] openwork orchestrator already installed.");
}

// 4) Build the UI
const r = sh("node", [path.join(HERE, "build-ui.mjs")]);
if (r.status !== 0) process.exit(r.status || 1);

console.log(`
[setup] Done.
  Next:
   1) Edit native\\.env  (set OLLAMA_MODEL, and OLLAMA_KEY_1.. if using the cloud pool)
   2) Run  native\\start.cmd
`);

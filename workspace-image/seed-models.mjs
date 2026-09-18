// MONOLITH: seeds the workspace opencode.json with ONLY the LiteLLM gateway
// models that actually answer a real completion right now. Fixes the "listed
// but not working" model picker (report #16) — claude/gpt/gemini need API
// keys that may not be set, local-qwen needs a pulled Ollama model, and
// ollama-pool needs OLLAMA_KEY_* — any of these can silently be dead.
//
// Run once at container start (see entrypoint.sh). Results are cached in
// /data/model-probe.json (12h TTL, persists across restarts on the mounted
// volume) so a restart doesn't reprobe every model again immediately.
import fs from "node:fs";
import path from "node:path";

import { loadEnabledCatalogEntries } from "./mcp-catalog.mjs";

const CFG_PATH = process.env.CFG || "/workspace/opencode.json";
const SIDECAR_DATA_DIR = process.env.MONOLITH_SIDECAR_DATA_DIR || "/sidecar-data";
const WEB_TOOLS_PATH = "/opt/monolith-seed/mcp/web-tools.mjs";
const GATEWAY_URL = (process.env.MONOLITH_GATEWAY_URL || "http://litellm:4000/v1").replace(/\/+$/, "");
const GATEWAY_KEY = process.env.MONOLITH_GATEWAY_KEY || "";
const PROBE_CACHE = "/data/model-probe.json";
const PROBE_TTL_MS = 12 * 60 * 60 * 1000;
const PROBE_TIMEOUT_MS = 15_000;

const CANDIDATE_MODELS = {
  claude: "Claude (cloud)",
  gpt: "GPT (cloud)",
  gemini: "Gemini (cloud)",
  "local-qwen": "Qwen (local)",
  "ollama-pool": "Ollama Pool (round-robin)",
};

function loadCache() {
  try {
    const parsed = JSON.parse(fs.readFileSync(PROBE_CACHE, "utf8"));
    if (parsed && Date.now() - parsed.at < PROBE_TTL_MS && Array.isArray(parsed.working)) {
      return parsed.working;
    }
  } catch {}
  return null;
}

function saveCache(working) {
  try {
    fs.mkdirSync(path.dirname(PROBE_CACHE), { recursive: true });
    fs.writeFileSync(PROBE_CACHE, JSON.stringify({ at: Date.now(), working }, null, 2) + "\n");
  } catch (error) {
    console.warn(`[seed-models] could not write probe cache: ${error.message}`);
  }
}

async function waitForGateway(maxWaitMs = 60_000) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${GATEWAY_URL}/models`, {
        headers: { authorization: `Bearer ${GATEWAY_KEY}` },
        signal: AbortSignal.timeout(5000),
      });
      if (r.ok || r.status === 401) return true; // gateway is up, even if auth fails
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return false;
}

async function probeModel(id) {
  try {
    const r = await fetch(`${GATEWAY_URL}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${GATEWAY_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: id,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 200,
        stream: false,
      }),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!r.ok) return false;
    const message = (await r.json())?.choices?.[0]?.message ?? {};
    const produced =
      (message.content ?? "").trim() || (message.reasoning_content ?? message.reasoning ?? "").trim();
    return Boolean(produced);
  } catch {
    return false;
  }
}

function loadConfig() {
  let cfg = {};
  try {
    cfg = JSON.parse(fs.readFileSync(CFG_PATH, "utf8"));
  } catch {}
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) cfg = {};
  return cfg;
}

// A cheap "worker" sub-agent for smart task routing (cost saving): primary
// agents delegate bulk grunt work (reading/searching/summarizing) to it while
// keeping the smart model for planning and code. OpenCode subagents inherit the
// caller's model unless `model` is set, so the cheap ref must be explicit.
function buildWorkerAgent(modelRef) {
  return {
    description:
      "Fast, low-cost helper for bulk mechanical work: reading and summarizing files, " +
      "searching or grepping the codebase, listing directories, and routine lookups. " +
      "Primary agents delegate high-volume grunt work here to cut cost. " +
      "Not for planning, architecture, or writing final code.",
    mode: "subagent",
    model: modelRef,
    temperature: 0,
    prompt:
      "You are a fast worker sub-agent handling well-scoped, mechanical tasks delegated by a " +
      "primary agent: read and summarize files, search the codebase, list directories, and " +
      "extract specific facts. Be concise and literal — return exactly what was asked (file " +
      "contents, matches, or a short summary). Do not plan, redesign, or make architectural " +
      "decisions; if a task needs judgment beyond a lookup, say so briefly and stop.",
    permission: { bash: MONOLITH_HARD_DENY_BASH },
  };
}

// MONOLITH_APPROVAL_MODE previously only reached the legacy openwork-orchestrator
// binary's `--approval` CLI flag (entrypoint.sh) — on the default "own" engine
// path it was read nowhere, so setting it did nothing. This wires it into
// opencode's own native permission config instead: "auto" lets ordinary bash
// commands run without a pause; anything else (unset, "manual", a typo) asks
// first, which is the safer default.
const approvalMode = (process.env.MONOLITH_APPROVAL_MODE || process.env.OPENWORK_APPROVAL_MODE || "manual")
  .trim()
  .toLowerCase();
const bashDefault = approvalMode === "auto" ? "allow" : "ask";

// Hard-denial floor, inspired by yc-software/qm's "predeclared command policy":
// a fixed set of irreversible/catastrophic bash patterns that are denied in
// EVERY approval mode, auto included — no approval-mode setting and no user
// "always allow" click can undo these (opencode's permission engine checks this
// exact ruleset for a "deny" match before it ever considers saved/remembered
// rules — see PermissionV2.denied() in the vendored engine).
//
// Key ordering matters: opencode's permission matcher picks the LAST rule in
// this object whose pattern matches a given command, so "*" (the catch-all
// default) MUST come first and the specific deny patterns after it — the
// reverse order would let "*" win and silently swallow every deny rule below.
//
// This is defense-in-depth pattern matching on the literal command string, not
// a sandboxing guarantee — an unusual phrasing (different flag order, an alias,
// a script that wraps the same call) can still slip past it. It's a floor
// against the common, obviously-catastrophic forms, not a substitute for
// running the engine with least-privilege OS permissions.
const MONOLITH_HARD_DENY_BASH = {
  "*": bashDefault,
  // Recursive/force filesystem wipes of root or home (Unix).
  "*rm -rf /*": "deny",
  "rm -rf /": "deny",
  "*rm -fr /*": "deny",
  "*rm --recursive --force /*": "deny",
  "*rm -rf ~*": "deny",
  "*rm -rf $HOME*": "deny",
  // Classic fork bomb.
  "*:(){ :|:& };:*": "deny",
  // Recursive/force filesystem wipes of a drive root (Windows).
  "*Remove-Item*-Recurse*-Force*C:\\*": "deny",
  "*rd /s /q C:\\*": "deny",
  "*rmdir /s /q C:\\*": "deny",
  "*format C:*": "deny",
  // Raw disk / partition operations.
  "*mkfs*": "deny",
  "*dd if=*of=/dev/*": "deny",
  "*diskpart*": "deny",
  // Destructive SQL (best-effort — SQL keyword casing varies; both covered).
  "*DROP DATABASE*": "deny",
  "*drop database*": "deny",
  "*DROP TABLE*": "deny",
  "*drop table*": "deny",
  "*TRUNCATE TABLE*": "deny",
  "*truncate table*": "deny",
};

// OpenCode hardcodes "build" as its own native, unbranded default primary agent
// (full tool permissions, no MONOLITH instructions) and there is no config way
// to change WHICH agent a session defaults to — but a session that never gets
// an explicit agent choice silently runs on "build" regardless. Rather than
// leave that path undisciplined, we override build's own prompt/description in
// config (verified: OpenCode does apply a config-level override to native
// agents, even though it can't rename or un-default one).
const MONOLITH_BUILD_AGENT = {
  description: "General-purpose assistant with full tool access — research, files, code, and everyday tasks.",
  prompt:
    "You are MONOLITH, a dependable assistant with full tool access: reading, writing, and running " +
    "code; searching the web; and creating or editing files. Handle whatever the task actually needs " +
    "— don't assume it's a coding task unless it is.\n\n" +
    "## Delegate bulk work to save cost\n\n" +
    "When a cheap `worker` sub-agent is available, delegate high-volume mechanical work to it via the " +
    "Task tool instead of doing it yourself: reading or summarizing files, searching/grepping, listing " +
    "directories, and gathering context. Reserve your own reasoning for planning, judgment calls, and " +
    "producing the final result. If no worker exists, just do the work yourself.\n\n" +
    "## Answer discipline (always apply)\n\n" +
    "- Report outcomes in the question's own terms first; only then reasoning that changes what the " +
    "user does; end with **Risks** for anything assumed or unverified (risk → consequence → fix).\n" +
    "- Label claims: verified (you ran/read it) → plain statement; recalled-but-unverified → " +
    '"Likely: … — [basis]"; chosen to proceed → "Assumption: … If wrong: [what changes]".\n' +
    "- NEVER claim a file was created, a command succeeded, or a task completed without actually " +
    "verifying it — read the file back, check the exit code, run the check. If something failed after " +
    "retries, say so plainly and explain what went wrong; do not report success to avoid an awkward " +
    "answer. A false completion claim is worse than admitting failure.\n" +
    "- Never invent API signatures, package names, or config keys — run/check them, or mark " +
    '"unverified — check docs for [exact phrase]".\n' +
    "- Same rule for search results, links, and citations: only present a URL/repo/name as a real " +
    "result if it appeared verbatim in actual tool output. Never pad a results list to a round number " +
    "with invented-but-plausible entries — a fabricated citation is the same failure as a fabricated " +
    "file, just harder for the user to catch until they click it.\n" +
    "- If verification keeps failing (repeated 404s/errors on a search or fetch), stop after a few " +
    "tries and report exactly what you could and could not confirm. Don't keep guessing new " +
    "URLs/names hoping one resolves — a lucky guess presented as a search result is still not one.\n" +
    "- No silent drops on multi-part requests — do each part or decline it out loud.\n\n" +
    "## Tool selection\n\n" +
    "- Local file tools (grep/glob/read/list/search) only see this machine's filesystem — never pass " +
    "a URL to them, and never ask a sub-agent to \"grep\" or \"search\" content that lives on a remote " +
    "page. To inspect a remote repo or page, fetch it (the web-fetch tool) or use its API.\n" +
    "- Match each call's arguments to that exact tool's schema. Don't reuse a field name from one tool " +
    "(e.g., a file-write tool's `filePath`/`content`) on a different tool that expects something else " +
    "(e.g., a fetch tool's `url`). On a \"missing key\" or \"invalid arguments\" error, first check " +
    "which tool you meant to call before retrying.",
  permission: { bash: MONOLITH_HARD_DENY_BASH },
};

// In Docker every model is a gateway alias behind provider "monolith"; the cheap
// tier is "monolith/local-qwen". Only route when it actually answered the probe
// AND it isn't already the default (no split possible on a single-model box).
function seedTaskRouting(cfg, working) {
  const cheapRef = "monolith/local-qwen";
  const existingAgent = cfg.agent && typeof cfg.agent === "object" && !Array.isArray(cfg.agent) ? cfg.agent : {};
  // build override always applies — see comment above.
  cfg.agent = { ...existingAgent, build: MONOLITH_BUILD_AGENT };
  if (working.includes("local-qwen") && cfg.model !== cheapRef) {
    cfg.small_model = cheapRef;
    cfg.agent.worker = buildWorkerAgent(cheapRef);
    return cheapRef;
  }
  delete cfg.agent.worker;
  return null;
}

// MCP wiring does not depend on the LiteLLM gateway/model probing below — it
// must still run (and be logged) even if the gateway never comes up, so a
// flaky/cold litellm container can't silently disable the agent's tools too.
function seedMcp(cfg) {
  const existingMcp = cfg.mcp && typeof cfg.mcp === "object" && !Array.isArray(cfg.mcp) ? cfg.mcp : {};
  const builtinMcp = { "monolith-web": { type: "local", command: ["node", WEB_TOOLS_PATH], enabled: true } };
  const catalogMcp = loadEnabledCatalogEntries(SIDECAR_DATA_DIR);
  cfg.mcp = { ...existingMcp, ...builtinMcp, ...catalogMcp };
  return cfg.mcp;
}

async function main() {
  let working = loadCache();
  let gatewayUp = Boolean(working);
  if (!working) {
    gatewayUp = await waitForGateway();
    working = [];
    if (!gatewayUp) {
      console.warn(`[seed-models] gateway ${GATEWAY_URL} did not come up in time; keeping any prior model list`);
    } else {
      for (const id of Object.keys(CANDIDATE_MODELS)) {
        const ok = await probeModel(id);
        console.log(`[seed-models] probe ${id}: ${ok ? "ok" : "SKIP (no response)"}`);
        if (ok) working.push(id);
      }
      saveCache(working);
    }
  }

  const cfg = loadConfig();
  cfg["$schema"] = "https://opencode.ai/config.json";
  cfg.provider = cfg.provider || {};

  if (gatewayUp) {
    if (working.length === 0) {
      console.warn("[seed-models] no gateway models answered — leaving provider.monolith unset");
      delete cfg.provider.monolith;
    } else {
      cfg.provider.monolith = {
        npm: "@ai-sdk/openai-compatible",
        name: "MONOLITH Gateway",
        options: { baseURL: GATEWAY_URL, apiKey: GATEWAY_KEY },
        models: Object.fromEntries(working.map((id) => [id, { name: CANDIDATE_MODELS[id] }])),
      };
      const preferredOrder = ["local-qwen", "ollama-pool", "claude", "gpt", "gemini"];
      const currentModel = typeof cfg.model === "string" ? cfg.model : "";
      const currentId = currentModel.startsWith("monolith/") ? currentModel.slice("monolith/".length) : "";
      if (!working.includes(currentId)) {
        const nextDefault = preferredOrder.find((id) => working.includes(id)) || working[0];
        cfg.model = `monolith/${nextDefault}`;
      }
    }
  }

  const workerRef = seedTaskRouting(cfg, working);
  const mcp = seedMcp(cfg);
  fs.writeFileSync(CFG_PATH, JSON.stringify(cfg, null, 2) + "\n");
  console.log(
    `[seed-models] ${CFG_PATH}\n` +
    `       default=${cfg.model ?? "(none)"} | task routing: ${workerRef ? `worker=${workerRef}` : "off (no cheaper model)"}\n` +
    `       working gateway models: ${working.length}/${Object.keys(CANDIDATE_MODELS).length}` +
    `${gatewayUp ? "" : " (gateway unreachable, model list unchanged)"}\n` +
    `       mcp servers: ${Object.keys(mcp).length} (${Object.keys(mcp).join(", ")})`,
  );
}

await main();

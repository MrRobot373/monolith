// Seeds <workspace>/opencode.json so the model picker shows only configured,
// working models:
//   - provider "openrouter"   : configured models, or live free models when
//                               OPENROUTER_FREE_ONLY=1
//   - provider "ollama"       : all models installed locally (from /api/tags)
//   - provider "ollama-cloud" : all models on the pooled cloud endpoint (via the proxy)
//   - disabled_providers      : hides OpenWork/opencode's built-in providers (Zen etc.)
//   - default model           : OpenRouter when configured as default, otherwise
//                               local/private unless none, then a cloud one
// Idempotent and non-clobbering for unrelated settings. Model lists are discovered live
// (best-effort, short timeout) so the picker always reflects what you actually have.
//
// Run:  node native/seed-opencode-config.mjs [workspace-path ...]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnabledCatalogEntries } from "../monolith-server/mcp-catalog.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.join(HERE, ".env")); } catch {}

const LOCAL_BASE = process.env.OLLAMA_URL || "http://localhost:11434/v1";
const LOCAL_TAGS = LOCAL_BASE.replace(/\/v1\/?$/, "") + "/api/tags";
const LOCAL_MODEL = process.env.OLLAMA_MODEL || "qwen2.5-coder:7b";
const POOL_PORT = process.env.POOL_PORT || "11435";
const POOL_BASE = (process.env.OLLAMA_POOL_BASE || "https://ollama.com/v1").replace(/\/+$/, "");
const POOL_MODEL = process.env.OLLAMA_POOL_MODEL || "gpt-oss:120b";
const OPENROUTER_BASE = (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
const OPENROUTER_KEY = (process.env.OPENROUTER_API_KEY || "").trim();
const OPENROUTER_MODEL = (process.env.OPENROUTER_MODEL || "openrouter/auto").trim();
const configuredOpenRouterModels = (process.env.OPENROUTER_MODELS || OPENROUTER_MODEL)
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
const openRouterAsDefault = !/^(0|false|no|off)$/i.test(process.env.OPENROUTER_AS_DEFAULT || "1");
const openRouterFreeOnly = /^(1|true|yes|on)$/i.test(process.env.OPENROUTER_FREE_ONLY || "0");
const openRouterOnly = /^(1|true|yes|on)$/i.test(
  process.env.OPENROUTER_ONLY || (openRouterFreeOnly ? "1" : "0"),
);

const poolKeys = Object.keys(process.env)
  .filter((k) => /^OLLAMA_KEY_\d+$/.test(k) && (process.env[k] || "").trim())
  .map((k) => process.env[k].trim());
const hasPoolKeys = poolKeys.length > 0;

// Built-in providers OpenWork/opencode ships - disabled so only your models show.
const DISABLED = [
  "opencode", "anthropic", "openai", "azure", "google", "google-vertex", "google-vertex-anthropic",
  "amazon-bedrock", "openrouter", "github-copilot", "github-models", "vercel", "xai", "groq",
  "mistral", "cohere", "deepseek", "together", "fireworks", "cerebras", "huggingface", "requesty",
  "morph", "v0", "llama", "inference", "zhipuai", "moonshotai", "opencode-zen",
];
const OPENROUTER_ONLY_DISABLED = ["ollama", "ollama-cloud", "litellm"];

const fetchJson = async (url, headers) => {
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    return r.ok ? await r.json() : null;
  } catch { return null; }
};
const toModelsMap = (ids, suffix) =>
  Object.fromEntries(ids.map((id) => [id, { name: `${id}${suffix}` }]));

// Discover local models (fallback: the configured one).
let localIds = openRouterOnly ? [] : [LOCAL_MODEL];
if (!openRouterOnly) {
  const tags = await fetchJson(LOCAL_TAGS);
  if (tags?.models?.length) localIds = [...new Set(tags.models.map((m) => m.name).filter(Boolean))].sort();
}

// Discover cloud models (fallback: the configured one).
const VERIFIED_CLOUD_MODELS = [
  "devstral-2:123b",
  "devstral-small-2:24b",
  "gemma3:12b",
  "gemma3:27b",
  "gemma3:4b",
  "glm-4.7",
  "gpt-oss:120b",
  "minimax-m2.1",
  "minimax-m2.5",
  "minimax-m3",
  "ministral-3:14b",
  "ministral-3:3b",
  "ministral-3:8b",
  "nemotron-3-nano:30b",
  "qwen3-coder-next",
  "qwen3-coder:480b"
];

// ---- Live model probing -----------------------------------------------------
// A model only reaches the picker if it answers a 1-token completion. Results
// are cached (native/data/model-probe.json, 12h TTL) so startups stay fast.
const PROBE_CACHE = path.join(HERE, "data", "model-probe.json");
const PROBE_TTL_MS = 12 * 60 * 60 * 1000;
const PROBE_TIMEOUT_MS = 12_000;
const PROBE_CONCURRENCY = 6;

function candidateCacheKey(candidateIds) {
  return candidateIds.slice().sort().join("\n");
}

function loadProbeCache(scope, candidateIds) {
  try {
    const parsed = JSON.parse(fs.readFileSync(PROBE_CACHE, "utf8"));
    const entry = parsed?.[scope];
    if (
      entry &&
      Date.now() - entry.at < PROBE_TTL_MS &&
      entry.candidatesKey === candidateCacheKey(candidateIds) &&
      Array.isArray(entry.working)
    ) return entry.working;
  } catch {}
  return null;
}

function saveProbeCache(scope, candidateIds, working) {
  let parsed = {};
  try { parsed = JSON.parse(fs.readFileSync(PROBE_CACHE, "utf8")) || {}; } catch {}
  parsed[scope] = { at: Date.now(), candidatesKey: candidateCacheKey(candidateIds), working };
  fs.mkdirSync(path.dirname(PROBE_CACHE), { recursive: true });
  fs.writeFileSync(PROBE_CACHE, JSON.stringify(parsed, null, 2) + "\n");
}

async function probeModel(base, id, keyPicker, options = {}) {
  const maxTokens = options.maxTokens ?? 200;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${keyPicker()}`, "content-type": "application/json" },
        // Enough for reasoning models to emit something (their content may stay
        // empty while thinking, so reasoning counts as alive).
        body: JSON.stringify({ model: id, messages: [{ role: "user", content: "hi" }], max_tokens: maxTokens, stream: false }),
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      if (r.status === 429 || r.status >= 500) continue; // busy/flaky -> one retry (next key)
      if (!r.ok) return false; // 4xx: not available on this key/tier/deployment
      const message = (await r.json())?.choices?.[0]?.message ?? {};
      const produced =
        (message.content ?? "").trim() ||
        (message.reasoning_content ?? message.reasoning ?? "").trim();
      return Boolean(produced);
    } catch { /* timeout or network -> retry once, then give up */ }
  }
  return false;
}

async function probeWorkingModels(scope, base, candidateIds, keyPicker, options = {}) {
  const cached = loadProbeCache(scope, candidateIds);
  if (cached) return cached.filter((id) => candidateIds.includes(id));
  const queue = [...candidateIds];
  const working = [];
  const concurrency = options.concurrency ?? PROBE_CONCURRENCY;
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const id = queue.shift();
      const ok = await probeModel(base, id, keyPicker, options);
      console.log(`[seed] probe ${scope}/${id}: ${ok ? "ok" : "SKIP (no response)"}`);
      if (ok) working.push(id);
    }
  });
  await Promise.all(workers);
  working.sort();
  saveProbeCache(scope, candidateIds, working);
  return working;
}

const priceIsZero = (value) => value === 0 || value === "0" || value === "0.0" || value === "0.000000";
const hasTextChatModalities = (model) => {
  const input = model?.architecture?.input_modalities;
  const output = model?.architecture?.output_modalities;
  return (!Array.isArray(input) || input.includes("text")) && (!Array.isArray(output) || output.includes("text"));
};
const isZeroCostModel = (model) => {
  const pricing = model?.pricing || {};
  return priceIsZero(pricing.prompt) &&
    priceIsZero(pricing.completion) &&
    (pricing.request === undefined || priceIsZero(pricing.request));
};

let openRouterModels = [...new Set(configuredOpenRouterModels)].filter(Boolean);
let openRouterModelNames = new Map(openRouterModels.map((id) => [id, id === "openrouter/auto" ? "OpenRouter Auto" : id]));
if (OPENROUTER_KEY && openRouterFreeOnly) {
  const body = await fetchJson(`${OPENROUTER_BASE}/models`, { authorization: `Bearer ${OPENROUTER_KEY}` });
  const freeCandidates = (body?.data || [])
    .filter((model) => typeof model?.id === "string" && isZeroCostModel(model) && hasTextChatModalities(model))
    .sort((a, b) => a.id.localeCompare(b.id));
  const candidateIds = [...new Set(freeCandidates.map((model) => model.id))];
  openRouterModelNames = new Map(
    freeCandidates.map((model) => [model.id, typeof model.name === "string" && model.name.trim() ? model.name.trim() : model.id]),
  );
  openRouterModels = await probeWorkingModels("openrouter-free", OPENROUTER_BASE, candidateIds, () => OPENROUTER_KEY, {
    concurrency: 3,
    maxTokens: 32,
  });
}
const hasOpenRouter = Boolean(OPENROUTER_KEY && openRouterModels.length);

// Cloud pool: catalog ∩ verified list, then keep only models that answer.
let cloudIds = [];
if (!openRouterOnly && hasPoolKeys) {
  const body = await fetchJson(`${POOL_BASE}/models`, { authorization: `Bearer ${poolKeys[0]}` });
  const ids = (body?.data || body?.models || []).map((m) => m.id || m.name).filter(Boolean);
  const candidates = ids.length
    ? [...new Set(ids.filter((id) => VERIFIED_CLOUD_MODELS.includes(id)))].sort()
    : [...VERIFIED_CLOUD_MODELS];
  let poolKeyIndex = 0;
  const nextPoolKey = () => poolKeys[poolKeyIndex++ % poolKeys.length];
  cloudIds = await probeWorkingModels("ollama-cloud", POOL_BASE, candidates, nextPoolKey);
}
const hasCloud = !openRouterOnly && hasPoolKeys && cloudIds.length > 0;

// LiteLLM gateway (Docker stack): offer only when it's up AND its models answer.
const GATEWAY_BASE = (process.env.MONOLITH_GATEWAY_URL || "http://127.0.0.1:4000/v1").replace(/\/+$/, "");
const GATEWAY_KEY = process.env.MONOLITH_GATEWAY_KEY || "sk-litellm-master-key";
const GATEWAY_NAMES = {
  claude: "Claude (Complex Tasks)",
  gpt: "GPT-4o (Complex Tasks)",
  gemini: "Gemini (Standard Tasks)",
  "local-qwen": "Local Qwen (Offline)",
};
let gatewayIds = [];
if (!openRouterOnly) {
  const body = await fetchJson(`${GATEWAY_BASE}/models`, { authorization: `Bearer ${GATEWAY_KEY}` });
  const ids = (body?.data || []).map((m) => m.id).filter(Boolean);
  if (ids.length) {
    gatewayIds = await probeWorkingModels("litellm", GATEWAY_BASE, ids.sort(), () => GATEWAY_KEY);
  }
}
const hasGateway = !openRouterOnly && gatewayIds.length > 0;

// Local models: keep only ones that can actually chat.
// - /api/show capability filter drops embedding-only models (e.g. mxbai-embed)
//   without loading anything.
// - ":cloud" aliases run on ollama.com through the local daemon and fail when
//   the CLI isn't signed in — live-probe those (remote call, no model load).
if (!openRouterOnly) {
  const OLLAMA_API = LOCAL_BASE.replace(/\/v1\/?$/, "");
  const kept = [];
  for (const name of localIds) {
    try {
      const r = await fetch(`${OLLAMA_API}/api/show`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: name }),
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) {
        const info = await r.json();
        const caps = Array.isArray(info?.capabilities) ? info.capabilities : null;
        if (caps && !caps.includes("completion")) {
          console.log(`[seed] local ${name}: SKIP (not a chat model)`);
          continue;
        }
      }
    } catch { /* metadata unavailable -> keep and let the alias probe decide */ }
    kept.push(name);
  }
  const cloudAliases = kept.filter((name) => /(^|[:-])cloud$/.test(name));
  let aliasWorking = cloudAliases;
  if (cloudAliases.length) {
    aliasWorking = await probeWorkingModels("ollama-local-cloud", LOCAL_BASE, cloudAliases, () => "local");
  }
  localIds = kept.filter((name) => !cloudAliases.includes(name) || aliasWorking.includes(name));
}

const preferredDefault = hasOpenRouter && openRouterAsDefault
  ? `openrouter/${openRouterModels[0]}`
  : localIds.includes(LOCAL_MODEL) ? `ollama/${LOCAL_MODEL}`
  : localIds.length ? `ollama/${localIds[0]}`
  : hasOpenRouter ? `openrouter/${openRouterModels[0]}`
  : hasCloud ? `ollama-cloud/${cloudIds[0]}`
  : hasGateway ? `litellm/${gatewayIds[0]}`
  : `ollama/${LOCAL_MODEL}`;

const modelExists = (model) => {
  if (typeof model !== "string" || !model.includes("/")) return false;
  const slash = model.indexOf("/");
  const provider = model.slice(0, slash);
  const id = model.slice(slash + 1);
  if (provider === "ollama") return localIds.includes(id);
  if (provider === "openrouter") return hasOpenRouter && openRouterModels.includes(id);
  if (provider === "ollama-cloud") return hasCloud && cloudIds.includes(id);
  if (provider === "litellm") return hasGateway && gatewayIds.includes(id);
  return false;
};

// ---- MCP servers (Tools guide Tier 3/4) -------------------------------------
// Product-managed entries refresh on every seed; anything the user defines in
// native/mcp.json (same shape as opencode.json "mcp") wins over the defaults.
function buildMcpEntries() {
  const entries = {
    // Tier 3: web search + URL fetch, dep-free stdio MCP shipped with MONOLITH.
    "monolith-web": {
      type: "local",
      command: [process.execPath, path.join(HERE, "mcp", "web-tools.mjs")],
      enabled: true,
    },
  };

  // Tier 4: cloud MCPs appear only when their credentials are configured.
  const githubToken = (process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "").trim();
  if (githubToken) {
    entries.github = {
      type: "remote",
      url: "https://api.githubcopilot.com/mcp/",
      headers: { Authorization: `Bearer ${githubToken}` },
      enabled: true,
    };
  }

  const supabaseToken = (process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (supabaseToken) {
    const supabaseArgs = ["-y", "@supabase/mcp-server-supabase@latest", "--read-only"];
    const projectRef = (process.env.SUPABASE_PROJECT_REF || "").trim();
    if (projectRef) supabaseArgs.push(`--project-ref=${projectRef}`);
    entries.supabase = {
      type: "local",
      command: ["npx", ...supabaseArgs],
      environment: { SUPABASE_ACCESS_TOKEN: supabaseToken },
      enabled: true,
    };
  }

  // Servers the user enabled from the MCP catalog (Settings / sidecar API).
  const catalogEntries = loadEnabledCatalogEntries(path.join(HERE, "data"));

  let userEntries = {};
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(HERE, "mcp.json"), "utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      userEntries = parsed.mcp && typeof parsed.mcp === "object" ? parsed.mcp : parsed;
    }
  } catch { /* optional file */ }

  return { ...entries, ...catalogEntries, ...userEntries };
}

// Answer-discipline block for <ws>/AGENTS.md — covers the engine's DEFAULT
// (Cowork) agent, which has no agent .md file of its own. Managed between
// markers so user edits to AGENTS.md (Projects modal) always survive; the
// marked section refreshes on every seed. Single source shared with Docker:
// workspace-image/seed/agents-discipline.md (entrypoint.sh does the same merge).
const AGENTS_MD_START = "<!-- MONOLITH:answer-discipline:start -->";
const AGENTS_MD_END = "<!-- MONOLITH:answer-discipline:end -->";

function seedAgentsMd(ws) {
  let block;
  try {
    block = fs
      .readFileSync(path.join(HERE, "..", "workspace-image", "seed", "agents-discipline.md"), "utf8")
      .trim();
  } catch {
    return "missing-block-file";
  }
  const managed = `${AGENTS_MD_START}\n${block}\n${AGENTS_MD_END}`;
  const agentsPath = path.join(ws, "AGENTS.md");
  let current = "";
  try { current = fs.readFileSync(agentsPath, "utf8"); } catch { /* no AGENTS.md yet */ }

  let next;
  if (current.includes(AGENTS_MD_START) && current.includes(AGENTS_MD_END)) {
    const start = current.indexOf(AGENTS_MD_START);
    const end = current.indexOf(AGENTS_MD_END) + AGENTS_MD_END.length;
    next = current.slice(0, start) + managed + current.slice(end);
  } else {
    next = current.trim() ? `${current.replace(/\s+$/, "")}\n\n${managed}\n` : `${managed}\n`;
  }
  if (next !== current) fs.writeFileSync(agentsPath, next);
  return next === current ? "unchanged" : current ? "refreshed" : "created";
}

// A cheap "worker" sub-agent the primary agents delegate bulk grunt work to,
// so a single agentic task is split across a smart model (planning, code) and a
// cheap model (reading/searching/summarizing) — no fork of the OpenCode engine.
// OpenCode subagents inherit the caller's model UNLESS `model` is set, so the
// cheap ref MUST be explicit here or the split saves nothing.
const buildWorkerAgent = (modelRef) => ({
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
});

// OpenCode hardcodes "build" as its own native, unbranded default primary agent
// (full tool permissions, no MONOLITH instructions) and there is no config way
// to change WHICH agent a session defaults to — but a session that never gets
// an explicit agent choice silently runs on "build" regardless. Rather than
// leave that path undisciplined, we override build's own prompt/description in
// config (verified live: opencode does apply a config-level override to native
// agents, even though it can't rename or un-default one). This is the same
// persona + rules as our own agents, just under the name opencode itself picks.
// MONOLITH_APPROVAL_MODE previously only reached the legacy openwork.exe binary's
// `--approval` CLI flag (native/start.mjs) — on the default "own" engine path
// (our orchestrator + vendored opencode) it was read nowhere, so setting it did
// nothing. This wires it into opencode's own native permission config instead:
// "auto" lets ordinary bash commands run without a pause; anything else (unset,
// "manual", or a typo) asks first, which is the safer default.
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

// Pick a real, working, cheap model ref for the small_model slot + worker agent.
// Prefers MONOLITH_ROUTER_SMALL_MODEL (consistent with the chat router), then any
// visibly-small local model, then a zero-cost OpenRouter free model. Returns null
// when nothing cheaper than the default is available (so we never point the
// "cheap" tier at a big model and pretend to save money).
function pickCheapModel(defaultRef) {
  const configured = String(process.env.MONOLITH_ROUTER_SMALL_MODEL || "").trim();
  const smallRe = /(:0\.5b|:1b|:1\.5b|:2b|:3b|:4b|mini|small|tiny|0\.5b|1\.5b)/i;
  const candidates = [];
  if (configured) candidates.push(`ollama/${configured}`);
  for (const id of localIds) if (smallRe.test(id)) candidates.push(`ollama/${id}`);
  if (localIds.length) candidates.push(`ollama/${localIds[0]}`);
  if (hasOpenRouter && openRouterModels.length) {
    candidates.push(`openrouter/${openRouterModels[openRouterModels.length - 1]}`);
  }
  for (const ref of candidates) {
    if (ref !== defaultRef && modelExists(ref)) return ref;
  }
  return null;
}

function seedWorkspace(workspacePath) {
  const ws = path.resolve(workspacePath);
  fs.mkdirSync(ws, { recursive: true });

  const cfgPath = path.join(ws, "opencode.json");
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8")); } catch {}
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) cfg = {};

  cfg["$schema"] = "https://opencode.ai/config.json";
  const disabled = Array.isArray(cfg.disabled_providers) ? cfg.disabled_providers : [];
  const disabledBuiltins = DISABLED.filter((provider) => provider !== "openrouter" || !hasOpenRouter);
  cfg.disabled_providers = [
    ...new Set([
      ...disabled.filter((provider) =>
        (provider !== "openrouter" || !hasOpenRouter) &&
        !OPENROUTER_ONLY_DISABLED.includes(provider)
      ),
      ...disabledBuiltins,
    ]),
  ];
  if (Array.isArray(cfg.enabled_providers) && cfg.enabled_providers.length === 1 && cfg.enabled_providers[0] === "openrouter") {
    delete cfg.enabled_providers;
  }
  cfg.provider = cfg.provider && typeof cfg.provider === "object" && !Array.isArray(cfg.provider)
    ? cfg.provider
    : {};

  if (hasOpenRouter) {
    cfg.provider.openrouter = {
      npm: "@ai-sdk/openai-compatible",
      name: "OpenRouter",
      options: {
        baseURL: OPENROUTER_BASE,
        apiKey: OPENROUTER_KEY,
      },
      models: Object.fromEntries(
        openRouterModels.map((id) => [id, { name: openRouterModelNames.get(id) || id }]),
      ),
    };
  } else {
    delete cfg.provider.openrouter;
  }

  // Only offer the gateway when it's reachable AND its models answered the
  // probe (a dead entry here is exactly a "listed but not working" model).
  if (!openRouterOnly && hasGateway) {
    cfg.provider.litellm = {
      npm: "@ai-sdk/openai-compatible",
      name: "LiteLLM Gateway",
      options: { baseURL: GATEWAY_BASE, apiKey: GATEWAY_KEY },
      models: Object.fromEntries(
        gatewayIds.map((id) => [id, { name: GATEWAY_NAMES[id] || id }]),
      ),
    };
  } else {
    delete cfg.provider.litellm;
  }

  if (!openRouterOnly) {
    cfg.provider.ollama = {
      npm: "@ai-sdk/openai-compatible",
      name: "Ollama (local)",
      options: { baseURL: LOCAL_BASE },
      models: toModelsMap(localIds, " - local"),
    };
  } else {
    delete cfg.provider.ollama;
  }

  if (!openRouterOnly && hasCloud) {
    cfg.provider["ollama-cloud"] = {
      npm: "@ai-sdk/openai-compatible",
      name: "Ollama Cloud (pooled)",
      options: { baseURL: `http://127.0.0.1:${POOL_PORT}/v1`, apiKey: "pool" },
      models: toModelsMap(cloudIds, " - cloud"),
    };
  } else {
    delete cfg.provider["ollama-cloud"];
  }

  if (openRouterOnly && hasOpenRouter) {
    cfg.model = preferredDefault;
  } else if (hasOpenRouter && openRouterAsDefault && !String(cfg.model || "").startsWith("openrouter/")) {
    cfg.model = preferredDefault;
  } else if (!modelExists(cfg.model)) {
    cfg.model = preferredDefault;
  }

  // Smart task routing (cost saving): give OpenCode a cheap small_model slot and
  // a cheap "worker" sub-agent, so one agentic task is split across a smart model
  // (planning/code) and a cheap model (bulk reading/searching). Product-managed:
  // the `worker` agent refreshes each seed; any other user-defined agent survives.
  const cheapModel = pickCheapModel(cfg.model);
  const existingAgent = cfg.agent && typeof cfg.agent === "object" && !Array.isArray(cfg.agent) ? cfg.agent : {};
  // build override always applies — a session with no explicit agent choice
  // silently runs on OpenCode's native "build" default, so it must never be
  // undisciplined. Product-managed: refreshes each seed, like worker.
  cfg.agent = { ...existingAgent, build: MONOLITH_BUILD_AGENT };
  if (cheapModel) {
    cfg.small_model = cheapModel;
    cfg.agent.worker = buildWorkerAgent(cheapModel);
  } else {
    // No cheaper tier available — drop a stale product worker rather than leave
    // it pointing at a model that may no longer exist.
    delete cfg.agent.worker;
  }

  // MCP servers: existing user entries survive; product-managed names refresh.
  const existingMcp = cfg.mcp && typeof cfg.mcp === "object" && !Array.isArray(cfg.mcp) ? cfg.mcp : {};
  cfg.mcp = { ...existingMcp, ...buildMcpEntries() };

  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");

  // Seed domain skills (Law / Doctor / Fitness) into <ws>/.opencode/skills/.
  // Product-managed: refreshed each run; the agent auto-discovers them by description.
  let skillCount = 0;
  const skillsSrc = path.join(HERE, "skills");
  if (fs.existsSync(skillsSrc)) {
    const dest = path.join(ws, ".opencode", "skills");
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(skillsSrc)) {
      const from = path.join(skillsSrc, name);
      if (fs.statSync(from).isDirectory()) {
        fs.cpSync(from, path.join(dest, name), { recursive: true });
        skillCount++;
      }
    }
  }

  // Seed mode agents (chat / code) into <ws>/.opencode/agent/ — the UI's
  // Chat|Cowork|Code tabs select these by name. Product-managed like skills.
  let agentCount = 0;
  const agentsSrc = path.join(HERE, "agents");
  if (fs.existsSync(agentsSrc)) {
    const dest = path.join(ws, ".opencode", "agent");
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(agentsSrc)) {
      if (!name.endsWith(".md")) continue;
      fs.copyFileSync(path.join(agentsSrc, name), path.join(dest, name));
      agentCount++;
    }
  }

  const agentsMdState = seedAgentsMd(ws);

  console.log(
    `[seed] ${cfgPath}\n` +
    `       default=${cfg.model} | task routing: ${cheapModel ? `worker=${cheapModel}` : "off (no cheaper model)"}\n` +
    `       local models: ${openRouterOnly ? 0 : localIds.length} | openrouter models: ${hasOpenRouter ? openRouterModels.length : 0} | ` +
    `cloud models (working): ${hasCloud ? cloudIds.length : 0} | ` +
    `gateway models (working): ${hasGateway ? gatewayIds.length : 0} | ` +
    `disabled built-ins: ${cfg.disabled_providers.length} | skills: ${skillCount} | agents: ${agentCount} | ` +
    `mcp servers: ${Object.keys(cfg.mcp).length} (${Object.keys(cfg.mcp).join(", ")}) | ` +
    `AGENTS.md discipline: ${agentsMdState}`,
  );
}

const defaultWorkspace = process.env.MONOLITH_WORKSPACE || process.env.OPENWORK_WORKSPACE || path.join(HERE, "workspace");
const args = process.argv.slice(2).map((value) => value.trim()).filter(Boolean);
const workspacePaths = [...new Set(args.length ? args : [defaultWorkspace])];
for (const workspacePath of workspacePaths) seedWorkspace(workspacePath);

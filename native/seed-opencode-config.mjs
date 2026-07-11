// Seeds <workspace>/opencode.json so the model picker shows ONLY your Ollama models:
//   - provider "ollama"       : all models installed locally (from /api/tags)
//   - provider "ollama-cloud" : all models on the pooled cloud endpoint (via the proxy)
//   - disabled_providers      : hides OpenWork/opencode's built-in providers (Zen etc.)
//   - default model           : your local model (private/free) unless none, then a cloud one
// Idempotent and non-clobbering for unrelated settings. Model lists are discovered live
// (best-effort, short timeout) so the picker always reflects what you actually have.
//
// Run:  node native/seed-opencode-config.mjs [workspace-path ...]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.join(HERE, ".env")); } catch {}

const LOCAL_BASE = process.env.OLLAMA_URL || "http://localhost:11434/v1";
const LOCAL_TAGS = LOCAL_BASE.replace(/\/v1\/?$/, "") + "/api/tags";
const LOCAL_MODEL = process.env.OLLAMA_MODEL || "qwen2.5-coder:7b";
const POOL_PORT = process.env.POOL_PORT || "11435";
const POOL_BASE = (process.env.OLLAMA_POOL_BASE || "https://ollama.com/v1").replace(/\/+$/, "");
const POOL_MODEL = process.env.OLLAMA_POOL_MODEL || "gpt-oss:120b";

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

const fetchJson = async (url, headers) => {
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    return r.ok ? await r.json() : null;
  } catch { return null; }
};
const toModelsMap = (ids, suffix) =>
  Object.fromEntries(ids.map((id) => [id, { name: `${id}${suffix}` }]));

// Discover local models (fallback: the configured one).
let localIds = [LOCAL_MODEL];
const tags = await fetchJson(LOCAL_TAGS);
if (tags?.models?.length) localIds = [...new Set(tags.models.map((m) => m.name).filter(Boolean))].sort();

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

function loadProbeCache(scope) {
  try {
    const parsed = JSON.parse(fs.readFileSync(PROBE_CACHE, "utf8"));
    const entry = parsed?.[scope];
    if (entry && Date.now() - entry.at < PROBE_TTL_MS && Array.isArray(entry.working)) return entry.working;
  } catch {}
  return null;
}

function saveProbeCache(scope, working) {
  let parsed = {};
  try { parsed = JSON.parse(fs.readFileSync(PROBE_CACHE, "utf8")) || {}; } catch {}
  parsed[scope] = { at: Date.now(), working };
  fs.mkdirSync(path.dirname(PROBE_CACHE), { recursive: true });
  fs.writeFileSync(PROBE_CACHE, JSON.stringify(parsed, null, 2) + "\n");
}

async function probeModel(base, id, keyPicker) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${keyPicker()}`, "content-type": "application/json" },
        body: JSON.stringify({ model: id, messages: [{ role: "user", content: "hi" }], max_tokens: 1, stream: false }),
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      if (r.ok) return true;
      if (r.status === 429 || r.status >= 500) continue; // busy/flaky -> one retry (next key)
      return false; // 4xx: not available on this key/tier/deployment
    } catch { /* timeout or network -> retry once, then give up */ }
  }
  return false;
}

async function probeWorkingModels(scope, base, candidateIds, keyPicker) {
  const cached = loadProbeCache(scope);
  if (cached) return cached.filter((id) => candidateIds.includes(id));
  const queue = [...candidateIds];
  const working = [];
  const workers = Array.from({ length: Math.min(PROBE_CONCURRENCY, queue.length) }, async () => {
    while (queue.length) {
      const id = queue.shift();
      const ok = await probeModel(base, id, keyPicker);
      console.log(`[seed] probe ${scope}/${id}: ${ok ? "ok" : "SKIP (no response)"}`);
      if (ok) working.push(id);
    }
  });
  await Promise.all(workers);
  working.sort();
  saveProbeCache(scope, working);
  return working;
}

// Cloud pool: catalog ∩ verified list, then keep only models that answer.
let cloudIds = [];
if (hasPoolKeys) {
  const body = await fetchJson(`${POOL_BASE}/models`, { authorization: `Bearer ${poolKeys[0]}` });
  const ids = (body?.data || body?.models || []).map((m) => m.id || m.name).filter(Boolean);
  const candidates = ids.length
    ? [...new Set(ids.filter((id) => VERIFIED_CLOUD_MODELS.includes(id)))].sort()
    : [...VERIFIED_CLOUD_MODELS];
  let poolKeyIndex = 0;
  const nextPoolKey = () => poolKeys[poolKeyIndex++ % poolKeys.length];
  cloudIds = await probeWorkingModels("ollama-cloud", POOL_BASE, candidates, nextPoolKey);
}
const hasCloud = hasPoolKeys && cloudIds.length > 0;

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
{
  const body = await fetchJson(`${GATEWAY_BASE}/models`, { authorization: `Bearer ${GATEWAY_KEY}` });
  const ids = (body?.data || []).map((m) => m.id).filter(Boolean);
  if (ids.length) {
    gatewayIds = await probeWorkingModels("litellm", GATEWAY_BASE, ids.sort(), () => GATEWAY_KEY);
  }
}
const hasGateway = gatewayIds.length > 0;

// Local models: keep only ones that can actually chat.
// - /api/show capability filter drops embedding-only models (e.g. mxbai-embed)
//   without loading anything.
// - ":cloud" aliases run on ollama.com through the local daemon and fail when
//   the CLI isn't signed in — live-probe those (remote call, no model load).
{
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

const preferredDefault = localIds.includes(LOCAL_MODEL)
  ? `ollama/${LOCAL_MODEL}`
  : localIds.length ? `ollama/${localIds[0]}`
  : hasCloud ? `ollama-cloud/${cloudIds[0]}`
  : hasGateway ? `litellm/${gatewayIds[0]}`
  : `ollama/${LOCAL_MODEL}`;

const modelExists = (model) => {
  if (typeof model !== "string" || !model.includes("/")) return false;
  const slash = model.indexOf("/");
  const provider = model.slice(0, slash);
  const id = model.slice(slash + 1);
  if (provider === "ollama") return localIds.includes(id);
  if (provider === "ollama-cloud") return hasCloud && cloudIds.includes(id);
  if (provider === "litellm") return hasGateway && gatewayIds.includes(id);
  return false;
};

function seedWorkspace(workspacePath) {
  const ws = path.resolve(workspacePath);
  fs.mkdirSync(ws, { recursive: true });

  const cfgPath = path.join(ws, "opencode.json");
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8")); } catch {}
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) cfg = {};

  cfg["$schema"] = "https://opencode.ai/config.json";
  const disabled = Array.isArray(cfg.disabled_providers) ? cfg.disabled_providers : [];
  cfg.disabled_providers = [...new Set([...disabled, ...DISABLED])];
  cfg.provider = cfg.provider && typeof cfg.provider === "object" && !Array.isArray(cfg.provider)
    ? cfg.provider
    : {};

  // Only offer the gateway when it's reachable AND its models answered the
  // probe (a dead entry here is exactly a "listed but not working" model).
  if (hasGateway) {
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

  cfg.provider.ollama = {
    npm: "@ai-sdk/openai-compatible",
    name: "Ollama (local)",
    options: { baseURL: LOCAL_BASE },
    models: toModelsMap(localIds, " - local"),
  };

  if (hasCloud) {
    cfg.provider["ollama-cloud"] = {
      npm: "@ai-sdk/openai-compatible",
      name: "Ollama Cloud (pooled)",
      options: { baseURL: `http://127.0.0.1:${POOL_PORT}/v1`, apiKey: "pool" },
      models: toModelsMap(cloudIds, " - cloud"),
    };
  } else {
    delete cfg.provider["ollama-cloud"];
  }

  if (!modelExists(cfg.model)) cfg.model = preferredDefault;

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

  console.log(
    `[seed] ${cfgPath}\n` +
    `       default=${cfg.model}\n` +
    `       local models: ${localIds.length} | cloud models (working): ${hasCloud ? cloudIds.length : 0} | ` +
    `gateway models (working): ${hasGateway ? gatewayIds.length : 0} | ` +
    `disabled built-ins: ${cfg.disabled_providers.length} | skills: ${skillCount} | agents: ${agentCount}`,
  );
}

const defaultWorkspace = process.env.OPENWORK_WORKSPACE || path.join(HERE, "workspace");
const args = process.argv.slice(2).map((value) => value.trim()).filter(Boolean);
const workspacePaths = [...new Set(args.length ? args : [defaultWorkspace])];
for (const workspacePath of workspacePaths) seedWorkspace(workspacePath);

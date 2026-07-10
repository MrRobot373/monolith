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

let cloudIds = [POOL_MODEL];
if (hasPoolKeys) {
  const body = await fetchJson(`${POOL_BASE}/models`, { authorization: `Bearer ${poolKeys[0]}` });
  const ids = (body?.data || body?.models || []).map((m) => m.id || m.name).filter(Boolean);
  if (ids.length) {
    cloudIds = [...new Set(ids.filter(id => VERIFIED_CLOUD_MODELS.includes(id)))].sort();
    if (cloudIds.length === 0) {
      cloudIds = [POOL_MODEL];
    }
  }
}

const preferredDefault = localIds.includes(LOCAL_MODEL)
  ? `ollama/${LOCAL_MODEL}`
  : localIds.length ? `ollama/${localIds[0]}`
  : hasPoolKeys ? `ollama-cloud/${cloudIds[0]}` : `ollama/${LOCAL_MODEL}`;

const modelExists = (model) => {
  if (typeof model !== "string" || !model.includes("/")) return false;
  const slash = model.indexOf("/");
  const provider = model.slice(0, slash);
  const id = model.slice(slash + 1);
  if (provider === "ollama") return localIds.includes(id);
  if (provider === "ollama-cloud") return hasPoolKeys && cloudIds.includes(id);
  if (provider === "litellm") return ["claude", "gpt", "gemini", "local-qwen"].includes(id);
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

  cfg.provider.litellm = {
    npm: "@ai-sdk/openai-compatible",
    name: "LiteLLM Gateway",
    options: {
      baseURL: "http://127.0.0.1:4000/v1",
      apiKey: "sk-litellm-master-key"
    },
    models: {
      "claude": {
        "name": "Claude (Complex Tasks)"
      },
      "gpt": {
        "name": "GPT-4o (Complex Tasks)"
      },
      "gemini": {
        "name": "Gemini (Standard Tasks)"
      },
      "local-qwen": {
        "name": "Local Qwen (Offline)"
      }
    }
  };

  cfg.provider.ollama = {
    npm: "@ai-sdk/openai-compatible",
    name: "Ollama (local)",
    options: { baseURL: LOCAL_BASE },
    models: toModelsMap(localIds, " - local"),
  };

  if (hasPoolKeys) {
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
    `       local models: ${localIds.length} | cloud models: ${hasPoolKeys ? cloudIds.length : 0} | ` +
    `disabled built-ins: ${cfg.disabled_providers.length} | skills: ${skillCount} | agents: ${agentCount}`,
  );
}

const defaultWorkspace = process.env.OPENWORK_WORKSPACE || path.join(HERE, "workspace");
const args = process.argv.slice(2).map((value) => value.trim()).filter(Boolean);
const workspacePaths = [...new Set(args.length ? args : [defaultWorkspace])];
for (const workspacePath of workspacePaths) seedWorkspace(workspacePath);

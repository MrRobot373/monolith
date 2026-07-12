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

const CFG_PATH = process.env.CFG || "/workspace/opencode.json";
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

async function main() {
  let working = loadCache();
  if (!working) {
    const gatewayUp = await waitForGateway();
    if (!gatewayUp) {
      console.warn(`[seed-models] gateway ${GATEWAY_URL} did not come up in time; keeping any prior model list`);
      return;
    }
    working = [];
    for (const id of Object.keys(CANDIDATE_MODELS)) {
      const ok = await probeModel(id);
      console.log(`[seed-models] probe ${id}: ${ok ? "ok" : "SKIP (no response)"}`);
      if (ok) working.push(id);
    }
    saveCache(working);
  }

  let cfg = {};
  try {
    cfg = JSON.parse(fs.readFileSync(CFG_PATH, "utf8"));
  } catch {}
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) cfg = {};
  cfg["$schema"] = "https://opencode.ai/config.json";
  cfg.provider = cfg.provider || {};

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

  fs.writeFileSync(CFG_PATH, JSON.stringify(cfg, null, 2) + "\n");
  console.log(
    `[seed-models] ${CFG_PATH}\n` +
    `       default=${cfg.model ?? "(none)"}\n` +
    `       working gateway models: ${working.length}/${Object.keys(CANDIDATE_MODELS).length}`,
  );
}

await main();

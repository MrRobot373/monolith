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
  };
}

// In Docker every model is a gateway alias behind provider "monolith"; the cheap
// tier is "monolith/local-qwen". Only route when it actually answered the probe
// AND it isn't already the default (no split possible on a single-model box).
function seedTaskRouting(cfg, working) {
  const cheapRef = "monolith/local-qwen";
  const existingAgent = cfg.agent && typeof cfg.agent === "object" && !Array.isArray(cfg.agent) ? cfg.agent : {};
  if (working.includes("local-qwen") && cfg.model !== cheapRef) {
    cfg.small_model = cheapRef;
    cfg.agent = { ...existingAgent, worker: buildWorkerAgent(cheapRef) };
    return cheapRef;
  }
  delete existingAgent.worker;
  cfg.agent = existingAgent;
  if (Object.keys(cfg.agent).length === 0) delete cfg.agent;
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

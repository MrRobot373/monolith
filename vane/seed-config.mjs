import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const dataDir = process.env.VANE_DATA_DIR || "/home/vane/data";
const configPath = path.join(dataDir, "config.json");
const gatewayUrl = String(process.env.MONOLITH_GATEWAY_URL || "http://litellm:4000/v1").replace(/\/+$/, "");
const gatewayKey = String(process.env.MONOLITH_GATEWAY_KEY || "").trim();
const chatModel = String(process.env.MONOLITH_VANE_CHAT_MODEL || "local-qwen").trim();

if (!gatewayKey) {
  console.error("[vane-config] MONOLITH_GATEWAY_KEY is required");
  process.exit(1);
}

fs.mkdirSync(dataDir, { recursive: true });

let config = {
  version: 1,
  setupComplete: true,
  preferences: {},
  personalization: {},
  modelProviders: [],
  search: { searxngURL: "http://localhost:8080" },
};

if (fs.existsSync(configPath)) {
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (parsed && typeof parsed === "object") config = { ...config, ...parsed };
  } catch (error) {
    console.error(`[vane-config] invalid existing config: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

const providerConfig = { apiKey: gatewayKey, baseURL: gatewayUrl };
const gatewayProvider = {
  id: "monolith-litellm",
  name: "MONOLITH Gateway",
  type: "openai",
  config: providerConfig,
  chatModels: [{ key: chatModel, name: "Qwen (local)" }],
  embeddingModels: [],
  hash: crypto.createHash("sha256").update(JSON.stringify(providerConfig)).digest("hex"),
};

const providers = Array.isArray(config.modelProviders) ? config.modelProviders : [];
config.modelProviders = [
  gatewayProvider,
  ...providers.filter(
    (provider) =>
      provider?.id !== gatewayProvider.id &&
      provider?.name !== gatewayProvider.name &&
      // Vane exposes every Ollama model as both chat and embedding capable.
      // Keep local Ollama chat behind LiteLLM so an embedding-only model cannot
      // be restored from stale browser preferences as the active chat model.
      provider?.type !== "ollama",
  ),
];
config.setupComplete = true;

const temporaryPath = `${configPath}.tmp`;
fs.writeFileSync(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
fs.renameSync(temporaryPath, configPath);
console.log(`[vane-config] chat model ${chatModel} routed through MONOLITH Gateway`);

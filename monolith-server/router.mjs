// MONOLITH smart model router (cost-saving auto-routing).
//
// A tiny/fast local model classifies each incoming chat message as SIMPLE or
// COMPLEX, so simple messages go to a cheap small model and complex ones to the
// smartest available model — instead of always paying for the biggest model.
//
// The single load-bearing safety property: classify() NEVER throws and NEVER
// silently downgrades quality on failure. If the classifier is missing, errors,
// times out, or answers gibberish, it falls back to a conservative keyword/length
// heuristic biased toward "large". A routing failure means "use the smart model",
// never "quietly send a hard task to a 0.5B model".
//
// It reuses chat.mjs's providers() (passed as getProviders) as the single source
// of truth for provider baseUrl/auth — it never re-implements that.

const CLASSIFIER_PROMPT = [
  "You are a routing classifier. Decide whether answering the user's message well",
  "needs a large, capable model or a small, cheap one.",
  "Answer with EXACTLY ONE WORD: COMPLEX or SIMPLE. Nothing else.",
  "COMPLEX = multi-step reasoning, code generation or analysis, debugging,",
  "architecture/design, math, or domain expertise.",
  "SIMPLE = a short factual answer, greeting, quick lookup, or casual reply.",
].join(" ");

// Conservative — any ambiguity biases toward "large" so we never downgrade a
// hard task. Only clearly-trivial messages fall through to "small".
const COMPLEX_KEYWORDS =
  /\b(refactor|architect|debug|optimi[sz]e|design|analy[sz]e|compare|migrat|integrat|algorithm|regex|schema|security|vulnerab|root cause|step by step|write (a|an) (function|script|program|class))\b/i;

function heuristicTier(content) {
  const trimmed = String(content || "").trim();
  if (trimmed.length > 400) return "large";
  if (COMPLEX_KEYWORDS.test(trimmed)) return "large";
  if ((trimmed.match(/\?/g) || []).length >= 2) return "large";
  return "small";
}

function envFlagOn(value, fallback = true) {
  if (value === undefined || value === null || value === "") return fallback;
  return !/^(0|false|no|off)$/i.test(String(value).trim());
}

export function createModelRouter({ env = process.env, fetchImpl = fetch, log = () => {}, getProviders }) {
  // Per-instance so tests get isolated caches.
  let modelsCache = { at: 0, host: null, models: [] };

  const cleanModel = (value, fallback = "") => String(value || fallback).trim();

  function enabled() {
    return envFlagOn(env.MONOLITH_ROUTER_ENABLED, true);
  }

  function smallTarget() {
    return {
      provider: cleanModel(env.MONOLITH_ROUTER_SMALL_PROVIDER, "ollama"),
      model: cleanModel(env.MONOLITH_ROUTER_SMALL_MODEL, "qwen2.5:0.5b"),
    };
  }

  function classifierTarget() {
    const small = smallTarget();
    return {
      provider: cleanModel(env.MONOLITH_ROUTER_CLASSIFIER_PROVIDER, small.provider),
      model: cleanModel(env.MONOLITH_ROUTER_CLASSIFIER_MODEL, small.model),
    };
  }

  function largeTarget() {
    const explicitModel = cleanModel(env.MONOLITH_ROUTER_LARGE_MODEL);
    if (explicitModel) {
      return {
        provider: cleanModel(env.MONOLITH_ROUTER_LARGE_PROVIDER, "openrouter"),
        model: explicitModel,
      };
    }
    const providers = getProviders();
    if (providers.openrouter?.configured) {
      return { provider: "openrouter", model: cleanModel(env.OPENROUTER_MODEL, "openrouter/auto") };
    }
    if (providers.litellm?.configured) {
      return { provider: "litellm", model: cleanModel(env.MONOLITH_ROUTER_LARGE_MODEL, "claude") };
    }
    // Last-resort on a pure single-model box: there is no bigger tier, so the
    // "large" tier is the configured default local model. Intentional, not a bug.
    return { provider: "ollama", model: cleanModel(env.OLLAMA_MODEL, smallTarget().model) };
  }

  function targetForTier(tier) {
    return tier === "small" ? smallTarget() : largeTarget();
  }

  // Ollama-native endpoints (/api/tags) live at the host WITHOUT the OpenAI /v1 suffix.
  function ollamaHost() {
    const providers = getProviders();
    const baseUrl = providers.ollama?.baseUrl || "http://localhost:11434";
    return baseUrl.replace(/\/v1\/?$/, "").replace(/\/+$/, "");
  }

  async function listLocalModels() {
    const host = ollamaHost();
    const ttl = Number(env.MONOLITH_ROUTER_MODELS_CACHE_MS || 60000);
    const now = Date.now();
    if (modelsCache.host === host && now - modelsCache.at < ttl) {
      return modelsCache.models;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetchImpl(`${host}/api/tags`, { signal: controller.signal });
      if (!response.ok) throw new Error(`tags_http_${response.status}`);
      const body = await response.json();
      const models = Array.isArray(body?.models)
        ? body.models.map((m) => m?.name).filter(Boolean)
        : [];
      modelsCache = { at: now, host, models };
      return models;
    } catch (error) {
      log(`listLocalModels failed: ${error.message}`);
      // Serve the last good list for this host if we have one; else empty.
      return modelsCache.host === host ? modelsCache.models : [];
    } finally {
      clearTimeout(timer);
    }
  }

  function heuristicDecision(content, fallbackReason) {
    const tier = heuristicTier(content);
    const target = targetForTier(tier);
    return {
      tier,
      provider: target.provider,
      model: target.model,
      classifierModel: null,
      method: "heuristic",
      fallbackReason,
    };
  }

  // Never throws. Returns a routing decision; on any failure falls back to the
  // heuristic (biased toward large), never a silent downgrade.
  async function classify({ content }) {
    if (!enabled()) return heuristicDecision(content, "router_disabled");
    const target = classifierTarget();
    const providers = getProviders();
    const entry = providers[target.provider];
    if (!entry || !entry.configured) {
      return heuristicDecision(content, "classifier_provider_not_configured");
    }

    const controller = new AbortController();
    const timeoutMs = Number(env.MONOLITH_ROUTER_CLASSIFIER_TIMEOUT_MS || 4000);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${entry.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", ...entry.headers },
        body: JSON.stringify({
          model: target.model,
          stream: false,
          temperature: 0,
          max_tokens: Number(env.MONOLITH_ROUTER_CLASSIFIER_MAX_TOKENS || 4),
          messages: [
            { role: "system", content: CLASSIFIER_PROMPT },
            { role: "user", content: String(content || "").slice(0, 2000) },
          ],
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        return heuristicDecision(content, `classifier_http_${response.status}`);
      }
      const payload = await response.json();
      const answer = String(payload?.choices?.[0]?.message?.content || "").toUpperCase();
      let tier;
      if (answer.includes("COMPLEX")) tier = "large";
      else if (answer.includes("SIMPLE")) tier = "small";
      else return heuristicDecision(content, "classifier_unparsable_response");

      const chosen = targetForTier(tier);
      return {
        tier,
        provider: chosen.provider,
        model: chosen.model,
        classifierModel: target.model,
        method: "llm",
      };
    } catch (error) {
      return heuristicDecision(content, `classifier_error:${error.message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  async function describe() {
    const localModels = await listLocalModels();
    const installed = (target) =>
      target.provider === "ollama" ? localModels.includes(target.model) : null;
    const small = smallTarget();
    const large = largeTarget();
    const classifier = classifierTarget();
    return {
      enabled: enabled(),
      small: { ...small, installed: installed(small) },
      large: { ...large, installed: installed(large) },
      classifier: { ...classifier, installed: installed(classifier) },
      localModels,
    };
  }

  return {
    enabled,
    smallTarget,
    largeTarget,
    classifierTarget,
    classify,
    listLocalModels,
    describe,
  };
}

// Run: node --test monolith-server/router.test.mjs
// Unit tests for the smart model router: target resolution, classify() with a
// fake provider (SIMPLE/COMPLEX + every failure mode falling back to the
// heuristic biased toward large), heuristic edges, model-list TTL cache.
import test from "node:test";
import assert from "node:assert/strict";

import { createModelRouter } from "./router.mjs";

// A providers() stand-in matching chat.mjs's shape.
function makeProviders({ ollama = true, openrouter = false, litellm = false } = {}) {
  return () => ({
    ollama: { configured: ollama, baseUrl: "http://ollama-host:11434/v1", headers: {} },
    openrouter: {
      configured: openrouter,
      baseUrl: "https://openrouter.ai/api/v1",
      headers: openrouter ? { authorization: "Bearer or-key" } : {},
    },
    litellm: {
      configured: litellm,
      baseUrl: "http://litellm:4000/v1",
      headers: litellm ? { authorization: "Bearer lite-key" } : {},
    },
  });
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const classifierReply = (word) => jsonResponse({ choices: [{ message: { content: word } }] });

test("smallTarget/classifierTarget defaults and overrides", () => {
  const base = { env: {}, fetchImpl: async () => {}, getProviders: makeProviders() };
  const def = createModelRouter(base);
  assert.deepEqual(def.smallTarget(), { provider: "ollama", model: "qwen2.5:0.5b" });
  assert.deepEqual(def.classifierTarget(), { provider: "ollama", model: "qwen2.5:0.5b" });

  const custom = createModelRouter({
    ...base,
    env: {
      MONOLITH_ROUTER_SMALL_MODEL: "tiny:1b",
      MONOLITH_ROUTER_SMALL_PROVIDER: "ollama",
      MONOLITH_ROUTER_CLASSIFIER_MODEL: "judge:1b",
    },
  });
  assert.equal(custom.smallTarget().model, "tiny:1b");
  assert.equal(custom.classifierTarget().model, "judge:1b");
  // Classifier provider inherits small provider when unset.
  assert.equal(custom.classifierTarget().provider, "ollama");
});

test("largeTarget resolves explicit > openrouter > litellm > local", () => {
  const g = makeProviders({ openrouter: true, litellm: true });
  const explicit = createModelRouter({
    env: { MONOLITH_ROUTER_LARGE_MODEL: "anthropic/claude", MONOLITH_ROUTER_LARGE_PROVIDER: "litellm" },
    fetchImpl: async () => {},
    getProviders: g,
  });
  assert.deepEqual(explicit.largeTarget(), { provider: "litellm", model: "anthropic/claude" });

  const orDefault = createModelRouter({ env: {}, fetchImpl: async () => {}, getProviders: makeProviders({ openrouter: true }) });
  assert.deepEqual(orDefault.largeTarget(), { provider: "openrouter", model: "openrouter/auto" });

  const liteDefault = createModelRouter({ env: {}, fetchImpl: async () => {}, getProviders: makeProviders({ litellm: true }) });
  assert.equal(liteDefault.largeTarget().provider, "litellm");

  const localOnly = createModelRouter({ env: { OLLAMA_MODEL: "qwen2.5-coder:7b" }, fetchImpl: async () => {}, getProviders: makeProviders() });
  assert.deepEqual(localOnly.largeTarget(), { provider: "ollama", model: "qwen2.5-coder:7b" });
});

test("classify returns small on SIMPLE, large on COMPLEX (method llm)", async () => {
  const router = createModelRouter({
    env: {},
    fetchImpl: async () => classifierReply("SIMPLE"),
    getProviders: makeProviders({ openrouter: true }),
  });
  const simple = await router.classify({ content: "hi there" });
  assert.equal(simple.tier, "small");
  assert.equal(simple.method, "llm");
  assert.equal(simple.provider, "ollama");
  assert.equal(simple.classifierModel, "qwen2.5:0.5b");

  const complexRouter = createModelRouter({
    env: {},
    fetchImpl: async () => classifierReply("COMPLEX please"),
    getProviders: makeProviders({ openrouter: true }),
  });
  const complex = await complexRouter.classify({ content: "design a system" });
  assert.equal(complex.tier, "large");
  assert.equal(complex.method, "llm");
  assert.equal(complex.provider, "openrouter");
});

test("classify falls back to heuristic when classifier provider not configured", async () => {
  const router = createModelRouter({
    env: { MONOLITH_ROUTER_CLASSIFIER_PROVIDER: "openrouter" },
    fetchImpl: async () => classifierReply("SIMPLE"),
    getProviders: makeProviders({ openrouter: false }),
  });
  const decision = await router.classify({ content: "hello" });
  assert.equal(decision.method, "heuristic");
  assert.equal(decision.fallbackReason, "classifier_provider_not_configured");
  assert.equal(decision.tier, "small");
});

test("classify falls back to heuristic on network error, never throws", async () => {
  const router = createModelRouter({
    env: {},
    fetchImpl: async () => {
      throw new Error("boom");
    },
    getProviders: makeProviders(),
  });
  const decision = await router.classify({ content: "please refactor this module" });
  assert.equal(decision.method, "heuristic");
  assert.match(decision.fallbackReason, /^classifier_error:/);
  assert.equal(decision.tier, "large"); // "refactor" keyword biases large
});

test("classify falls back to heuristic on HTTP 500 and unparsable response", async () => {
  const http500 = createModelRouter({ env: {}, fetchImpl: async () => new Response("nope", { status: 500 }), getProviders: makeProviders() });
  const d1 = await http500.classify({ content: "hi" });
  assert.equal(d1.fallbackReason, "classifier_http_500");

  const garbage = createModelRouter({ env: {}, fetchImpl: async () => classifierReply("banana"), getProviders: makeProviders() });
  const d2 = await garbage.classify({ content: "hi" });
  assert.equal(d2.fallbackReason, "classifier_unparsable_response");
  assert.equal(d2.tier, "small");
});

test("heuristic: trivial small, long/keyword/multi-question large", async () => {
  const router = createModelRouter({ env: {}, fetchImpl: async () => classifierReply("banana"), getProviders: makeProviders() });
  assert.equal((await router.classify({ content: "hi" })).tier, "small");
  assert.equal((await router.classify({ content: "x".repeat(500) })).tier, "large");
  assert.equal((await router.classify({ content: "can you optimize this?" })).tier, "large");
  assert.equal((await router.classify({ content: "what? how? why?" })).tier, "large");
});

test("listLocalModels caches within TTL and refetches after expiry", async () => {
  let calls = 0;
  const router = createModelRouter({
    env: { MONOLITH_ROUTER_MODELS_CACHE_MS: "50" },
    fetchImpl: async (url) => {
      assert.match(url, /\/api\/tags$/); // /v1 stripped
      calls++;
      return jsonResponse({ models: [{ name: "qwen2.5:0.5b" }, { name: "llama3:8b" }] });
    },
    getProviders: makeProviders(),
  });
  const first = await router.listLocalModels();
  assert.deepEqual(first, ["qwen2.5:0.5b", "llama3:8b"]);
  await router.listLocalModels();
  assert.equal(calls, 1, "second call within TTL is served from cache");
  await new Promise((r) => setTimeout(r, 60));
  await router.listLocalModels();
  assert.equal(calls, 2, "call after TTL refetches");
});

test("listLocalModels returns last-good list on error", async () => {
  let ok = true;
  const router = createModelRouter({
    env: { MONOLITH_ROUTER_MODELS_CACHE_MS: "1" },
    fetchImpl: async () => (ok ? jsonResponse({ models: [{ name: "a:1b" }] }) : new Response("x", { status: 500 })),
    getProviders: makeProviders(),
  });
  assert.deepEqual(await router.listLocalModels(), ["a:1b"]);
  ok = false;
  await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(await router.listLocalModels(), ["a:1b"], "serves stale cache on failure");
});

test("describe reports config, installed flags, and local models", async () => {
  const router = createModelRouter({
    env: { MONOLITH_ROUTER_SMALL_MODEL: "qwen2.5:0.5b" },
    fetchImpl: async () => jsonResponse({ models: [{ name: "qwen2.5:0.5b" }] }),
    getProviders: makeProviders({ openrouter: true }),
  });
  const info = await router.describe();
  assert.equal(info.enabled, true);
  assert.equal(info.small.installed, true);
  assert.equal(info.large.installed, null); // openrouter model not checked against local list
  assert.deepEqual(info.localModels, ["qwen2.5:0.5b"]);
});

test("router disabled short-circuits classify to heuristic", async () => {
  const router = createModelRouter({
    env: { MONOLITH_ROUTER_ENABLED: "0" },
    fetchImpl: async () => classifierReply("COMPLEX"),
    getProviders: makeProviders(),
  });
  assert.equal(router.enabled(), false);
  const decision = await router.classify({ content: "hi" });
  assert.equal(decision.fallbackReason, "router_disabled");
});

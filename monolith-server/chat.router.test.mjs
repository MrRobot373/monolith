// Run: node --test monolith-server/chat.router.test.mjs
// Integration tests for smart routing over real HTTP. The fake fetchImpl branches
// on the request: /api/tags -> model list; classifier calls (stream:false) ->
// SIMPLE/COMPLEX; generation calls (stream:true) -> an SSE token stream. This is
// how we distinguish the classifier request from the generation request since
// both hit a /chat/completions-shaped endpoint.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createMonolithChat } from "./chat.mjs";

const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "monolith-router-"));

function sseResponse(chunks, { finish = "stop" } = {}) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const text of chunks) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`),
        );
      }
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: finish }] })}\n\n`),
      );
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

// Test knobs the fake provider reads.
let classifierAnswer = "SIMPLE"; // or "COMPLEX", or "FAIL" to simulate an error
let classifierCalls = 0;
let lastGenerationRequest = null;

const chat = createMonolithChat({
  dataDir: tmpBase,
  env: {
    OLLAMA_URL: "http://ollama-host:11434/v1",
    OLLAMA_MODEL: "default-large-local",
    OPENROUTER_API_KEY: "or-test-key",
    OPENROUTER_MODEL: "openrouter/big",
    MONOLITH_ROUTER_SMALL_MODEL: "small:0.5b",
    // large tier auto-resolves to openrouter (configured above)
  },
  fetchImpl: async (url, init) => {
    if (String(url).endsWith("/api/tags")) {
      return new Response(JSON.stringify({ models: [{ name: "small:0.5b" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    const body = JSON.parse(init.body);
    if (body.stream === false) {
      // classifier call
      classifierCalls++;
      if (classifierAnswer === "FAIL") return new Response("boom", { status: 500 });
      return new Response(JSON.stringify({ choices: [{ message: { content: classifierAnswer } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    // generation call
    lastGenerationRequest = { url, body };
    return sseResponse(["Answer."]);
  },
  log: () => {},
});

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (chat.handle(req, res, urlPath)) return;
  res.writeHead(404);
  res.end();
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/__monolith/chats`;

async function api(method, route = "", body) {
  const response = await fetch(`${base}${route}`, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, json: await response.json() };
}

async function streamMessage(chatId, body, route = "/messages") {
  const response = await fetch(`${base}/${chatId}${route}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const events = [];
  if (!response.headers.get("content-type")?.includes("text/event-stream")) {
    return { status: response.status, events, json: await response.json() };
  }
  const text = await response.text();
  for (const line of text.split("\n")) {
    if (line.startsWith("data: ")) events.push(JSON.parse(line.slice(6)));
  }
  return { status: response.status, events };
}

test.beforeEach(() => {
  classifierCalls = 0;
  lastGenerationRequest = null;
});

test.after(() => {
  server.close();
  fs.rmSync(tmpBase, { recursive: true, force: true });
});

test("simple message routes to the small model with a routing event", async () => {
  classifierAnswer = "SIMPLE";
  const { json } = await api("POST", "", {});
  const { events } = await streamMessage(json.chat.id, { content: "hi" });
  const routing = events.find((e) => e.type === "routing");
  assert.ok(routing, "routing event emitted");
  assert.equal(routing.tier, "small");
  assert.equal(routing.method, "llm");
  assert.equal(lastGenerationRequest.body.model, "small:0.5b");
  assert.equal(classifierCalls, 1);
});

test("complex message routes to the large model", async () => {
  classifierAnswer = "COMPLEX";
  const { json } = await api("POST", "", {});
  const { events } = await streamMessage(json.chat.id, { content: "design a distributed queue" });
  const routing = events.find((e) => e.type === "routing");
  assert.equal(routing.tier, "large");
  assert.equal(lastGenerationRequest.body.model, "openrouter/big");
});

test("explicit body.model bypasses routing entirely", async () => {
  classifierAnswer = "SIMPLE";
  const { json } = await api("POST", "", {});
  const { events } = await streamMessage(json.chat.id, { content: "hi", model: "pinned-model" });
  assert.equal(events.find((e) => e.type === "routing"), undefined, "no routing event");
  assert.equal(lastGenerationRequest.body.model, "pinned-model");
  assert.equal(classifierCalls, 0, "classifier never invoked");
});

test("autoRoute:false conversation bypasses routing", async () => {
  classifierAnswer = "COMPLEX";
  const { json } = await api("POST", "", { autoRoute: false });
  assert.equal(json.chat.autoRoute, false);
  const { events } = await streamMessage(json.chat.id, { content: "design a system" });
  assert.equal(events.find((e) => e.type === "routing"), undefined);
  assert.equal(classifierCalls, 0);
  // Falls back to the conversation/env default model.
  assert.equal(lastGenerationRequest.body.model, "default-large-local");
});

test("classifier failure falls back to heuristic and never downgrades a hard task", async () => {
  classifierAnswer = "FAIL";
  const { json } = await api("POST", "", {});
  const id = json.chat.id;
  // A message the heuristic flags as complex must still route large when the
  // classifier is down — the core "no silent downgrade" safety property.
  const { events } = await streamMessage(id, { content: "please refactor the auth module" });
  const routing = events.find((e) => e.type === "routing");
  assert.equal(routing.tier, "large", "must not downgrade a hard task on classifier failure");
  const conversation = (await api("GET", `/${id}`)).json.chat;
  assert.equal(conversation.runs[0].routed.method, "heuristic");
  assert.equal(conversation.runs[0].routed.fallbackReason, "classifier_http_500");
});

test("run telemetry routed field matches the routing event", async () => {
  classifierAnswer = "SIMPLE";
  const { json } = await api("POST", "", {});
  const id = json.chat.id;
  const { events } = await streamMessage(id, { content: "hi" });
  const routing = events.find((e) => e.type === "routing");
  const conversation = (await api("GET", `/${id}`)).json.chat;
  const routed = conversation.runs[0].routed;
  assert.equal(routed.tier, routing.tier);
  assert.equal(routed.classifierModel, routing.classifierModel);
  assert.equal(routed.method, routing.method);
});

test("providers endpoint includes router info and local models", async () => {
  classifierAnswer = "SIMPLE";
  const { json } = await api("GET", "/providers");
  assert.ok(json.router, "router info present");
  assert.equal(json.router.small.model, "small:0.5b");
  assert.equal(json.router.large.model, "openrouter/big");
  assert.ok(Array.isArray(json.router.localModels));
  assert.ok(json.router.localModels.includes("small:0.5b"));
});

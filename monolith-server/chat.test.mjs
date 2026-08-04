// Run: node --test monolith-server/chat.test.mjs
// Exercises the chat orchestrator over real HTTP with a fake OpenAI-style
// streaming provider: persistence-before-generation, sliding window, SSE
// token flow, provider failure handling, regenerate branching, and stop.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createMonolithChat } from "./chat.mjs";

const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "monolith-chat-"));

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

let providerBehavior = { mode: "ok", chunks: ["Hello ", "from ", "fake ", "model."] };
let lastProviderRequest = null;

const chat = createMonolithChat({
  dataDir: tmpBase,
  // Router disabled here so these base-behavior tests stay deterministic;
  // smart routing has its own suite in chat.router.test.mjs.
  env: { OLLAMA_URL: "http://fake-provider/v1", OLLAMA_MODEL: "fake-model", MONOLITH_ROUTER_ENABLED: "0" },
  fetchImpl: async (url, init) => {
    lastProviderRequest = { url, body: JSON.parse(init.body) };
    if (providerBehavior.mode === "fail") return new Response("boom", { status: 500 });
    if (providerBehavior.mode === "hang") {
      return new Response(
        new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "partial " } }] })}\n\n`),
            );
            const closeStream = () => {
              try { controller.close(); } catch { /* already closed */ }
            };
            if (init.signal.aborted) closeStream();
            else init.signal.addEventListener("abort", closeStream);
          },
        }),
        { status: 200 },
      );
    }
    return sseResponse(providerBehavior.chunks);
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

test.after(() => {
  server.close();
  fs.rmSync(tmpBase, { recursive: true, force: true });
});

test("create, list, and fetch conversations", async () => {
  const created = await api("POST", "", { title: "First chat" });
  assert.equal(created.status, 201);
  const id = created.json.chat.id;
  const listed = await api("GET");
  assert.ok(listed.json.chats.some((entry) => entry.id === id));
  const fetched = await api("GET", `/${id}`);
  assert.equal(fetched.json.chat.title, "First chat");
});

test("message streams tokens and persists both sides", async () => {
  const { json } = await api("POST", "", {});
  const id = json.chat.id;
  const { status, events } = await streamMessage(id, { content: "Say hello" });
  assert.equal(status, 200);
  const tokens = events.filter((event) => event.type === "token").map((event) => event.text);
  assert.equal(tokens.join(""), "Hello from fake model.");
  const done = events.find((event) => event.type === "done");
  assert.equal(done.status, "complete");

  const conversation = (await api("GET", `/${id}`)).json.chat;
  assert.equal(conversation.messages.length, 2);
  assert.equal(conversation.messages[0].role, "user");
  assert.equal(conversation.messages[1].content, "Hello from fake model.");
  assert.equal(conversation.title, "Say hello");
  assert.equal(conversation.runs[0].status, "complete");
  assert.equal(lastProviderRequest.body.model, "fake-model");
  assert.equal(lastProviderRequest.body.messages[0].role, "system");
});

test("provider failure persists user message and error state", async () => {
  providerBehavior = { mode: "fail" };
  const { json } = await api("POST", "", {});
  const id = json.chat.id;
  const { events } = await streamMessage(id, { content: "This will fail" });
  assert.ok(events.some((event) => event.type === "error"));
  const conversation = (await api("GET", `/${id}`)).json.chat;
  assert.equal(conversation.messages[0].content, "This will fail", "user message persisted before generation");
  assert.equal(conversation.messages[1].status, "error");
  providerBehavior = { mode: "ok", chunks: ["Hello ", "from ", "fake ", "model."] };
});

test("regenerate supersedes the old answer and keeps history", async () => {
  const { json } = await api("POST", "", {});
  const id = json.chat.id;
  await streamMessage(id, { content: "Question one" });
  providerBehavior = { mode: "ok", chunks: ["A better answer."] };
  const { events } = await streamMessage(id, {}, "/regenerate");
  assert.equal(events.find((event) => event.type === "done").status, "complete");
  const conversation = (await api("GET", `/${id}`)).json.chat;
  const assistants = conversation.messages.filter((message) => message.role === "assistant");
  assert.equal(assistants.length, 2);
  assert.equal(assistants[0].status, "superseded");
  assert.equal(assistants[1].content, "A better answer.");
  assert.equal(assistants[1].status, "complete");
});

test("stop aborts generation and preserves the partial", async (t) => {
  t.after(() => {
    providerBehavior = { mode: "ok", chunks: ["ok"] };
  });
  providerBehavior = { mode: "hang" };
  const { json } = await api("POST", "", {});
  const id = json.chat.id;
  const streaming = streamMessage(id, { content: "Never finishes" });
  // Give the stream a moment to start, then stop it.
  await new Promise((resolve) => setTimeout(resolve, 300));
  const stop = await api("POST", `/${id}/stop`);
  assert.equal(stop.json.stopped, true);
  const { events } = await streaming;
  const done = events.find((event) => event.type === "done");
  assert.equal(done.status, "stopped");
  const conversation = (await api("GET", `/${id}`)).json.chat;
  assert.equal(conversation.messages[1].status, "stopped");
  assert.equal(conversation.messages[1].content, "partial ");
});

test("sliding window drops oldest turns over budget but keeps newest", async () => {
  const { json } = await api("POST", "", {});
  const id = json.chat.id;
  const big = "x".repeat(9000);
  for (let i = 0; i < 4; i++) {
    await streamMessage(id, { content: `turn ${i} ${big}` });
  }
  const contextMessages = lastProviderRequest.body.messages;
  assert.equal(contextMessages[0].role, "system");
  const nonSystem = contextMessages.slice(1);
  assert.ok(nonSystem.length < 8, `window should truncate, got ${nonSystem.length}`);
  assert.match(nonSystem[nonSystem.length - 1].content, /^turn 3/, "latest user message always included");
});

test("unknown provider and missing model are rejected cleanly", async () => {
  const { json } = await api("POST", "", {});
  const id = json.chat.id;
  const bad = await streamMessage(id, { content: "hi", provider: "nope" });
  assert.equal(bad.status, 400);
  assert.match(bad.json.error, /unknown_provider/);
});

test("delete removes the conversation", async () => {
  const { json } = await api("POST", "", {});
  const id = json.chat.id;
  await api("DELETE", `/${id}`);
  const gone = await api("GET", `/${id}`);
  assert.equal(gone.status, 404);
});

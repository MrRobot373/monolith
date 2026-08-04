// MONOLITH Chat orchestrator (Chat/RAG plan, Chat P0).
// Dependency-free ESM, embedded like the scheduler under /__monolith/chats*.
// The browser never talks to a model provider directly: this layer persists the
// user message BEFORE generation, builds a budgeted sliding-window context,
// streams provider output to the client as JSON-lines SSE events, and persists
// the assistant message (including partials on stop/disconnect) with run
// telemetry. Summaries/RAG arrive in Chat P1/P2 — the context builder is
// already the single place they will plug into.
//
// Routes:
//   GET    /__monolith/chats                 list conversations
//   POST   /__monolith/chats                 { title?, provider?, model? }
//   GET    /__monolith/chats/:id             full conversation
//   PATCH  /__monolith/chats/:id             { title?, archived? }
//   DELETE /__monolith/chats/:id
//   POST   /__monolith/chats/:id/messages    { content, provider?, model? } -> SSE
//   POST   /__monolith/chats/:id/regenerate  { provider?, model? } -> SSE
//   POST   /__monolith/chats/:id/stop
//   GET    /__monolith/chats/providers       configured provider status (no secrets)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createModelRouter } from "./router.mjs";

// Rough char->token proxy until per-model profiles land (Chat P1).
const CONTEXT_CHAR_BUDGET = 24_000;
const MAX_MESSAGE_CHARS = 64_000;

// Distilled from docs/standing-instructions.md — the product's answer discipline.
const SYSTEM_PROMPT = [
  "You are MONOLITH, a dependable workplace assistant. Follow this answer discipline strictly:",
  "1. Answer the question actually asked. If the user's evidence points at a different problem, address both explicitly. If interpretations differ materially, open with 'Assuming X — say the word if you meant Y.'",
  "2. First line = the answer in the question's own terms. Then only reasoning that changes what the user does. End with 'Risks:' when assumptions or unverified points remain (each: risk, consequence, cheapest fix). Never open with background or 'It depends' — give the branch: 'If A, X. If B, Y.'",
  "3. Label every factual claim exactly one way: verified or definitional facts as plain statements; recalled-but-unverified facts as 'Likely: [claim] — [basis]'; working assumptions as 'Assumption: [claim]. If wrong: [what changes]'. An unhedged sentence is a promise of verification.",
  "4. Numbers, dates, totals: compute, do not pattern-match. Count date spans explicitly; cross-check totals against their parts. Fluent prose is not evidence.",
  "5. Never invent sources, page numbers, quotes, API signatures, or config keys. For a specific checkable fact you cannot verify, say 'I don't know [thing]', state what you do know that bounds it, and give the fastest way to find out. Two candidate recollections: report both as unverified, never pick the more fluent one.",
  "6. Facts about current state (prices, versions, latest releases) without a way to check: timestamp them ('As of my knowledge…') rather than presenting as current.",
  "7. Before finishing, attack your own conclusion once — what input or observation would break it? Fix it or state the surviving risk. Never send a conclusion you have privately refuted.",
  "8. Multi-part requests: answer every part or decline it out loud — no silent drops. Respect stated constraints (length, format, order) and check them by counting.",
  "9. Never claim you remembered something that is not in this conversation or its provided context.",
].join("\n");

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += String(chunk);
      if (Buffer.byteLength(body, "utf8") > maxBytes) {
        reject(new Error("request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body.trim() ? JSON.parse(body) : {});
      } catch {
        reject(new Error("invalid json"));
      }
    });
    req.on("error", reject);
  });
}

function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

export function createMonolithChat(options) {
  const dataDir = options.dataDir;
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || fetch;
  const log = options.log || ((...args) => console.log("[chat]", ...args));
  const chatsDir = path.join(dataDir, "chats");
  fs.mkdirSync(chatsDir, { recursive: true });

  // conversationId -> AbortController for in-flight generation
  const activeRuns = new Map();

  function providers() {
    const openrouterKey = String(env.OPENROUTER_API_KEY || "").trim();
    return {
      ollama: {
        configured: true,
        baseUrl: String(env.OLLAMA_URL || "http://localhost:11434/v1").replace(/\/+$/, ""),
        headers: {},
      },
      openrouter: {
        configured: Boolean(openrouterKey),
        baseUrl: String(env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, ""),
        headers: openrouterKey ? { authorization: `Bearer ${openrouterKey}` } : {},
      },
      // Docker-stack cloud gateway (LiteLLM). Lets the "large" tier reach real
      // cloud models (e.g. the `claude` alias) when a gateway is configured.
      litellm: (() => {
        const gatewayUrl = String(env.MONOLITH_GATEWAY_URL || env.LITELLM_URL || "").trim();
        const gatewayKey = String(env.MONOLITH_GATEWAY_KEY || env.LITELLM_MASTER_KEY || "").trim();
        const baseUrl = env.MONOLITH_GATEWAY_URL
          ? String(env.MONOLITH_GATEWAY_URL)
          : gatewayUrl
            ? `${gatewayUrl.replace(/\/+$/, "")}/v1`
            : "";
        return {
          configured: Boolean(gatewayUrl),
          baseUrl: baseUrl.replace(/\/+$/, ""),
          headers: gatewayKey ? { authorization: `Bearer ${gatewayKey}` } : {},
        };
      })(),
    };
  }

  const router = createModelRouter({ env, fetchImpl, log, getProviders: providers });

  function conversationPath(id) {
    if (!/^chat_[a-f0-9]{16}$/.test(id)) return null;
    return path.join(chatsDir, `${id}.json`);
  }

  function loadConversation(id) {
    const file = conversationPath(id);
    if (!file || !fs.existsSync(file)) return null;
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      return null;
    }
  }

  function saveConversation(conversation) {
    conversation.updatedAt = Date.now();
    const file = conversationPath(conversation.id);
    const tmp = `${file}.tmp-${crypto.randomBytes(4).toString("hex")}`;
    fs.writeFileSync(tmp, JSON.stringify(conversation, null, 2) + "\n");
    fs.renameSync(tmp, file);
  }

  function listConversations(owner) {
    const items = [];
    for (const file of fs.readdirSync(chatsDir)) {
      if (!file.endsWith(".json")) continue;
      try {
        const conversation = JSON.parse(fs.readFileSync(path.join(chatsDir, file), "utf8"));
        if (owner && conversation.createdBy !== owner) continue;
        items.push({
          id: conversation.id,
          title: conversation.title,
          provider: conversation.provider,
          model: conversation.model,
          archived: Boolean(conversation.archived),
          autoRoute: conversation.autoRoute !== false,
          updatedAt: conversation.updatedAt,
          messageCount: conversation.messages.filter((message) => message.status !== "superseded").length,
        });
      } catch {
        // skip corrupt conversation file
      }
    }
    items.sort((a, b) => b.updatedAt - a.updatedAt);
    return items;
  }

  /**
   * Sliding-window context (Chat P0 form): system prompt + newest messages
   * that fit the char budget, oldest dropped first, never dropping the latest
   * user message. Returns messages plus whether older turns were omitted.
   */
  function buildContext(conversation) {
    const usable = conversation.messages.filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        message.status !== "superseded" &&
        message.content,
    );
    const selected = [];
    let used = 0;
    for (let i = usable.length - 1; i >= 0; i--) {
      const cost = usable[i].content.length + 20;
      if (selected.length > 0 && used + cost > CONTEXT_CHAR_BUDGET) break;
      selected.unshift({ role: usable[i].role, content: usable[i].content });
      used += cost;
    }
    return {
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...selected],
      truncated: selected.length < usable.length,
      windowMessages: selected.length,
    };
  }

  function pickProviderModel(conversation, body) {
    const registry = providers();
    const provider = String(body.provider || conversation.provider || "ollama");
    const model = String(body.model || conversation.model || env.OLLAMA_MODEL || "").trim();
    const entry = registry[provider];
    if (!entry) throw new Error(`unknown_provider:${provider}`);
    if (!entry.configured) throw new Error(`provider_not_configured:${provider}`);
    if (!model) throw new Error("model_required");
    return { provider, model, entry };
  }

  /** Stream one completion; emits {type:"token"|"done"|"error"} SSE events. */
  async function generate(res, conversation, provider, model, entry, signal, routingDecision) {
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    const emit = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);

    if (routingDecision) {
      emit({
        type: "routing",
        tier: routingDecision.tier,
        provider: routingDecision.provider,
        model: routingDecision.model,
        classifierModel: routingDecision.classifierModel,
        method: routingDecision.method,
      });
    }

    const context = buildContext(conversation);
    if (context.truncated) emit({ type: "context", truncated: true, windowMessages: context.windowMessages });

    const assistantMessage = {
      id: newId("msg"),
      role: "assistant",
      content: "",
      createdAt: Date.now(),
      status: "streaming",
      provider,
      model,
    };
    conversation.messages.push(assistantMessage);
    saveConversation(conversation);
    emit({ type: "message", id: assistantMessage.id, role: "assistant" });

    const startedAt = Date.now();
    let finish = "stop";
    let usage = null;
    try {
      const response = await fetchImpl(`${entry.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", ...entry.headers },
        body: JSON.stringify({ model, messages: context.messages, stream: true }),
        signal,
      });
      if (!response.ok) {
        const text = (await response.text().catch(() => "")).slice(0, 300);
        throw new Error(`provider ${response.status}: ${text}`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const data = line.replace(/^data:\s?/, "").trim();
          if (!data || !line.startsWith("data:")) continue;
          if (data === "[DONE]") continue;
          let chunk;
          try {
            chunk = JSON.parse(data);
          } catch {
            continue;
          }
          const delta = chunk.choices?.[0]?.delta?.content || "";
          if (delta) {
            assistantMessage.content += delta;
            emit({ type: "token", text: delta });
          }
          if (chunk.usage) usage = chunk.usage;
          if (chunk.choices?.[0]?.finish_reason) finish = chunk.choices[0].finish_reason;
        }
      }
      // A stop/disconnect can also surface as a graceful stream end, not an
      // AbortError — the signal, not the loop exit, decides the final status.
      assistantMessage.status = signal.aborted ? "stopped" : "complete";
      if (signal.aborted) finish = "stopped";
    } catch (error) {
      if (signal.aborted) {
        assistantMessage.status = "stopped";
        finish = "stopped";
      } else {
        assistantMessage.status = "error";
        assistantMessage.error = error.message;
        finish = "error";
        log(`generation failed (${provider}/${model}):`, error.message);
        emit({ type: "error", error: error.message });
      }
    }

    conversation.runs = [
      {
        messageId: assistantMessage.id,
        provider,
        model,
        latencyMs: Date.now() - startedAt,
        outputChars: assistantMessage.content.length,
        contextMessages: context.messages.length,
        usage,
        status: assistantMessage.status,
        routed: routingDecision
          ? {
              tier: routingDecision.tier,
              classifierModel: routingDecision.classifierModel,
              method: routingDecision.method,
              ...(routingDecision.fallbackReason ? { fallbackReason: routingDecision.fallbackReason } : {}),
            }
          : null,
      },
      ...(conversation.runs || []),
    ].slice(0, 50);
    saveConversation(conversation);
    emit({
      type: "done",
      messageId: assistantMessage.id,
      status: assistantMessage.status,
      finishReason: finish,
      latencyMs: Date.now() - startedAt,
    });
    res.end();
  }

  function actorOf(req) {
    return req.monolithUser?.email || req.monolithUser?.id || "local";
  }

  /** Returns true when the request was handled. */
  function handle(req, res, urlPath) {
    if (!urlPath.startsWith("/__monolith/chats")) return false;
    const rest = urlPath.slice("/__monolith/chats".length).replace(/^\//, "");
    const [id, action] = rest.split("/");

    const respond = async () => {
      if (req.method === "GET" && id === "providers") {
        const registry = providers();
        sendJson(res, 200, {
          ok: true,
          providers: Object.fromEntries(
            Object.entries(registry).map(([name, entry]) => [name, { configured: entry.configured }]),
          ),
          defaultModel: env.OLLAMA_MODEL || null,
          router: await router.describe(),
        });
        return;
      }

      if (req.method === "GET" && !id) {
        sendJson(res, 200, { ok: true, chats: listConversations(actorOf(req)) });
        return;
      }

      if (req.method === "POST" && !id) {
        const body = await readJsonBody(req);
        const conversation = {
          id: newId("chat"),
          title: String(body.title || "").trim() || "New chat",
          provider: String(body.provider || "ollama"),
          model: String(body.model || env.OLLAMA_MODEL || "").trim(),
          createdBy: actorOf(req),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          archived: false,
          autoRoute: body.autoRoute === undefined ? true : Boolean(body.autoRoute),
          messages: [],
          runs: [],
        };
        saveConversation(conversation);
        sendJson(res, 201, { ok: true, chat: conversation });
        return;
      }

      const conversation = loadConversation(id);
      if (!conversation || conversation.createdBy !== actorOf(req)) {
        sendJson(res, 404, { ok: false, error: "chat_not_found" });
        return;
      }

      if (req.method === "GET" && !action) {
        sendJson(res, 200, { ok: true, chat: conversation });
        return;
      }

      if (req.method === "PATCH" && !action) {
        const body = await readJsonBody(req);
        if (body.title !== undefined) conversation.title = String(body.title).trim() || conversation.title;
        if (body.archived !== undefined) conversation.archived = Boolean(body.archived);
        if (body.autoRoute !== undefined) conversation.autoRoute = Boolean(body.autoRoute);
        saveConversation(conversation);
        sendJson(res, 200, { ok: true, chat: conversation });
        return;
      }

      if (req.method === "DELETE" && !action) {
        activeRuns.get(id)?.abort();
        fs.rmSync(conversationPath(id), { force: true });
        sendJson(res, 200, { ok: true });
        return;
      }

      if (req.method === "POST" && action === "stop") {
        const controller = activeRuns.get(id);
        controller?.abort();
        sendJson(res, 200, { ok: true, stopped: Boolean(controller) });
        return;
      }

      if (req.method === "POST" && (action === "messages" || action === "regenerate")) {
        if (activeRuns.has(id)) {
          sendJson(res, 409, { ok: false, error: "generation_in_progress" });
          return;
        }
        const body = await readJsonBody(req);

        if (action === "messages") {
          const content = String(body.content || "").trim();
          if (!content) {
            sendJson(res, 400, { ok: false, error: "content_required" });
            return;
          }
          if (content.length > MAX_MESSAGE_CHARS) {
            sendJson(res, 413, { ok: false, error: "message_too_long" });
            return;
          }
          // Persist the user message before any generation (plan rule #2).
          conversation.messages.push({
            id: newId("msg"),
            role: "user",
            content,
            createdAt: Date.now(),
            status: "complete",
          });
          if (conversation.messages.filter((message) => message.role === "user").length === 1) {
            conversation.title = content.slice(0, 60);
          }
          saveConversation(conversation);
        } else {
          // Regenerate: supersede trailing assistant responses, keep history.
          let superseded = 0;
          for (let i = conversation.messages.length - 1; i >= 0; i--) {
            const message = conversation.messages[i];
            if (message.role !== "assistant" || message.status === "superseded") break;
            message.status = "superseded";
            superseded++;
          }
          if (!conversation.messages.some((message) => message.role === "user")) {
            sendJson(res, 400, { ok: false, error: "nothing_to_regenerate" });
            return;
          }
          saveConversation(conversation);
          if (superseded === 0) log(`regenerate on ${id}: no assistant message to supersede (retrying last user turn)`);
        }

        // Smart routing: unless the caller pinned an explicit model, or the
        // conversation opted out, or the router is disabled, let the classifier
        // pick the tier. Explicit body.model always wins (routing skipped).
        const explicitModel = Boolean(String(body.model || "").trim());
        const latestUserContent =
          action === "messages"
            ? String(body.content || "")
            : [...conversation.messages].reverse().find((m) => m.role === "user")?.content || "";
        let routingDecision = null;
        let effectiveBody = body;
        if (!explicitModel && conversation.autoRoute !== false && router.enabled()) {
          try {
            routingDecision = await router.classify({ content: latestUserContent });
          } catch (error) {
            // classify() is designed not to throw; this is the true safety net
            // for unexpected bugs — fall back to the large tier, never small.
            log(`router failed, falling back to large tier: ${error.message}`);
            const large = router.largeTarget();
            routingDecision = {
              tier: "large",
              provider: large.provider,
              model: large.model,
              classifierModel: null,
              method: "error-fallback",
              fallbackReason: error.message,
            };
          }
          effectiveBody = { ...body, provider: routingDecision.provider, model: routingDecision.model };
        }

        let selection;
        try {
          selection = pickProviderModel(conversation, effectiveBody);
        } catch (error) {
          sendJson(res, 400, { ok: false, error: error.message });
          return;
        }
        conversation.provider = selection.provider;
        conversation.model = selection.model;

        const controller = new AbortController();
        activeRuns.set(id, controller);
        req.on("close", () => controller.abort());
        try {
          await generate(res, conversation, selection.provider, selection.model, selection.entry, controller.signal, routingDecision);
        } finally {
          activeRuns.delete(id);
        }
        return;
      }

      sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    };

    respond().catch((error) => {
      log("chat request failed:", error.message);
      if (!res.headersSent) sendJson(res, 500, { ok: false, error: "internal_error" });
      else res.end();
    });
    return true;
  }

  return { handle };
}

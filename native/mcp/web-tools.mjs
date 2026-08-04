// MONOLITH web-tools MCP server (Tools guide Tier 3: web search + URL fetch).
// Dependency-free stdio JSON-RPC server following the Model Context Protocol;
// seeded into every workspace's opencode.json as the "monolith-web" MCP so the
// agent gets web reach in native mode (the Docker stack additionally has
// Perplexica/vane for cited search).
//
// Search backend: SEARXNG_URL (self-hosted, preferred) when set in native/.env,
// otherwise DuckDuckGo's HTML endpoint (no API key). Fetch extracts readable
// text from a page with tags stripped and output capped.
//
// Manual test:
//   node native/mcp/web-tools.mjs   # then paste JSON-RPC lines on stdin
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.join(HERE, "..", ".env")); } catch { /* no .env */ }

const SEARXNG_URL = String(process.env.SEARXNG_URL || "").trim().replace(/\/+$/, "");
const MAX_FETCH_CHARS = 8000;
const MAX_RESULTS = 8;
const USER_AGENT = "Mozilla/5.0 (compatible; MonolithAgent/1.0)";

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#x?\d+;|&#\d+;/g, " ").replace(/&nbsp;/g, " ");
}

function stripHtml(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<(nav|footer|header|aside)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>(?=.)/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li|tr|section|article)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function searchSearxng(query, limit) {
  const url = `${SEARXNG_URL}/search?q=${encodeURIComponent(query)}&format=json`;
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`searxng ${response.status}`);
  const body = await response.json();
  return (body.results || []).slice(0, limit).map((result) => ({
    title: result.title || "",
    url: result.url || "",
    snippet: (result.content || "").slice(0, 300),
  }));
}

async function searchDuckDuckGo(query, limit) {
  const response = await fetch(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(15_000) },
  );
  if (!response.ok) throw new Error(`duckduckgo ${response.status}`);
  const html = await response.text();
  const results = [];
  const linkPattern = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetPattern = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  const snippets = [...html.matchAll(snippetPattern)].map((match) => stripHtml(match[1]));
  let match;
  let index = 0;
  while ((match = linkPattern.exec(html)) && results.length < limit) {
    let url = match[1];
    // DDG wraps result URLs as /l/?uddg=<encoded>
    const wrapped = url.match(/[?&]uddg=([^&]+)/);
    if (wrapped) url = decodeURIComponent(wrapped[1]);
    if (url.startsWith("//")) url = `https:${url}`;
    results.push({
      title: stripHtml(match[2]),
      url,
      snippet: (snippets[index] || "").slice(0, 300),
    });
    index++;
  }
  return results;
}

async function webSearch({ query, limit }) {
  const capped = Math.min(MAX_RESULTS, Math.max(1, Number(limit) || 5));
  const results = SEARXNG_URL
    ? await searchSearxng(query, capped)
    : await searchDuckDuckGo(query, capped);
  if (!results.length) return "No results found.";
  return results
    .map((result, i) => `${i + 1}. ${result.title}\n   ${result.url}\n   ${result.snippet}`)
    .join("\n\n");
}

async function fetchUrl({ url }) {
  const parsed = new URL(url);
  if (!/^https?:$/.test(parsed.protocol)) throw new Error("only http(s) URLs are supported");
  // No requests to private/loopback hosts: this tool is for the public web.
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[::1\])/.test(parsed.hostname)) {
    throw new Error("private/loopback hosts are not allowed");
  }
  const response = await fetch(parsed, {
    headers: { "user-agent": USER_AGENT, accept: "text/html,text/plain,*/*" },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`fetch failed: HTTP ${response.status}`);
  const type = response.headers.get("content-type") || "";
  const raw = await response.text();
  const text = /html/.test(type) ? stripHtml(raw) : raw;
  const truncated = text.length > MAX_FETCH_CHARS;
  return `${parsed.href}\n\n${text.slice(0, MAX_FETCH_CHARS)}${truncated ? "\n\n[truncated]" : ""}`;
}

const TOOLS = [
  {
    name: "web_search",
    description:
      "Search the web for current information, news, documentation, and facts. " +
      "Returns titles, URLs, and snippets. Use fetch_url to read a promising result in full.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        limit: { type: "number", description: "Max results (default 5, max 8)" },
      },
      required: ["query"],
    },
    run: webSearch,
  },
  {
    name: "fetch_url",
    description:
      "Fetch a public http(s) URL and return its readable text content (tags stripped, capped). " +
      "Use for documentation pages, articles, and reading search results in depth.",
    inputSchema: {
      type: "object",
      properties: { url: { type: "string", description: "Absolute http(s) URL" } },
      required: ["url"],
    },
    run: fetchUrl,
  },
];

// ---- MCP stdio transport (JSON-RPC 2.0, newline-delimited) ------------------
function reply(id, result, error) {
  const message = error
    ? { jsonrpc: "2.0", id, error: { code: -32000, message: String(error) } }
    : { jsonrpc: "2.0", id, result };
  process.stdout.write(JSON.stringify(message) + "\n");
}

async function dispatch(request) {
  const { id, method, params } = request;
  if (method === "initialize") {
    reply(id, {
      protocolVersion: params?.protocolVersion || "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "monolith-web", version: "1.0.0" },
    });
    return;
  }
  if (method === "notifications/initialized" || String(method || "").startsWith("notifications/")) {
    return; // notifications get no response
  }
  if (method === "ping") {
    reply(id, {});
    return;
  }
  if (method === "tools/list") {
    reply(id, {
      tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
    });
    return;
  }
  if (method === "tools/call") {
    const tool = TOOLS.find((entry) => entry.name === params?.name);
    if (!tool) {
      reply(id, undefined, `unknown tool: ${params?.name}`);
      return;
    }
    try {
      const text = await tool.run(params?.arguments || {});
      reply(id, { content: [{ type: "text", text }], isError: false });
    } catch (error) {
      reply(id, { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true });
    }
    return;
  }
  if (id !== undefined) reply(id, undefined, `method not supported: ${method}`);
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  const lines = buffer.split("\n");
  buffer = lines.pop() || "";
  for (const line of lines) {
    if (!line.trim()) continue;
    let request;
    try {
      request = JSON.parse(line);
    } catch {
      continue;
    }
    void dispatch(request).catch((error) => {
      if (request.id !== undefined) reply(request.id, undefined, error.message);
    });
  }
});
process.stdin.on("end", () => process.exit(0));

// Typed client for the MONOLITH chat backend (monolith-server/chat.mjs), mounted
// at /__monolith/chats*. Same-origin relative paths + Supabase bearer via
// monolithFetch/monolithJson, matching the existing monolith-api convention.
import { monolithFetch, monolithJson } from "./monolith-api";
import { parseSseStream } from "./monolith-chat-sse";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  status?: string;
  provider?: string;
  model?: string;
  error?: string;
};

export type ChatRouted = {
  tier: "small" | "large";
  classifierModel: string | null;
  method: string;
  fallbackReason?: string;
};

export type ChatRun = {
  messageId: string;
  provider: string;
  model: string;
  latencyMs: number;
  outputChars: number;
  status: string;
  routed: ChatRouted | null;
};

export type ChatSummary = {
  id: string;
  title: string;
  provider?: string;
  model?: string;
  archived: boolean;
  autoRoute: boolean;
  updatedAt: number;
  messageCount: number;
};

export type ChatConversation = {
  id: string;
  title: string;
  provider?: string;
  model?: string;
  autoRoute: boolean;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  runs: ChatRun[];
};

export type RouterTarget = { provider: string; model: string; installed: boolean | null };

export type ChatProvidersInfo = {
  ok: boolean;
  providers: Record<string, { configured: boolean }>;
  defaultModel: string | null;
  router: {
    enabled: boolean;
    small: RouterTarget;
    large: RouterTarget;
    classifier: RouterTarget;
    localModels: string[];
  };
};

export type ChatSendBody = {
  content?: string;
  provider?: string;
  model?: string;
};

export type ChatSseEvent = Record<string, unknown> & { type?: string };

export async function listChats(): Promise<ChatSummary[]> {
  const body = await monolithJson<{ ok: boolean; chats: ChatSummary[] }>("/__monolith/chats");
  return body.chats;
}

export async function createChat(input: { title?: string; autoRoute?: boolean } = {}): Promise<ChatConversation> {
  const body = await monolithJson<{ ok: boolean; chat: ChatConversation }>("/__monolith/chats", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return body.chat;
}

export async function getChat(id: string): Promise<ChatConversation> {
  const body = await monolithJson<{ ok: boolean; chat: ChatConversation }>(`/__monolith/chats/${id}`);
  return body.chat;
}

export async function patchChat(
  id: string,
  input: { title?: string; archived?: boolean; autoRoute?: boolean },
): Promise<ChatConversation> {
  const body = await monolithJson<{ ok: boolean; chat: ChatConversation }>(`/__monolith/chats/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return body.chat;
}

export async function deleteChat(id: string): Promise<void> {
  await monolithJson(`/__monolith/chats/${id}`, { method: "DELETE" });
}

export async function stopChat(id: string): Promise<void> {
  await monolithJson(`/__monolith/chats/${id}/stop`, { method: "POST" });
}

export async function getChatProviders(): Promise<ChatProvidersInfo> {
  return monolithJson<ChatProvidersInfo>("/__monolith/chats/providers");
}

async function streamRoute(
  id: string,
  route: "messages" | "regenerate",
  body: ChatSendBody,
  onEvent: (event: ChatSseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await monolithFetch(`/__monolith/chats/${id}/${route}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error || `${response.status}`);
  }
  await parseSseStream(response, onEvent);
}

export function sendMessage(
  id: string,
  body: ChatSendBody,
  onEvent: (event: ChatSseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  return streamRoute(id, "messages", body, onEvent, signal);
}

export function regenerate(
  id: string,
  body: ChatSendBody,
  onEvent: (event: ChatSseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  return streamRoute(id, "regenerate", body, onEvent, signal);
}

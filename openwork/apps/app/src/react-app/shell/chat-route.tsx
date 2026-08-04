/** @jsxImportSource react */
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { t } from "@/i18n";
import {
  getChat,
  patchChat,
  sendMessage,
  stopChat,
  type ChatConversation,
  type ChatSseEvent,
} from "@/app/lib/monolith-chat-api";
import { useMonolithAuth } from "@/react-app/domains/settings/cloud/monolith-auth";
import { ChatConversationList, CHATS_QUERY_KEY } from "./chat/chat-conversation-list";
import { ChatMessageThread } from "./chat/chat-message-thread";
import { ChatInput } from "./chat/chat-input";

type StreamingRouted = { tier: "small" | "large"; model: string };

export function ChatRoute() {
  const auth = useMonolithAuth();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [streamingRouted, setStreamingRouted] = useState<StreamingRouted | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const refreshConversation = useCallback(async (id: string) => {
    const next = await getChat(id).catch(() => null);
    setConversation(next);
    return next;
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setConversation(null);
      return;
    }
    void refreshConversation(selectedId);
  }, [selectedId, refreshConversation]);

  const handleSend = useCallback(
    async (content: string) => {
      if (!selectedId || isStreaming) return;
      setIsStreaming(true);
      setStreamingText("");
      setStreamingRouted(null);
      const controller = new AbortController();
      abortRef.current = controller;

      let accumulated = "";
      const onEvent = (event: ChatSseEvent) => {
        if (event.type === "routing") {
          setStreamingRouted({ tier: event.tier as "small" | "large", model: String(event.model) });
        } else if (event.type === "token") {
          accumulated += String(event.text ?? "");
          setStreamingText(accumulated);
        }
      };

      try {
        await sendMessage(selectedId, { content }, onEvent, controller.signal);
      } catch {
        // surfaced by refresh (error message persists server-side)
      } finally {
        abortRef.current = null;
        setIsStreaming(false);
        setStreamingText("");
        setStreamingRouted(null);
        await refreshConversation(selectedId);
        void queryClient.invalidateQueries({ queryKey: CHATS_QUERY_KEY });
      }
    },
    [selectedId, isStreaming, refreshConversation, queryClient],
  );

  const handleStop = useCallback(async () => {
    if (!selectedId) return;
    await stopChat(selectedId).catch(() => {});
    abortRef.current?.abort();
  }, [selectedId]);

  const handleAutoRouteChange = useCallback(
    async (value: boolean) => {
      if (!selectedId) return;
      setConversation((current) => (current ? { ...current, autoRoute: value } : current));
      await patchChat(selectedId, { autoRoute: value }).catch(() => {});
      void queryClient.invalidateQueries({ queryKey: CHATS_QUERY_KEY });
    },
    [selectedId, queryClient],
  );

  if (auth.isRequired && !auth.isSignedIn) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">{t("monolith.chat.sign_in_required")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-background">
      <ChatConversationList selectedId={selectedId} onSelect={setSelectedId} />
      <div className="flex min-w-0 flex-1 flex-col">
        {selectedId ? (
          <>
            <ChatMessageThread
              conversation={conversation}
              streamingText={streamingText}
              streamingRouted={streamingRouted}
              isStreaming={isStreaming}
            />
            <ChatInput
              disabled={!selectedId}
              isStreaming={isStreaming}
              autoRoute={conversation?.autoRoute !== false}
              onAutoRouteChange={handleAutoRouteChange}
              onSend={handleSend}
              onStop={handleStop}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">{t("monolith.chat.empty_thread")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

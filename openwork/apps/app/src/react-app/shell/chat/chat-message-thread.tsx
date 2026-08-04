/** @jsxImportSource react */
import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import type { ChatConversation, ChatMessage, ChatRun } from "@/app/lib/monolith-chat-api";

type ChatMessageThreadProps = {
  conversation: ChatConversation | null;
  streamingText: string;
  streamingRouted: { tier: "small" | "large"; model: string } | null;
  isStreaming: boolean;
};

function runFor(conversation: ChatConversation | null, messageId: string): ChatRun | undefined {
  return conversation?.runs?.find((run) => run.messageId === messageId);
}

// Per-assistant-message model provenance: the pitch-critical proof. When the
// message was auto-routed we show which tier/model the router chose; otherwise a
// plain model caption so we never imply routing that didn't happen.
function ModelBadge({ run }: { run: ChatRun | undefined }) {
  if (!run) return null;
  if (run.routed) {
    const tierLabel = run.routed.tier === "small" ? t("monolith.chat.tier_small") : t("monolith.chat.tier_large");
    return (
      <Badge variant="secondary" className="mt-1.5 gap-1">
        <Sparkles className="size-3" />
        {t("monolith.chat.routed_badge", { model: run.model, tier: tierLabel })}
      </Badge>
    );
  }
  return (
    <span className="mt-1.5 block text-xs text-muted-foreground">
      {t("monolith.chat.model_caption", { model: run.model })}
    </span>
  );
}

export function ChatMessageThread({
  conversation,
  streamingText,
  streamingRouted,
  isStreaming,
}: ChatMessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const visible = (conversation?.messages ?? []).filter((m) => m.status !== "superseded");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visible.length, streamingText]);

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        {visible.length === 0 && !isStreaming ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {t("monolith.chat.empty_thread")}
          </p>
        ) : null}

        {visible.map((message: ChatMessage) => (
          <div
            key={message.id}
            className={cn("flex flex-col", message.role === "user" ? "items-end" : "items-start")}
          >
            <div
              className={cn(
                "max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground",
              )}
            >
              {message.content || (message.status === "error" ? message.error : "")}
            </div>
            {message.role === "assistant" ? <ModelBadge run={runFor(conversation, message.id)} /> : null}
          </div>
        ))}

        {isStreaming ? (
          <div className="flex flex-col items-start">
            <div className="max-w-[90%] whitespace-pre-wrap rounded-2xl bg-muted px-4 py-2.5 text-sm text-foreground">
              {streamingText || <span className="text-muted-foreground">{t("monolith.chat.thinking")}</span>}
            </div>
            {streamingRouted ? (
              <Badge variant="secondary" className="mt-1.5 gap-1">
                <Sparkles className="size-3" />
                {t("monolith.chat.routed_badge", {
                  model: streamingRouted.model,
                  tier: streamingRouted.tier === "small" ? t("monolith.chat.tier_small") : t("monolith.chat.tier_large"),
                })}
              </Badge>
            ) : null}
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}

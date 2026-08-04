/** @jsxImportSource react */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import { createChat, deleteChat, listChats, type ChatSummary } from "@/app/lib/monolith-chat-api";

export const CHATS_QUERY_KEY = ["monolith-chats"] as const;

type ChatConversationListProps = {
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function ChatConversationList({ selectedId, onSelect }: ChatConversationListProps) {
  const queryClient = useQueryClient();
  const { data: chats = [], isLoading } = useQuery({
    queryKey: CHATS_QUERY_KEY,
    queryFn: listChats,
  });

  const create = useMutation({
    mutationFn: () => createChat({}),
    onSuccess: (chat) => {
      void queryClient.invalidateQueries({ queryKey: CHATS_QUERY_KEY });
      onSelect(chat.id);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteChat(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: CHATS_QUERY_KEY }),
  });

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-background">
      <div className="flex items-center justify-between gap-2 px-3 py-3">
        <span className="text-sm font-medium text-foreground">{t("monolith.chat.title")}</span>
        <Button size="xs" onClick={() => create.mutate()} disabled={create.isPending}>
          <Plus className="size-3" />
          {t("monolith.chat.new_chat")}
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-0.5 px-2 pb-2">
          {isLoading ? null : chats.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">{t("monolith.chat.no_chats")}</p>
          ) : (
            chats.map((chat: ChatSummary) => (
              <div
                key={chat.id}
                className={cn(
                  "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors",
                  chat.id === selectedId ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                )}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left"
                  onClick={() => onSelect(chat.id)}
                >
                  {chat.title || t("monolith.chat.new_chat")}
                </button>
                <button
                  type="button"
                  aria-label={t("monolith.chat.delete")}
                  className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  onClick={() => remove.mutate(chat.id)}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

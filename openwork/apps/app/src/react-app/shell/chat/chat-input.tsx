/** @jsxImportSource react */
import { useState, type KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/i18n";

type ChatInputProps = {
  disabled: boolean;
  isStreaming: boolean;
  autoRoute: boolean;
  onAutoRouteChange: (value: boolean) => void;
  onSend: (content: string) => void;
  onStop: () => void;
};

export function ChatInput({
  disabled,
  isStreaming,
  autoRoute,
  onAutoRouteChange,
  onSend,
  onStop,
}: ChatInputProps) {
  const [value, setValue] = useState("");

  const submit = () => {
    const content = value.trim();
    if (!content || isStreaming) return;
    onSend(content);
    setValue("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-border bg-background px-4 py-3">
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        <div className="flex items-end gap-2">
          <Textarea
            className="max-h-40 min-h-11 flex-1 resize-none"
            placeholder={t("monolith.chat.input_placeholder")}
            value={value}
            disabled={disabled}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          {isStreaming ? (
            <Button variant="outline" size="icon" onClick={onStop} aria-label={t("monolith.chat.stop")}>
              <Square className="size-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={submit}
              disabled={disabled || !value.trim()}
              aria-label={t("monolith.chat.send")}
            >
              <Send className="size-4" />
            </Button>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch size="sm" checked={autoRoute} onCheckedChange={onAutoRouteChange} disabled={disabled} />
          <span className="font-medium text-foreground">{t("monolith.chat.auto_route_label")}</span>
          <span>{t("monolith.chat.auto_route_hint")}</span>
        </label>
      </div>
    </div>
  );
}

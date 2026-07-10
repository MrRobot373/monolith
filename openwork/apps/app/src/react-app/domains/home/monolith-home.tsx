/** @jsxImportSource react */
import { useState, type ComponentType } from "react";
import {
  ArrowUp,
  BarChart3,
  CalendarClock,
  FilePlus2,
  FolderOpen,
  PenLine,
  Shuffle,
  Table2,
} from "lucide-react";

import { t } from "../../../i18n";
import { MonolithMark } from "../../design-system/monolith-mark";

type Suggestion = {
  id: string;
  icon: ComponentType<{ className?: string }>;
  titleKey: string;
  promptKey: string;
};

/**
 * Cowork-style starter cards. Titles/prompts live in i18n so they can be
 * localized; the set itself will become org-configurable via monolith-server.
 */
const SUGGESTIONS: Suggestion[] = [
  { id: "organize", icon: FolderOpen, titleKey: "monolith.suggest.organize.title", promptKey: "monolith.suggest.organize.prompt" },
  { id: "insights", icon: BarChart3, titleKey: "monolith.suggest.insights.title", promptKey: "monolith.suggest.insights.prompt" },
  { id: "create", icon: FilePlus2, titleKey: "monolith.suggest.create.title", promptKey: "monolith.suggest.create.prompt" },
  { id: "crunch", icon: Table2, titleKey: "monolith.suggest.crunch.title", promptKey: "monolith.suggest.crunch.prompt" },
  { id: "meeting", icon: CalendarClock, titleKey: "monolith.suggest.meeting.title", promptKey: "monolith.suggest.meeting.prompt" },
  { id: "draft", icon: PenLine, titleKey: "monolith.suggest.draft.title", promptKey: "monolith.suggest.draft.prompt" },
];

export function MonolithHomeHero() {
  return (
    <div className="flex flex-col items-start gap-3 px-1 text-left">
      <div className="flex items-center gap-3">
        <MonolithMark size={34} className="shrink-0 text-dls-accent" />
        <h1 className="font-display text-[34px] font-semibold leading-tight tracking-tight text-dls-text">
          {t("monolith.home.headline")}
        </h1>
      </div>
      <p className="text-[13px] text-dls-secondary">{t("monolith.home.notice")}</p>
    </div>
  );
}

type MonolithStartComposerProps = {
  workspaceName?: string;
  disabled?: boolean;
  onStart: (prompt: string) => void;
};

/**
 * Standalone Cowork-style task input for the no-session home. The real session
 * composer needs a live session; this one creates the task on submit via
 * `onCreateTaskWithPrompt`, after which the full composer takes over.
 */
export function MonolithStartComposer({ workspaceName, disabled, onStart }: MonolithStartComposerProps) {
  const [text, setText] = useState("");

  const submit = () => {
    const prompt = text.trim();
    if (!prompt || disabled) return;
    onStart(prompt);
    setText("");
  };

  return (
    <div className="w-full rounded-3xl border border-dls-border bg-dls-surface p-4 shadow-[var(--dls-card-shadow)]">
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        rows={3}
        autoFocus
        placeholder={t("monolith.home.input_placeholder")}
        className="w-full resize-none bg-transparent text-[15px] leading-6 text-dls-text outline-none placeholder:text-dls-secondary"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-dls-border bg-dls-surface-muted/60 px-2.5 py-1 text-[12px] text-dls-secondary">
          <FolderOpen className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{workspaceName?.trim() || t("monolith.home.workspace_fallback")}</span>
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !text.trim()}
          aria-label={t("monolith.home.start")}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-dls-accent text-white transition-colors hover:bg-dls-accent-hover disabled:opacity-40"
        >
          <ArrowUp className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

type MonolithSuggestionsProps = {
  onPick: (prompt: string) => void;
};

export function MonolithSuggestions({ onPick }: MonolithSuggestionsProps) {
  return (
    <div className="w-full rounded-2xl border border-dls-border/80 bg-dls-surface/60 p-3">
      <div className="mb-2 flex items-center gap-2 px-1 text-[13px] font-medium text-dls-text">
        <Shuffle className="size-3.5 text-dls-secondary" aria-hidden />
        {t("monolith.home.pick_any")}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {SUGGESTIONS.map((suggestion) => {
          const Icon = suggestion.icon;
          return (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => onPick(t(suggestion.promptKey))}
              className="flex items-center gap-3 rounded-xl border border-dls-border bg-dls-surface px-4 py-3 text-left text-[13px] font-medium text-dls-text transition-colors hover:bg-dls-hover"
            >
              <Icon className="size-4 shrink-0 text-dls-secondary" aria-hidden />
              <span className="truncate">{t(suggestion.titleKey)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

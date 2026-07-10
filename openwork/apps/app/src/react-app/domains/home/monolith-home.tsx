/** @jsxImportSource react */
import type { ComponentType } from "react";
import {
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

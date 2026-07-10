/** @jsxImportSource react */
import { t } from "../../i18n";
import { cn } from "@/lib/utils";

/**
 * MONOLITH's Cowork-style top mode switcher. Modes map onto opencode agents:
 * Chat → the seeded `chat` agent, Code → the seeded `code` agent, and
 * Cowork → the workspace default agent (agent selection cleared).
 */
export type MonolithMode = "chat" | "cowork" | "code";

const MODE_AGENTS: Record<MonolithMode, string | null> = {
  chat: "chat",
  cowork: null,
  code: "code",
};

export function modeFromAgent(agent: string | null | undefined): MonolithMode {
  if (agent === "chat") return "chat";
  if (agent === "code") return "code";
  return "cowork";
}

export function agentForMode(mode: MonolithMode): string | null {
  return MODE_AGENTS[mode];
}

type ModeTabsProps = {
  selectedAgent: string | null;
  onSelectAgent: (agent: string | null) => void;
  className?: string;
};

const MODES: Array<{ mode: MonolithMode; labelKey: string }> = [
  { mode: "chat", labelKey: "monolith.tabs.chat" },
  { mode: "cowork", labelKey: "monolith.tabs.cowork" },
  { mode: "code", labelKey: "monolith.tabs.code" },
];

export function ModeTabs({ selectedAgent, onSelectAgent, className }: ModeTabsProps) {
  const active = modeFromAgent(selectedAgent);

  return (
    <div
      role="tablist"
      aria-label={t("monolith.tabs.aria")}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-dls-border bg-dls-surface-muted/70 p-0.5",
        className,
      )}
    >
      {MODES.map(({ mode, labelKey }) => {
        const isActive = mode === active;
        return (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelectAgent(agentForMode(mode))}
            className={cn(
              "rounded-full px-3.5 py-1 text-[13px] font-medium transition-colors",
              isActive
                ? "border border-dls-border bg-dls-surface text-dls-text shadow-sm"
                : "border border-transparent text-dls-secondary hover:text-dls-text",
            )}
          >
            {t(labelKey)}
          </button>
        );
      })}
    </div>
  );
}

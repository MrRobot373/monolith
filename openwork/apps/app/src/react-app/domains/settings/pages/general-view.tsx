/** @jsxImportSource react */
import {
  ArrowRight,
  Bell,
  Cog,
  FolderLock,
  Gauge,
  Paintbrush,
  Puzzle,
  ShieldCheck,
  Sparkles,
  Terminal,
  User,
  Wrench,
} from "lucide-react";

import type { SettingsTab } from "../../../../app/types";

export type GeneralSettingsViewProps = {
  onNavigateTab: (tab: SettingsTab) => void;
  developerMode: boolean;
};

const workspaceCards: { tab: SettingsTab; icon: typeof Sparkles; title: string; desc: string }[] = [
  { tab: "preferences", icon: Cog, title: "Preferences", desc: "Default model, reasoning, and compaction." },
  { tab: "permissions", icon: FolderLock, title: "Permissions", desc: "Authorized folders and file access." },
  { tab: "extensions", icon: Puzzle, title: "Extensions", desc: "MCPs, skills, plugins, and integrations." },
  { tab: "advanced", icon: Wrench, title: "Advanced", desc: "Runtime, engine, and developer options." },
];

const globalCards: { tab: SettingsTab; icon: typeof Sparkles; title: string; desc: string }[] = [
  { tab: "ai", icon: Sparkles, title: "AI Providers", desc: "Connect services that provide AI models." },
  { tab: "cloud-account", icon: User, title: "Account", desc: "Sign in and manage your MONOLITH account." },
  { tab: "appearance", icon: Paintbrush, title: "Appearance", desc: "Theme, font size, and display." },
  { tab: "notifications", icon: Bell, title: "Notifications", desc: "Choose what you get notified about." },
  { tab: "usage", icon: Gauge, title: "Usage", desc: "Model gateway spend for this deployment." },
  { tab: "environment", icon: Terminal, title: "Environment", desc: "Environment variables and paths." },
  { tab: "recovery", icon: ShieldCheck, title: "Recovery", desc: "Reset onboarding and clear data." },
];

function SettingsCard(props: {
  icon: typeof Sparkles;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="flex items-center gap-3 rounded-2xl border border-dls-border bg-dls-surface p-4 text-left transition-colors hover:bg-dls-hover"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-dls-border bg-dls-hover">
        <props.icon size={16} className="text-dls-secondary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-dls-text">{props.title}</div>
        <div className="text-[11px] text-dls-secondary">{props.desc}</div>
      </div>
      <ArrowRight size={14} className="shrink-0 text-dls-secondary" />
    </button>
  );
}

export function GeneralSettingsView(props: GeneralSettingsViewProps) {
  return (
    <div className="w-full max-w-3xl space-y-8">
      {/* Workspace settings */}
      <div className="space-y-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-dls-secondary">
          Workspace
        </div>
        <div className="grid grid-cols-2 gap-2">
          {workspaceCards.map((card) => (
            <SettingsCard
              key={card.tab}
              icon={card.icon}
              title={card.title}
              desc={card.desc}
              onClick={() => props.onNavigateTab(card.tab)}
            />
          ))}
        </div>
      </div>

      {/* Global settings */}
      <div className="space-y-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-dls-secondary">
          Global
        </div>
        <div className="grid grid-cols-2 gap-2">
          {globalCards.map((card) => (
            <SettingsCard
              key={card.tab}
              icon={card.icon}
              title={card.title}
              desc={card.desc}
              onClick={() => props.onNavigateTab(card.tab)}
            />
          ))}
        </div>
      </div>

      {/* MONOLITH: the "Help" section (Discord/GitHub issue links) pointed at
          OpenWork's own community, not this deployment — removed. */}
    </div>
  );
}

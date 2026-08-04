"use client";

import { MessageCircle, FolderKanban, Clock, Wrench, ShieldCheck } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { demoWorkspaces } from "./demo-data";
import { cn } from "@/lib/utils";
import type { AppView } from "./app-shell";

const navItems: { id: AppView; label: string; icon: typeof MessageCircle }[] = [
  { id: "dispatch", label: "Dispatch", icon: MessageCircle },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "scheduled", label: "Scheduled", icon: Clock },
  { id: "customize", label: "Customize", icon: Wrench },
  { id: "admin", label: "Admin", icon: ShieldCheck },
];

export function LeftRail({ active, onChange }: { active: AppView; onChange: (v: AppView) => void }) {
  return (
    <div className="flex shrink-0 flex-col border-b border-border-soft bg-bg-secondary/50 p-2 md:h-full md:w-full md:border-b-0 md:border-r md:p-3">
      <div className="hidden items-center gap-2 px-2 py-2 md:flex">
        <LogoMark className="text-accent" />
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">Demo</span>
      </div>

      <nav
        className="flex flex-row gap-0.5 overflow-x-auto md:mt-4 md:flex-col md:overflow-visible"
        aria-label="App sections"
      >
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-[9px] px-2.5 py-2 text-left text-[13px] transition-colors md:shrink",
              active === item.id ? "bg-bg-elevated font-medium text-text-primary shadow-[0_1px_0_rgba(0,0,0,0.03)]" : "text-text-secondary hover:bg-bg-elevated/60",
            )}
          >
            <item.icon size={15} className="shrink-0" />
            {item.label}
          </button>
        ))}
      </nav>

      <p className="mt-5 hidden px-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted md:block">
        Workspaces
      </p>
      <ul className="mt-1.5 hidden flex-col gap-0.5 md:flex">
        {demoWorkspaces.map((w, i) => (
          <li key={w.id}>
            <button
              className={cn(
                "flex w-full items-center justify-between rounded-[9px] px-2.5 py-1.5 text-left text-[12.5px] transition-colors hover:bg-bg-elevated/60",
                i === 0 ? "text-text-primary" : "text-text-secondary",
              )}
            >
              <span className="truncate">{w.name}</span>
              <span className="font-mono text-[10px] text-text-muted">{w.lastActive}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

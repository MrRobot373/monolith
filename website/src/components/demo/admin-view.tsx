"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const members = [
  { name: "You", role: "Admin" },
  { name: "R. Adeyemi", role: "Member" },
  { name: "S. Kowalski", role: "Member" },
];

const usage = [
  { model: "Local (Ollama)", pct: 62 },
  { model: "Cloud — stronger model", pct: 38 },
];

export function AdminView() {
  const [approvalMode, setApprovalMode] = useState<"manual" | "automatic">("manual");
  const [searchEnabled, setSearchEnabled] = useState(true);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <h2 className="font-display text-[20px] text-text-primary">Org admin</h2>
      <p className="mt-1 text-[13px] text-text-secondary">Approval mode, search access, members, and usage.</p>

      <div className="mt-6 rounded-[12px] border border-border-soft p-4">
        <p className="text-[13px] font-semibold text-text-primary">Approval mode</p>
        <p className="mt-1 text-[11.5px] text-text-muted">Manual: agents ask before sensitive actions. Automatic removes that checkpoint.</p>
        <div className="mt-3 flex gap-1 rounded-[9px] bg-bg-secondary p-1">
          {(["manual", "automatic"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setApprovalMode(mode)}
              className={cn(
                "flex-1 rounded-[7px] py-1.5 text-[12.5px] font-medium capitalize transition-colors",
                approvalMode === mode ? "bg-bg-elevated text-text-primary" : "text-text-secondary",
              )}
            >
              {mode}
            </button>
          ))}
        </div>
        {approvalMode === "automatic" ? (
          <p className="mt-2.5 text-[11px] text-warning">Automatic mode removes the human checkpoint before sensitive actions.</p>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-[12px] border border-border-soft p-4">
        <div>
          <p className="text-[13px] font-semibold text-text-primary">Web search access</p>
          <p className="mt-1 text-[11.5px] text-text-muted">Allow agents to use the self-hosted search skill.</p>
        </div>
        <button
          role="switch"
          aria-checked={searchEnabled}
          onClick={() => setSearchEnabled((v) => !v)}
          className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", searchEnabled ? "bg-accent" : "bg-border-strong")}
        >
          <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-bg-elevated transition-transform", searchEnabled ? "translate-x-[18px]" : "translate-x-0.5")} />
        </button>
      </div>

      <h3 className="mt-6 font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">Members</h3>
      <ul className="mt-3 flex flex-col gap-1.5">
        {members.map((m) => (
          <li key={m.name} className="flex items-center justify-between rounded-[10px] border border-border-soft px-3 py-2">
            <span className="text-[13px] text-text-primary">{m.name}</span>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.05em] text-text-muted">{m.role}</span>
          </li>
        ))}
      </ul>

      <h3 className="mt-6 font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">Model usage (illustrative)</h3>
      <div className="mt-3 flex flex-col gap-3">
        {usage.map((u) => (
          <div key={u.model}>
            <div className="flex items-center justify-between text-[12px] text-text-secondary">
              <span>{u.model}</span>
              <span className="font-mono">{u.pct}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg-secondary">
              <div className="h-full rounded-full bg-accent" style={{ width: `${u.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

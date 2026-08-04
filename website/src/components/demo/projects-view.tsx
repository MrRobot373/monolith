"use client";

import { FolderKanban } from "lucide-react";
import { demoWorkspaces } from "./demo-data";

export function ProjectsView() {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <h2 className="font-display text-[20px] text-text-primary">Projects</h2>
      <p className="mt-1 text-[13px] text-text-secondary">Each project is a workspace with its own AGENTS.md instructions.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {demoWorkspaces.map((w) => (
          <div key={w.id} className="rounded-[14px] border border-border-soft bg-bg-elevated p-4">
            <FolderKanban size={16} className="text-accent" />
            <p className="mt-2 text-[14px] font-semibold text-text-primary">{w.name}</p>
            <p className="mt-0.5 text-[11.5px] text-text-muted">Active {w.lastActive}</p>
            <p className="mt-3 rounded-[8px] bg-bg-secondary px-2.5 py-2 font-mono text-[11px] text-text-muted">AGENTS.md · configured</p>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Plug } from "lucide-react";
import { initialSkills, initialMcpServers } from "./demo-data";
import { cn } from "@/lib/utils";

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", on ? "bg-accent" : "bg-border-strong")}
    >
      <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-bg-elevated transition-transform", on ? "translate-x-[18px]" : "translate-x-0.5")} />
    </button>
  );
}

export function CustomizeView() {
  const [skills, setSkills] = useState(initialSkills);
  const [mcp] = useState(initialMcpServers);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <h2 className="font-display text-[20px] text-text-primary">Customize</h2>
      <p className="mt-1 text-[13px] text-text-secondary">Skills and MCP servers configured for this deployment.</p>

      <h3 className="mt-6 font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">Skills</h3>
      <ul className="mt-3 flex flex-col gap-2">
        {skills.map((skill) => (
          <li key={skill.id} className="flex items-center justify-between gap-3 rounded-[12px] border border-border-soft p-3.5">
            <div>
              <p className="text-[13.5px] font-medium text-text-primary">{skill.name}</p>
              <p className="mt-0.5 text-[11.5px] text-text-muted">{skill.description}</p>
            </div>
            <Toggle
              on={skill.enabled}
              onClick={() => setSkills((s) => s.map((x) => (x.id === skill.id ? { ...x, enabled: !x.enabled } : x)))}
            />
          </li>
        ))}
      </ul>

      <h3 className="mt-6 font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">MCP servers</h3>
      <ul className="mt-3 flex flex-col gap-2">
        {mcp.map((server) => (
          <li key={server.id} className="flex items-center gap-3 rounded-[12px] border border-border-soft p-3.5">
            <Plug size={15} className="text-text-secondary" />
            <div className="flex-1">
              <p className="text-[13.5px] font-medium text-text-primary">{server.name}</p>
              <p className="mt-0.5 text-[11px] text-text-muted">{server.scope} scope</p>
            </div>
            <span className={cn("font-mono text-[10.5px] uppercase tracking-[0.05em]", server.status === "connected" ? "text-success" : "text-text-muted")}>
              {server.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

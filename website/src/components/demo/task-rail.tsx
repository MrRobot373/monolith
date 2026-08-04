"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { CheckCircle2, Loader2, Clock3, CircleDashed, XCircle, FileDiff, FileText, File } from "lucide-react";
import { demoTimeline, demoArtifacts, demoContext } from "./demo-data";
import { cn } from "@/lib/utils";

const statusMeta = {
  completed: { icon: CheckCircle2, className: "text-success" },
  running: { icon: Loader2, className: "text-accent animate-spin" },
  waiting: { icon: Clock3, className: "text-warning" },
  queued: { icon: CircleDashed, className: "text-text-muted" },
  failed: { icon: XCircle, className: "text-error" },
} as const;

const artifactIcon = { diff: FileDiff, report: FileText, document: File } as const;

const tabClass =
  "rounded-[8px] px-3 py-1.5 text-[12.5px] font-medium text-text-secondary transition-colors data-[state=active]:bg-bg-elevated data-[state=active]:text-text-primary";

export function TaskRail() {
  return (
    <div className="flex h-full flex-col">
      <Tabs.Root defaultValue="progress" className="flex h-full flex-col">
        <Tabs.List className="flex gap-1 rounded-[10px] bg-bg-secondary p-1" aria-label="Task rail">
          <Tabs.Trigger value="progress" className={tabClass}>
            Progress
          </Tabs.Trigger>
          <Tabs.Trigger value="artifacts" className={tabClass}>
            Artifacts
          </Tabs.Trigger>
          <Tabs.Trigger value="context" className={tabClass}>
            Context
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="progress" className="mt-4 flex-1 overflow-y-auto focus-visible:outline-none">
          <ol className="flex flex-col gap-3">
            {demoTimeline.map((step) => {
              const meta = statusMeta[step.status];
              const Icon = meta.icon;
              return (
                <li key={step.id} className="flex items-start gap-2.5">
                  <Icon size={15} className={cn("mt-0.5 shrink-0", meta.className)} />
                  <div>
                    <p className="text-[13px] font-medium text-text-primary">{step.label}</p>
                    <p className="text-[11.5px] text-text-muted">{step.detail}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Tabs.Content>

        <Tabs.Content value="artifacts" className="mt-4 flex-1 overflow-y-auto focus-visible:outline-none">
          <ul className="flex flex-col gap-2.5">
            {demoArtifacts.map((a) => {
              const Icon = artifactIcon[a.type];
              return (
                <li key={a.id} className="flex items-start gap-2.5 rounded-[10px] border border-border-soft p-3">
                  <Icon size={15} className="mt-0.5 shrink-0 text-text-secondary" />
                  <div>
                    <p className="text-[12.5px] font-medium text-text-primary">{a.title}</p>
                    <p className="text-[11px] text-text-muted">{a.meta}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Tabs.Content>

        <Tabs.Content value="context" className="mt-4 flex-1 overflow-y-auto focus-visible:outline-none">
          <ul className="flex flex-col gap-2">
            {demoContext.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-[10px] border border-border-soft px-3 py-2">
                <span className="text-[12.5px] text-text-primary">{c.label}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-text-muted">{c.kind}</span>
              </li>
            ))}
          </ul>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

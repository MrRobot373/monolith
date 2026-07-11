/** @jsxImportSource react */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  CircleDashed,
  FolderOpen,
  Loader2,
  Plug,
  X,
} from "lucide-react";

import type { OpenworkServerClient } from "@/app/lib/openwork-server";
import type { TodoItem } from "@/app/types";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

import { ArtifactIcon } from "../artifacts/artifact-icon";
import type { OpenTarget } from "../artifacts/open-target";

/**
 * MONOLITH: Cowork-style task rail — Progress (todo steps), Artifacts
 * (collectible outputs), and Context (folder + connectors). Default right
 * panel for a session; artifact clicks open the preview side panel.
 */
type TaskRailProps = {
  sessionId: string;
  workspaceId: string | null;
  workspaceName: string;
  workspaceRoot: string;
  client: OpenworkServerClient | null;
  todos: TodoItem[];
  artifacts: OpenTarget[];
  onOpenArtifact: (target: OpenTarget) => void;
  onClose: () => void;
};

function RailCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(true);
  return (
    <section className="rounded-2xl border border-dls-border bg-dls-surface p-3.5">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <h3 className="text-[13px] font-semibold text-dls-text">{title}</h3>
        <ChevronDown
          className={cn(
            "size-4 text-dls-secondary transition-transform",
            !open && "-rotate-90",
          )}
          aria-hidden
        />
      </button>
      {open ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] leading-5 text-dls-secondary">{children}</p>;
}

function todoStatusRank(todo: TodoItem): number {
  if (todo.status === "completed") return 0;
  if (todo.status === "in_progress") return 1;
  return 2;
}

function ProgressStepIcon({ status }: { status: string }) {
  if (status === "completed") {
    return (
      <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-dls-accent text-white">
        <Check className="size-3" strokeWidth={3} aria-hidden />
      </span>
    );
  }
  if (status === "in_progress") {
    return <Loader2 className="size-4.5 shrink-0 animate-spin text-dls-accent" aria-hidden />;
  }
  return <CircleDashed className="size-4.5 shrink-0 text-dls-secondary/70" aria-hidden />;
}

export function TaskRail({
  sessionId,
  workspaceId,
  workspaceName,
  workspaceRoot,
  client,
  todos,
  artifacts,
  onOpenArtifact,
  onClose,
}: TaskRailProps) {
  const visibleTodos = React.useMemo(() => {
    const items = todos.filter((todo) => todo.content.trim());
    // Keep authoring order inside each bucket, completed first like Cowork's chain.
    return [...items].sort((a, b) => todoStatusRank(a) - todoStatusRank(b));
  }, [todos]);

  const configQuery = useQuery({
    queryKey: ["monolith-task-rail-config", workspaceId],
    enabled: Boolean(client && workspaceId),
    staleTime: 60_000,
    retry: false,
    queryFn: () => client!.getConfig(workspaceId!),
  });

  const connectors = React.useMemo(() => {
    const data = configQuery.data as Record<string, unknown> | undefined;
    // Config may arrive as { opencode: {...} } or as the flat opencode config.
    const opencode = (data?.opencode ?? data) as Record<string, unknown> | undefined;
    const mcp = opencode?.mcp;
    if (!mcp || typeof mcp !== "object") return [] as Array<{ name: string; enabled: boolean }>;
    return Object.entries(mcp as Record<string, Record<string, unknown>>).map(([name, entry]) => ({
      name,
      enabled: entry?.enabled !== false,
    }));
  }, [configQuery.data]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-dls-background" data-monolith-task-rail={sessionId}>
      <div className="flex items-center justify-between border-b border-dls-border px-4 py-2.5">
        <h2 className="text-[13px] font-semibold text-dls-text">{t("monolith.rail.title")}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("monolith.rail.close")}
          className="flex size-6 items-center justify-center rounded-md text-dls-secondary transition-colors hover:bg-dls-hover hover:text-dls-text"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <RailCard title={t("monolith.rail.progress")}>
          {visibleTodos.length === 0 ? (
            <EmptyHint>{t("monolith.rail.progress_empty")}</EmptyHint>
          ) : (
            <ol className="flex flex-col gap-2.5">
              {visibleTodos.map((todo) => (
                <li key={todo.id} className="flex items-start gap-2.5">
                  <ProgressStepIcon status={todo.status} />
                  <span
                    className={cn(
                      "min-w-0 flex-1 text-[13px] leading-5",
                      todo.status === "completed"
                        ? "text-dls-secondary line-through decoration-dls-border"
                        : "text-dls-text",
                      todo.status === "in_progress" && "font-medium",
                    )}
                  >
                    {todo.content}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </RailCard>

        <RailCard title={t("monolith.rail.artifacts")}>
          {artifacts.length === 0 ? (
            <EmptyHint>{t("monolith.rail.artifacts_empty")}</EmptyHint>
          ) : (
            <ul className="flex flex-col gap-1">
              {artifacts.map((target) => (
                <li key={target.id}>
                  <button
                    type="button"
                    onClick={() => onOpenArtifact(target)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-dls-hover"
                    title={target.name}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-dls-border bg-dls-surface-muted/60">
                      <ArtifactIcon type={target.preview} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-dls-text">
                      {target.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </RailCard>

        <RailCard title={t("monolith.rail.context")}>
          <div className="flex flex-col gap-3">
            <div>
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-dls-secondary">
                {t("monolith.rail.context_folders")}
              </div>
              <div className="flex items-center gap-2 rounded-lg px-1 py-0.5" title={workspaceRoot}>
                <FolderOpen className="size-4 shrink-0 text-dls-secondary" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-[13px] text-dls-text">
                  {workspaceName?.trim() || workspaceRoot || t("monolith.home.workspace_fallback")}
                </span>
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-dls-secondary">
                {t("monolith.rail.context_connectors")}
              </div>
              {connectors.length === 0 ? (
                <EmptyHint>{t("monolith.rail.connectors_empty")}</EmptyHint>
              ) : (
                <ul className="flex flex-col gap-1">
                  {connectors.map((connector) => (
                    <li key={connector.name} className="flex items-center gap-2 px-1 py-0.5">
                      <Plug
                        className={cn(
                          "size-4 shrink-0",
                          connector.enabled ? "text-dls-accent" : "text-dls-secondary/60",
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-dls-text">
                        {connector.name}
                      </span>
                      {!connector.enabled ? (
                        <span className="text-[11px] text-dls-secondary">{t("monolith.rail.connector_off")}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </RailCard>
      </div>
    </div>
  );
}

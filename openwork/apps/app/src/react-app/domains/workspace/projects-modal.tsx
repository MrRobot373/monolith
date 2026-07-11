/** @jsxImportSource react */
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, FolderOpen, FolderPlus, Loader2 } from "lucide-react";

import type { OpenworkServerClient } from "@/app/lib/openwork-server";
import type { WorkspaceSessionGroup } from "@/app/types";
import { t } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WorkspaceIcon } from "../../design-system/workspace-icon";
import { workspaceLabel } from "../session/sidebar/utils";

/**
 * MONOLITH: Cowork-style Projects — each workspace is a project (own folder,
 * config, sessions). Grid view + per-project detail with an instructions
 * editor persisted to AGENTS.md in the workspace root (read by the engine).
 */
const INSTRUCTIONS_FILE = "AGENTS.md";

type ProjectsModalProps = {
  open: boolean;
  onClose: () => void;
  groups: WorkspaceSessionGroup[];
  client: OpenworkServerClient | null;
  onOpenWorkspace: (workspaceId: string) => void;
  onCreateWorkspace: () => void;
};

function ProjectDetail({
  group,
  client,
  onBack,
  onOpen,
}: {
  group: WorkspaceSessionGroup;
  client: OpenworkServerClient | null;
  onBack: () => void;
  onOpen: () => void;
}) {
  const queryClient = useQueryClient();
  const workspaceId = group.workspace.id;
  const instructionsQuery = useQuery({
    queryKey: ["monolith-project-instructions", workspaceId],
    enabled: Boolean(client),
    retry: false,
    queryFn: async () => {
      try {
        return await client!.readWorkspaceFile(workspaceId, INSTRUCTIONS_FILE);
      } catch {
        return null; // no AGENTS.md yet
      }
    },
  });

  const [draft, setDraft] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const loaded = instructionsQuery.data;
  const value = draft ?? loaded?.content ?? "";
  const dirty = draft !== null && draft !== (loaded?.content ?? "");

  const save = async () => {
    if (!client || draft === null) return;
    setSaving(true);
    setSaveError(null);
    try {
      await client.writeWorkspaceFile(workspaceId, {
        path: INSTRUCTIONS_FILE,
        content: draft,
        baseUpdatedAt: loaded?.updatedAt ?? null,
        force: !loaded,
      });
      await queryClient.invalidateQueries({ queryKey: ["monolith-project-instructions", workspaceId] });
      setDraft(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-dls-secondary transition-colors hover:text-dls-text"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("monolith.projects.back")}
        </button>
        <Button size="sm" onClick={onOpen}>
          {t("monolith.projects.open")}
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <WorkspaceIcon workspaceId={group.workspace.id} sizeClass="size-9" />
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-dls-text">
            {workspaceLabel(group.workspace)}
          </div>
          <div className="truncate text-[12px] text-dls-secondary" title={group.workspace.path ?? ""}>
            {group.workspace.path ?? ""}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-dls-border bg-dls-surface-muted/50 px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-dls-secondary">
            {t("monolith.projects.tasks")}
          </div>
          <div className="text-[15px] font-semibold text-dls-text">{group.sessions.length}</div>
        </div>
        <div className="rounded-xl border border-dls-border bg-dls-surface-muted/50 px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-dls-secondary">
            {t("monolith.projects.kind")}
          </div>
          <div className="truncate text-[15px] font-semibold text-dls-text">
            {group.workspace.workspaceType === "remote" ? t("monolith.projects.kind_remote") : t("monolith.projects.kind_local")}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <div className="text-[12px] font-medium text-dls-text">
            {t("monolith.projects.instructions")}
          </div>
          <div className="text-[11px] text-dls-secondary">{INSTRUCTIONS_FILE}</div>
        </div>
        {instructionsQuery.isLoading ? (
          <div className="flex items-center gap-2 rounded-xl border border-dls-border px-3 py-4 text-[12px] text-dls-secondary">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t("monolith.projects.instructions_loading")}
          </div>
        ) : (
          <textarea
            value={value}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("monolith.projects.instructions_placeholder")}
            className="min-h-40 flex-1 resize-none rounded-xl border border-dls-border bg-dls-surface p-3 text-[13px] leading-6 text-dls-text outline-none placeholder:text-dls-secondary focus:border-dls-accent"
          />
        )}
        {saveError ? <div className="text-[12px] text-red-11">{saveError}</div> : null}
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-dls-secondary">{t("monolith.projects.instructions_hint")}</p>
          <Button size="sm" onClick={() => void save()} disabled={!dirty || saving || !client}>
            {saving ? t("monolith.projects.saving") : t("monolith.projects.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ProjectsModal(props: ProjectsModalProps) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const selected = props.groups.find((group) => group.workspace.id === selectedId) ?? null;

  React.useEffect(() => {
    if (!props.open) setSelectedId(null);
  }, [props.open]);

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("monolith.projects.title")}</DialogTitle>
          <DialogDescription>{t("monolith.projects.subtitle")}</DialogDescription>
        </DialogHeader>
        {selected ? (
          <ProjectDetail
            group={selected}
            client={props.client}
            onBack={() => setSelectedId(null)}
            onOpen={() => {
              props.onOpenWorkspace(selected.workspace.id);
              props.onClose();
            }}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {props.groups.map((group) => (
                <button
                  key={group.workspace.id}
                  type="button"
                  onClick={() => setSelectedId(group.workspace.id)}
                  className="flex items-center gap-3 rounded-2xl border border-dls-border bg-dls-surface px-3.5 py-3 text-left transition-colors hover:bg-dls-hover"
                >
                  <WorkspaceIcon workspaceId={group.workspace.id} sizeClass="size-8" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-dls-text">
                      {workspaceLabel(group.workspace)}
                    </span>
                    <span className="block truncate text-[11px] text-dls-secondary">
                      {t("monolith.projects.task_count", { count: group.sessions.length })}
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-dls-secondary" aria-hidden />
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  props.onClose();
                  props.onCreateWorkspace();
                }}
                className="flex items-center gap-3 rounded-2xl border border-dashed border-dls-border bg-transparent px-3.5 py-3 text-left transition-colors hover:bg-dls-hover"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-dls-border bg-dls-surface-muted/60">
                  <FolderPlus className="size-4 text-dls-secondary" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-dls-text">
                    {t("monolith.projects.new")}
                  </span>
                  <span className="block truncate text-[11px] text-dls-secondary">
                    {t("monolith.projects.new_hint")}
                  </span>
                </span>
              </button>
            </div>
            {props.groups.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-dls-border px-3 py-4 text-[12px] text-dls-secondary">
                <FolderOpen className="size-4" aria-hidden />
                {t("monolith.projects.empty")}
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

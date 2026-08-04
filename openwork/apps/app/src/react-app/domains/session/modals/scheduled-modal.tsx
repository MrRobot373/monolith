/** @jsxImportSource react */
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, ExternalLink, Loader2, Pause, Play, Plus, Trash2, Zap } from "lucide-react";

import type { WorkspaceSessionGroup } from "@/app/types";
import { monolithJson } from "@/app/lib/monolith-api";
import { t } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { workspaceLabel } from "../sidebar/utils";

/**
 * MONOLITH: Scheduled tasks — CRUD UI over the monolith-server sidecar
 * (`/__monolith/schedules`). Runs create real engine sessions titled "⏰ name".
 */
type Cadence =
  | { type: "every"; minutes: number }
  | { type: "daily"; time: string }
  | { type: "weekly"; day: number; time: string };

type ScheduleRun = {
  at: number;
  ok: boolean;
  manual?: boolean;
  sessionId?: string;
  error?: string;
};

type Schedule = {
  id: string;
  name: string;
  prompt: string;
  workspaceId: string;
  directory?: string;
  cadence: Cadence;
  enabled: boolean;
  lastRunAt?: number;
  nextRunAt?: number | null;
  runs?: ScheduleRun[];
};

const BASE = "/__monolith/schedules";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  return monolithJson<T>(BASE + path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });
}

function dayName(day: number): string {
  const keys = [
    "monolith.sched.day_sun", "monolith.sched.day_mon", "monolith.sched.day_tue",
    "monolith.sched.day_wed", "monolith.sched.day_thu", "monolith.sched.day_fri",
    "monolith.sched.day_sat",
  ];
  return t(keys[day] ?? keys[0]);
}

function cadenceSummary(cadence: Cadence): string {
  if (cadence.type === "every") return t("monolith.sched.every_minutes", { count: cadence.minutes });
  if (cadence.type === "daily") return t("monolith.sched.daily_at", { time: cadence.time });
  return t("monolith.sched.weekly_at", { day: dayName(cadence.day), time: cadence.time });
}

function relativeTime(ms: number | null | undefined): string {
  if (!ms) return "—";
  const delta = ms - Date.now();
  const abs = Math.abs(delta);
  const minutes = Math.round(abs / 60_000);
  const label = minutes < 60 ? `${minutes}m` : minutes < 60 * 24 ? `${Math.round(minutes / 60)}h` : `${Math.round(minutes / 1440)}d`;
  return delta >= 0 ? t("monolith.sched.in", { time: label }) : t("monolith.sched.ago", { time: label });
}

type ScheduledModalProps = {
  open: boolean;
  onClose: () => void;
  groups: WorkspaceSessionGroup[];
  onOpenSession: (workspaceId: string, sessionId: string) => void;
};

function CreateForm({ groups, onCreated }: { groups: WorkspaceSessionGroup[]; onCreated: () => void }) {
  const [name, setName] = React.useState("");
  const [prompt, setPrompt] = React.useState("");
  const [workspaceId, setWorkspaceId] = React.useState(groups[0]?.workspace.id ?? "");
  const [cadenceType, setCadenceType] = React.useState<"every" | "daily" | "weekly">("daily");
  const [minutes, setMinutes] = React.useState(60);
  const [time, setTime] = React.useState("09:00");
  const [day, setDay] = React.useState(1);

  const create = useMutation({
    mutationFn: async () => {
      const workspace = groups.find((group) => group.workspace.id === workspaceId)?.workspace;
      const cadence: Cadence =
        cadenceType === "every"
          ? { type: "every", minutes }
          : cadenceType === "daily"
            ? { type: "daily", time }
            : { type: "weekly", day, time };
      return api("", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim() || t("monolith.sched.default_name"),
          prompt: prompt.trim(),
          workspaceId,
          directory: workspace?.path ?? "",
          cadence,
          enabled: true,
        }),
      });
    },
    onSuccess: () => {
      setName("");
      setPrompt("");
      onCreated();
    },
  });

  const inputClass =
    "rounded-lg border border-dls-border bg-dls-surface px-2.5 py-1.5 text-[13px] text-dls-text outline-none placeholder:text-dls-secondary focus:border-dls-accent";

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-dls-border bg-dls-surface-muted/40 p-3">
      <div className="text-[12px] font-semibold text-dls-text">{t("monolith.sched.new")}</div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("monolith.sched.name_placeholder")} />
        <select className={inputClass} value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)}>
          {groups.map((group) => (
            <option key={group.workspace.id} value={group.workspace.id}>
              {workspaceLabel(group.workspace)}
            </option>
          ))}
        </select>
      </div>
      <textarea
        className={`${inputClass} min-h-16 resize-none`}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={t("monolith.sched.prompt_placeholder")}
      />
      <div className="flex flex-wrap items-center gap-2">
        <select className={inputClass} value={cadenceType} onChange={(e) => setCadenceType(e.target.value as typeof cadenceType)}>
          <option value="every">{t("monolith.sched.type_every")}</option>
          <option value="daily">{t("monolith.sched.type_daily")}</option>
          <option value="weekly">{t("monolith.sched.type_weekly")}</option>
        </select>
        {cadenceType === "every" ? (
          <input
            type="number"
            min={1}
            className={`${inputClass} w-24`}
            value={minutes}
            onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 1))}
            aria-label={t("monolith.sched.minutes")}
          />
        ) : (
          <>
            {cadenceType === "weekly" ? (
              <select className={inputClass} value={day} onChange={(e) => setDay(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6, 0].map((value) => (
                  <option key={value} value={value}>{dayName(value)}</option>
                ))}
              </select>
            ) : null}
            <input type="time" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} />
          </>
        )}
        <div className="flex-1" />
        <Button size="sm" onClick={() => create.mutate()} disabled={!prompt.trim() || !workspaceId || create.isPending}>
          {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus data-icon="inline-start" />}
          {t("monolith.sched.create")}
        </Button>
      </div>
      {create.isError ? (
        <div className="text-[12px] text-red-11">{create.error instanceof Error ? create.error.message : String(create.error)}</div>
      ) : null}
    </div>
  );
}

export function ScheduledModal(props: ScheduledModalProps) {
  const queryClient = useQueryClient();
  const listQuery = useQuery({
    queryKey: ["monolith-schedules"],
    enabled: props.open,
    refetchInterval: props.open ? 20_000 : false,
    queryFn: () => api<{ schedules: Schedule[] }>(""),
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["monolith-schedules"] });

  const toggle = useMutation({
    mutationFn: (schedule: Schedule) =>
      api(`/${schedule.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !schedule.enabled }) }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (schedule: Schedule) => api(`/${schedule.id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  const runNow = useMutation({
    mutationFn: (schedule: Schedule) => api(`/${schedule.id}/run`, { method: "POST" }),
    onSuccess: refresh,
  });

  const schedules = listQuery.data?.schedules ?? [];
  const sidecarMissing = listQuery.isError;

  return (
    <Dialog open={props.open} onOpenChange={(open) => { if (!open) props.onClose(); }}>
      <DialogContent className="flex max-h-[82vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("monolith.sched.title")}</DialogTitle>
          <DialogDescription>{t("monolith.sched.subtitle")}</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
          {sidecarMissing ? (
            <div className="rounded-xl border border-amber-7/40 bg-amber-2/40 px-3 py-3 text-[12px] text-amber-11">
              {t("monolith.sched.sidecar_missing")}
            </div>
          ) : (
            <CreateForm groups={props.groups} onCreated={refresh} />
          )}

          {schedules.map((schedule) => (
            <div key={schedule.id} className="rounded-2xl border border-dls-border bg-dls-surface p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="size-4 shrink-0 text-dls-accent" aria-hidden />
                    <span className="truncate text-[13px] font-semibold text-dls-text">{schedule.name}</span>
                    {!schedule.enabled ? (
                      <span className="rounded-full border border-dls-border px-1.5 text-[10px] uppercase tracking-wide text-dls-secondary">
                        {t("monolith.sched.paused")}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 truncate text-[12px] text-dls-secondary" title={schedule.prompt}>
                    {schedule.prompt}
                  </div>
                  <div className="mt-1 text-[11px] text-dls-secondary">
                    {cadenceSummary(schedule.cadence)}
                    {schedule.enabled && schedule.nextRunAt
                      ? ` · ${t("monolith.sched.next_run")} ${relativeTime(schedule.nextRunAt)}`
                      : ""}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon" title={t("monolith.sched.run_now")} onClick={() => runNow.mutate(schedule)} disabled={runNow.isPending}>
                    <Zap className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" title={schedule.enabled ? t("monolith.sched.pause") : t("monolith.sched.resume")} onClick={() => toggle.mutate(schedule)}>
                    {schedule.enabled ? <Pause className="size-4" /> : <Play className="size-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" title={t("action.remove")} onClick={() => remove.mutate(schedule)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              {(schedule.runs?.length ?? 0) > 0 ? (
                <div className="mt-2 flex flex-col gap-1 border-t border-dls-border/60 pt-2">
                  {schedule.runs!.slice(0, 3).map((run) => (
                    <div key={run.at} className="flex items-center gap-2 text-[11px]">
                      <span className={run.ok ? "text-green-11" : "text-red-11"}>{run.ok ? "✓" : "✕"}</span>
                      <span className="text-dls-secondary">{new Date(run.at).toLocaleString()}</span>
                      {run.error ? <span className="min-w-0 flex-1 truncate text-red-11" title={run.error}>{run.error}</span> : <span className="flex-1" />}
                      {run.ok && run.sessionId ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-dls-accent hover:underline"
                          onClick={() => {
                            props.onOpenSession(schedule.workspaceId, run.sessionId!);
                            props.onClose();
                          }}
                        >
                          {t("monolith.sched.open_session")}
                          <ExternalLink className="size-3" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}

          {!sidecarMissing && schedules.length === 0 && !listQuery.isLoading ? (
            <div className="rounded-xl border border-dls-border px-3 py-4 text-center text-[12px] text-dls-secondary">
              {t("monolith.sched.empty")}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, Pause, Play, Trash2, CheckCircle2, XCircle, X } from "lucide-react";
import { initialSchedules, demoWorkspaces, type ScheduleItem } from "./demo-data";
import { cn } from "@/lib/utils";

export function ScheduledView() {
  const [schedules, setSchedules] = useState<ScheduleItem[]>(initialSchedules);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", cadence: "Weekly · Mon 08:00", workspace: demoWorkspaces[0].name });

  function toggleStatus(id: string) {
    setSchedules((list) =>
      list.map((s) => (s.id === id ? { ...s, status: s.status === "active" ? "paused" : "active", nextRun: s.status === "active" ? "Paused" : "Next run scheduled" } : s)),
    );
  }

  function runNow(id: string) {
    setSchedules((list) =>
      list.map((s) => (s.id === id ? { ...s, lastRun: { date: "Just now", ok: true } } : s)),
    );
  }

  function remove(id: string) {
    setSchedules((list) => list.filter((s) => s.id !== id));
  }

  function createSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSchedules((list) => [
      {
        id: `s-${Date.now()}`,
        name: form.name.trim(),
        cadence: form.cadence,
        workspace: form.workspace,
        status: "active",
        lastRun: null,
        nextRun: "Scheduled",
      },
      ...list,
    ]);
    setForm({ name: "", cadence: "Weekly · Mon 08:00", workspace: demoWorkspaces[0].name });
    setModalOpen(false);
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-[20px] text-text-primary">Scheduled tasks</h2>
          <p className="mt-1 text-[13px] text-text-secondary">Create, pause, resume, or run a task immediately.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 rounded-[9px] bg-accent px-3.5 py-2 text-[12.5px] font-semibold text-on-accent hover:bg-accent-hover"
        >
          <Plus size={14} /> New schedule
        </button>
      </div>

      <ul className="mt-6 flex flex-col gap-3">
        {schedules.map((s) => (
          <li key={s.id} className="rounded-[14px] border border-border-soft bg-bg-elevated p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={cn("h-1.5 w-1.5 rounded-full", s.status === "active" ? "bg-success" : "bg-text-muted")} />
                  <p className="text-[14px] font-semibold text-text-primary">{s.name}</p>
                </div>
                <p className="mt-1 font-mono text-[11px] text-text-muted">
                  {s.cadence} · {s.workspace}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => runNow(s.id)}
                  className="rounded-[7px] px-2 py-1 text-[11.5px] font-medium text-text-secondary hover:bg-bg-secondary"
                  aria-label="Run now"
                >
                  Run now
                </button>
                <button
                  onClick={() => toggleStatus(s.id)}
                  className="rounded-[7px] p-1.5 text-text-secondary hover:bg-bg-secondary"
                  aria-label={s.status === "active" ? "Pause" : "Resume"}
                >
                  {s.status === "active" ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <button onClick={() => remove(s.id)} className="rounded-[7px] p-1.5 text-text-secondary hover:bg-error/10 hover:text-error" aria-label="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-4 border-t border-border-soft pt-3 text-[11.5px] text-text-muted">
              {s.lastRun ? (
                <span className="flex items-center gap-1.5">
                  {s.lastRun.ok ? <CheckCircle2 size={12} className="text-success" /> : <XCircle size={12} className="text-error" />}
                  Last run {s.lastRun.date}
                </span>
              ) : (
                <span>No runs yet</span>
              )}
              <span>Next: {s.nextRun}</span>
            </div>
          </li>
        ))}
        {schedules.length === 0 ? <p className="text-[13px] text-text-muted">No scheduled tasks yet.</p> : null}
      </ul>

      <Dialog.Root open={modalOpen} onOpenChange={setModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-border-soft bg-bg-elevated p-6 shadow-2xl focus:outline-none">
            <div className="flex items-center justify-between">
              <Dialog.Title className="font-display text-[19px] text-text-primary">New schedule</Dialog.Title>
              <Dialog.Close asChild>
                <button aria-label="Close" className="text-text-muted hover:text-text-primary">
                  <X size={18} />
                </button>
              </Dialog.Close>
            </div>
            <form onSubmit={createSchedule} className="mt-5 flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-secondary">
                Task prompt
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Weekly competitor pricing check"
                  className="rounded-[9px] border border-border-soft bg-bg-primary px-3 py-2 text-[13.5px] text-text-primary outline-none focus:border-accent"
                  required
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-secondary">
                Cadence
                <select
                  value={form.cadence}
                  onChange={(e) => setForm((f) => ({ ...f, cadence: e.target.value }))}
                  className="rounded-[9px] border border-border-soft bg-bg-primary px-3 py-2 text-[13.5px] text-text-primary outline-none focus:border-accent"
                >
                  <option>Every 30 minutes</option>
                  <option>Daily · 08:00</option>
                  <option>Weekly · Mon 08:00</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-secondary">
                Workspace
                <select
                  value={form.workspace}
                  onChange={(e) => setForm((f) => ({ ...f, workspace: e.target.value }))}
                  className="rounded-[9px] border border-border-soft bg-bg-primary px-3 py-2 text-[13.5px] text-text-primary outline-none focus:border-accent"
                >
                  {demoWorkspaces.map((w) => (
                    <option key={w.id}>{w.name}</option>
                  ))}
                </select>
              </label>
              <button type="submit" className="mt-2 rounded-[10px] bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-on-accent hover:bg-accent-hover">
                Create schedule
              </button>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

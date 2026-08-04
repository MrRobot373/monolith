"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, Clock, FileText, MessageSquare, Search } from "lucide-react";
import { MediaFrame } from "@/components/marketing/media-frame";

const workspaces = ["Research", "Product eng", "Ops weekly", "Sandbox"];

export function HeroVisual() {
  const reduceMotion = useReducedMotion();

  const float = (amplitude: number, duration: number) =>
    reduceMotion
      ? {}
      : {
          animate: { y: [0, -amplitude, 0] },
          transition: { duration, repeat: Infinity, ease: "easeInOut" as const },
        };

  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-x-10 -inset-y-14 -z-10 rounded-[40px] bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--accent)_16%,transparent),transparent)]"
      />
      <MediaFrame label="workspace / research · monolith, isolated tenant" className="mx-auto max-w-[620px]">
        <div className="grid grid-cols-[100px_1fr] text-[12px] sm:grid-cols-[128px_1fr]">
          <aside className="border-r border-border-soft bg-bg-secondary/60 p-3">
            <p className="px-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-text-muted">Workspaces</p>
            <ul className="mt-2 flex flex-col gap-1">
              {workspaces.map((w, i) => (
                <li
                  key={w}
                  className={
                    "truncate rounded-[8px] px-2 py-1.5 " +
                    (i === 0 ? "bg-accent-soft font-medium text-accent-hover" : "text-text-secondary")
                  }
                >
                  {w}
                </li>
              ))}
            </ul>
          </aside>
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-start gap-2">
              <MessageSquare size={13} className="mt-0.5 shrink-0 text-text-muted" />
              <p className="text-text-secondary">Summarize what changed in the pricing research this week.</p>
            </div>
            <div className="flex items-start gap-2 rounded-[10px] bg-bg-secondary p-3">
              <Search size={13} className="mt-0.5 shrink-0 text-accent" />
              <div>
                <p className="font-medium text-text-primary">Reading 6 sources, cross-checking two claims…</p>
                <p className="mt-1 text-[11px] text-text-muted">Grounded in workspace documents + self-hosted search</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-text-muted">
              <CheckCircle2 size={13} className="text-success" />
              Draft ready — awaiting your approval to post
            </div>
          </div>
        </div>
      </MediaFrame>

      <motion.div
        {...float(8, 5)}
        className="absolute -left-6 top-10 hidden w-[168px] rounded-[14px] border border-border-soft bg-bg-elevated p-3 shadow-[0_20px_40px_-16px_rgba(23,21,18,0.3)] sm:block"
      >
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-text-primary">
          <Clock size={12} className="text-accent" />
          Scheduled
        </div>
        <p className="mt-1 text-[11px] text-text-secondary">Weekly ops report</p>
        <p className="mt-0.5 font-mono text-[10px] text-text-muted">Mon · 08:00 · next in 2d</p>
      </motion.div>

      <motion.div
        {...float(10, 6)}
        className="absolute -right-4 bottom-4 hidden w-[176px] rounded-[14px] border border-border-soft bg-bg-elevated p-3 shadow-[0_20px_40px_-16px_rgba(23,21,18,0.3)] sm:block"
      >
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-text-primary">
          <FileText size={12} className="text-warning" />
          Artifact
        </div>
        <p className="mt-1 text-[11px] text-text-secondary">competitive-notes.md</p>
        <p className="mt-0.5 font-mono text-[10px] text-text-muted">v3 · reviewable diff</p>
      </motion.div>
    </div>
  );
}

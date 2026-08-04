"use client";

import { useState } from "react";
import { ShieldAlert, Check, X, Clock } from "lucide-react";

type Decision = "pending" | "approved-once" | "approved-session" | "denied";

export function ApprovalCard() {
  const [decision, setDecision] = useState<Decision>("pending");

  if (decision !== "pending") {
    return (
      <div className="flex items-center gap-2.5 rounded-[12px] border border-border-soft bg-bg-secondary px-4 py-3 text-[13px] text-text-secondary">
        {decision === "denied" ? (
          <>
            <X size={15} className="text-error" /> Action denied — the agent will not post to #research.
          </>
        ) : (
          <>
            <Check size={15} className="text-success" />
            Approved{decision === "approved-session" ? " for this session" : ""} — posting to #research…
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-[14px] border border-warning/30 bg-[color-mix(in_srgb,var(--warning)_8%,transparent)] p-4">
      <div className="flex items-start gap-2.5">
        <ShieldAlert size={17} className="mt-0.5 shrink-0 text-warning" />
        <div>
          <p className="text-[13.5px] font-semibold text-text-primary">Approval required</p>
          <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
            The agent wants to <strong className="font-medium text-text-primary">post the drafted report to #research</strong>.
            Approval mode for this org is manual.
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => setDecision("approved-once")}
          className="rounded-[8px] bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-on-accent hover:bg-accent-hover"
        >
          Allow once
        </button>
        <button
          onClick={() => setDecision("approved-session")}
          className="flex items-center gap-1.5 rounded-[8px] border border-border-strong px-3 py-1.5 text-[12.5px] font-medium text-text-primary hover:border-accent"
        >
          <Clock size={12} /> Allow for session
        </button>
        <button
          onClick={() => setDecision("denied")}
          className="rounded-[8px] px-3 py-1.5 text-[12.5px] font-medium text-error hover:bg-error/10"
        >
          Deny
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SectionLabel } from "@/components/ui/section-label";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils";

const steps = [
  { title: "Define a goal", detail: "Describe the outcome in plain language — a report, a fix, a recurring check — not a list of steps." },
  { title: "Pick a mode", detail: "Chat for quick answers, Cowork for a project, Code for work in your real repo." },
  { title: "It gets to work", detail: "The agent reads files, searches, and runs commands inside your actual workspace — not a disconnected sandbox." },
  { title: "It asks first", detail: "Manual approval is the default: sensitive actions pause for your sign-off before they run." },
  { title: "Progress is visible", detail: "The task rail shows Progress, Artifacts, and Context in real time — nothing happens off-screen." },
  { title: "Artifacts appear", detail: "Diffs, documents, and reports show up as they're produced, reviewable as soon as they exist." },
  { title: "You review or redirect", detail: "Approve it, ask for a change, or take it from here yourself — the thread stays in your workspace either way." },
  { title: "Schedule it, if it repeats", detail: "Turn a one-off into a run that fires on its own — every N minutes, daily, or weekly." },
  { title: "The history stays", detail: "Every run, every artifact, linked and reviewable later — not a black box you have to trust blindly." },
];

export function WorkflowExplainer() {
  const [active, setActive] = useState(0);

  return (
    <section className="border-t border-border-soft py-24 md:py-32">
      <Container>
        <SectionLabel>How it works</SectionLabel>
        <h2 className="mt-4 max-w-[26ch] font-display text-[clamp(2rem,4.4vw,3.4rem)] leading-[1.05] text-balance">
          From open question to reviewed outcome.
        </h2>
      </Container>

      {/* Desktop interactive rail */}
      <Container className="mt-16 hidden md:block">
        <div className="grid grid-cols-9 gap-1.5">
          {steps.map((step, i) => (
            <button
              key={step.title}
              onClick={() => setActive(i)}
              onFocus={() => setActive(i)}
              className="group flex flex-col items-center gap-3 pt-1"
            >
              <span
                className={cn(
                  "h-1.5 w-full rounded-full transition-colors duration-300",
                  i === active ? "bg-accent" : i < active ? "bg-text-primary" : "bg-border-soft group-hover:bg-border-strong",
                )}
              />
              <span
                className={cn(
                  "text-center text-[11.5px] leading-tight transition-colors",
                  i === active ? "font-semibold text-text-primary" : "text-text-muted",
                )}
              >
                {step.title}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-10 min-h-[92px] rounded-[18px] border border-border-soft bg-bg-elevated p-7">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] as const }}
            >
              <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-accent">Step {active + 1} of {steps.length}</span>
              <p className="mt-2 max-w-[64ch] text-[16px] leading-relaxed text-text-primary">{steps[active].detail}</p>
            </motion.div>
          </AnimatePresence>
        </div>
      </Container>

      {/* Mobile vertical timeline */}
      <Container className="mt-12 md:hidden">
        <ol className="relative flex flex-col gap-8 border-l border-border-soft pl-6">
          {steps.map((step, i) => (
            <li key={step.title} className="relative">
              <span className="absolute -left-[29px] top-0.5 h-3 w-3 rounded-full border-2 border-bg-primary bg-accent" />
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-muted">Step {i + 1}</span>
              <h3 className="mt-1 text-[16px] font-semibold text-text-primary">{step.title}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-text-secondary">{step.detail}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

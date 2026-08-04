"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wrench, Plug, Cpu, ShieldCheck } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";
import { cn } from "@/lib/utils";

const nodes = [
  {
    icon: Wrench,
    title: "Skills",
    detail: "Self-contained capabilities — web search, reading and creating office documents — that agents can use directly in your workspace.",
  },
  {
    icon: Plug,
    title: "MCP servers",
    detail: "Connect external tools and data sources through the Model Context Protocol, configured per deployment from the Customize surface.",
  },
  {
    icon: Cpu,
    title: "Model providers",
    detail: "Wire in local models, cloud providers, or both — the picker automatically filters out anything that isn't actually reachable.",
  },
  {
    icon: ShieldCheck,
    title: "Org admin",
    detail: "Approval mode, search access, member visibility, and usage tracking — the controls that shape how the whole deployment behaves.",
  },
];

export function EcosystemDiagram() {
  const [active, setActive] = useState(0);

  return (
    <section className="border-t border-border-soft py-24 md:py-32">
      <Container>
        <SectionLabel>Configured, not locked in</SectionLabel>
        <h2 className="mt-4 max-w-[26ch] font-display text-[clamp(2rem,4.4vw,3.4rem)] leading-[1.05] text-balance">
          Your deployment, extended on your terms.
        </h2>

        <div className="mt-16 flex flex-col items-center">
          <div className="rounded-[16px] border border-border-strong bg-bg-elevated px-6 py-3 font-mono text-[13px] font-semibold text-text-primary">
            Your deployment
          </div>
          <div className="h-10 w-px bg-border-soft" aria-hidden />
          <div className="h-px w-full max-w-[720px] bg-border-soft" aria-hidden />

          <div className="mt-0 grid w-full max-w-[720px] grid-cols-2 gap-4 md:grid-cols-4">
            {nodes.map((node, i) => (
              <button
                key={node.title}
                onClick={() => setActive(i)}
                className="flex flex-col items-center gap-2 pt-6"
              >
                <span className="-mt-6 h-6 w-px bg-border-soft" aria-hidden />
                <span
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-[16px] border transition-colors",
                    i === active ? "border-accent bg-accent-soft" : "border-border-soft bg-bg-secondary",
                  )}
                >
                  <node.icon size={22} strokeWidth={1.4} className={i === active ? "text-accent-hover" : "text-text-secondary"} />
                </span>
                <span className={cn("text-[13px]", i === active ? "font-semibold text-text-primary" : "text-text-secondary")}>
                  {node.title}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-10 min-h-[76px] max-w-[560px] text-center">
            <AnimatePresence mode="wait">
              <motion.p
                key={active}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="text-[15px] leading-relaxed text-text-secondary"
              >
                {nodes[active].detail}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      </Container>
    </section>
  );
}

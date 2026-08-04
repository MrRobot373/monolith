"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion } from "framer-motion";
import { ArrowUpRight, X } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";
import { Container } from "@/components/ui/container";
import { demoCases, type DemoCase } from "@/content/demo-cases";

export function DemoGallery() {
  const [openCase, setOpenCase] = useState<DemoCase | null>(null);

  return (
    <section className="border-t border-border-soft py-24 md:py-32">
      <Container>
        <SectionLabel>See it in motion</SectionLabel>
        <h2 className="mt-4 max-w-[24ch] font-display text-[clamp(2rem,4.4vw,3.4rem)] leading-[1.05] text-balance">
          What a MONOLITH session actually does.
        </h2>

        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {demoCases.map((item) => (
            <button
              key={item.slug}
              onClick={() => setOpenCase(item)}
              className="group flex flex-col rounded-[20px] border border-border-soft bg-bg-elevated p-7 text-left transition-colors hover:border-border-strong"
            >
              <div className="flex aspect-[16/10] items-center justify-center overflow-hidden rounded-[14px] bg-bg-secondary">
                <motion.span
                  className="font-display text-[15px] text-text-muted"
                  whileHover={{ scale: 1.025 }}
                  transition={{ duration: 0.2 }}
                >
                  {item.category}
                </motion.span>
              </div>
              <span className="mt-5 font-mono text-[11px] uppercase tracking-[0.1em] text-accent">{item.category}</span>
              <h3 className="mt-2 text-[19px] font-semibold text-text-primary">{item.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-text-secondary">{item.outcome}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-text-primary">
                View case
                <ArrowUpRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </button>
          ))}
        </div>
      </Container>

      <Dialog.Root open={!!openCase} onOpenChange={(o) => !o && setOpenCase(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,620px)] -translate-x-1/2 -translate-y-1/2 rounded-[22px] border border-border-soft bg-bg-elevated p-8 shadow-2xl focus:outline-none"
            aria-describedby="demo-case-desc"
          >
            {openCase ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent">{openCase.category}</span>
                    <Dialog.Title className="mt-2 font-display text-[26px] text-text-primary">{openCase.title}</Dialog.Title>
                  </div>
                  <Dialog.Close asChild>
                    <button aria-label="Close" className="rounded-full p-1.5 text-text-muted hover:text-text-primary">
                      <X size={20} />
                    </button>
                  </Dialog.Close>
                </div>
                <Dialog.Description id="demo-case-desc" className="mt-4 text-[15px] leading-relaxed text-text-secondary">
                  {openCase.detail}
                </Dialog.Description>
                <ol className="mt-6 flex flex-col gap-3">
                  {openCase.steps.map((step, i) => (
                    <li key={step} className="flex items-start gap-3 text-[14px] text-text-primary">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-[11px] text-accent-hover">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}

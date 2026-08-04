"use client";

import { motion, useReducedMotion } from "framer-motion";
import { SectionLabel } from "@/components/ui/section-label";
import { Button } from "@/components/ui/button";
import { LineReveal } from "@/components/marketing/line-reveal";
import { HeroVisual } from "./hero-visual";

export function Hero() {
  const reduceMotion = useReducedMotion();

  const fadeUp = (delay: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <section className="paper-grid relative overflow-hidden pb-20 pt-16 md:pb-28 md:pt-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[70%] bg-[linear-gradient(to_bottom,var(--bg-primary)_0%,color-mix(in_srgb,var(--bg-primary)_60%,transparent)_70%,transparent_100%)]"
      />
      <div className="relative mx-auto flex max-w-[1180px] flex-col items-center px-6 text-center md:px-10">
        <motion.div {...fadeUp(0)}>
          <SectionLabel>Private AI platform</SectionLabel>
        </motion.div>

        <h1 className="mt-6 max-w-[16ch] font-display text-[clamp(2.6rem,7vw,5.5rem)] leading-[0.98] tracking-[-0.01em] text-text-primary">
          <LineReveal lines={["The work behind", "your best work."]} />
        </h1>

        <motion.p {...fadeUp(0.35)} className="mt-7 max-w-[62ch] text-balance text-[18px] leading-relaxed text-text-secondary md:text-[20px]">
          MONOLITH is a private AI workspace — chat, agents, and a coding assistant — that runs on
          your infrastructure or ours, and never uses your data to train anyone else&apos;s model.
        </motion.p>

        <motion.div {...fadeUp(0.5)} className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button href="/download" size="lg" showArrow>
            Get started
          </Button>
          <Button href="/use-cases" size="lg" variant="outline">
            Explore use cases
          </Button>
        </motion.div>

        <motion.p {...fadeUp(0.6)} className="mt-5 font-mono text-[12px] uppercase tracking-[0.1em] text-text-muted">
          Self-hosted · Managed · Local models · Cloud models
        </motion.p>

        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, scale: 0.97, y: 24 }}
          animate={reduceMotion ? undefined : { opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.55, ease: [0.22, 1, 0.36, 1] as const }}
          className="mt-16 w-full"
        >
          <HeroVisual />
        </motion.div>
      </div>
    </section>
  );
}

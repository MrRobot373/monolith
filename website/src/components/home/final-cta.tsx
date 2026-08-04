"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

export function HomeFinalCta() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden border-t border-border-soft py-28 md:py-36">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        animate={reduceMotion ? undefined : { opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        style={{
          background: "radial-gradient(600px circle at 50% 30%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 70%)",
        }}
      />
      <Container className="flex flex-col items-center text-center">
        <h2 className="max-w-[18ch] text-balance font-display text-[clamp(2.4rem,5.6vw,4.4rem)] leading-[1.02]">
          Put your next project in motion.
        </h2>
        <p className="mt-5 max-w-[50ch] text-[17px] leading-relaxed text-text-secondary">
          Deploy on your infrastructure, or ours — the guarantee doesn&apos;t change either way.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button href="/download" size="lg" showArrow>
            Get started
          </Button>
          <Button href="/docs" size="lg" variant="outline">
            Read the documentation
          </Button>
        </div>
      </Container>
    </section>
  );
}

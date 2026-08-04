"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform, MotionValue } from "framer-motion";

const STATEMENT =
  "MONOLITH is an agentic work platform for turning open-ended goals into finished, reviewed outcomes — on infrastructure you actually control.";

function Word({ word, progress, range }: { word: string; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.18, 1]);
  return (
    <motion.span style={{ opacity }} className="inline-block">
      {word}
    </motion.span>
  );
}

export function ManifestoSection() {
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 0.85", "end 0.4"],
  });

  const words = STATEMENT.split(" ");

  if (reduceMotion) {
    return (
      <section className="border-t border-border-soft py-28">
        <div className="mx-auto max-w-[900px] px-6 text-center md:px-10">
          <p className="text-balance font-display text-[clamp(1.7rem,4vw,2.8rem)] leading-[1.25] text-text-primary">
            {STATEMENT}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section ref={containerRef} className="relative border-t border-border-soft py-[40vh]">
      <div className="sticky top-[28vh] mx-auto max-w-[900px] px-6 text-center md:px-10">
        <p className="text-balance font-display text-[clamp(1.7rem,4vw,2.8rem)] leading-[1.25]">
          {words.map((word, i) => (
            <span key={i}>
              <Word word={word} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]} />{" "}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}

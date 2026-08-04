"use client";

import { motion, useReducedMotion } from "framer-motion";

export function LineReveal({
  lines,
  className,
  delayStart = 0,
}: {
  lines: string[];
  className?: string;
  delayStart?: number;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <span className={className}>
        {lines.map((line, i) => (
          <span key={i} className="block">
            {line}
          </span>
        ))}
      </span>
    );
  }

  return (
    <span className={className}>
      {lines.map((line, i) => (
        <span key={i} className="block overflow-hidden py-[0.05em]">
          <motion.span
            className="block"
            initial={{ y: "110%", opacity: 0 }}
            animate={{ y: "0%", opacity: 1 }}
            transition={{
              duration: 0.85,
              delay: delayStart + i * 0.08,
              ease: [0.16, 1, 0.3, 1] as const,
            }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

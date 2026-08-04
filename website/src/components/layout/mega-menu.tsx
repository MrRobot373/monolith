"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type MegaMenuItem = {
  label: string;
  href: string;
  description: string;
  eyebrow?: string;
};

export function MegaMenuPanel({
  open,
  items,
  featured,
  columns = 2,
}: {
  open: boolean;
  items: MegaMenuItem[];
  featured?: { label: string; href: string };
  columns?: 2 | 1;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] as const }}
          className="absolute left-1/2 top-full z-50 mt-3 w-[min(92vw,640px)] -translate-x-1/2"
          role="menu"
        >
          <div className="overflow-hidden rounded-[18px] border border-border-soft bg-bg-elevated shadow-[0_24px_60px_-24px_rgba(23,21,18,0.35)]">
            <div className={cn("grid gap-1 p-3", columns === 2 ? "sm:grid-cols-2" : "grid-cols-1")}>
              {items.map((item, i) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.16, delay: i * 0.025, ease: [0.22, 1, 0.36, 1] as const }}
                >
                  <Link
                    href={item.href}
                    role="menuitem"
                    className="group flex flex-col gap-1 rounded-[12px] px-4 py-3 transition-colors hover:bg-bg-secondary"
                  >
                    {item.eyebrow ? (
                      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-accent">
                        {item.eyebrow}
                      </span>
                    ) : null}
                    <span className="flex items-center gap-1.5 text-[14.5px] font-semibold text-text-primary">
                      {item.label}
                      <ArrowRight
                        size={13}
                        className="opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100"
                      />
                    </span>
                    <span className="text-[13px] leading-snug text-text-secondary">{item.description}</span>
                  </Link>
                </motion.div>
              ))}
            </div>
            {featured ? (
              <div className="border-t border-border-soft bg-bg-secondary px-5 py-3">
                <Link
                  href={featured.href}
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent hover:text-accent-hover"
                >
                  {featured.label}
                  <ArrowRight size={13} />
                </Link>
              </div>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

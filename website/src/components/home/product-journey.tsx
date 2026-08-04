"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion, useMotionValueEvent, useScroll, AnimatePresence } from "framer-motion";
import { ArrowRight, MessageSquare, Bot, Code2 } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";
import { products } from "@/content/products";
import { cn } from "@/lib/utils";

const icons = { chat: MessageSquare, agent: Bot, code: Code2 };
const colorVar: Record<string, string> = { accent: "var(--accent)", success: "var(--success)", warning: "var(--warning)" };

export function ProductJourney() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end end"] });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const idx = Math.min(products.length - 1, Math.floor(v * products.length));
    setActive(idx);
  });

  const activeProduct = products[active];

  return (
    <section className="border-t border-border-soft py-24 md:py-32">
      <div className="mx-auto max-w-[1180px] px-6 md:px-10">
        <SectionLabel>One platform</SectionLabel>
        <h2 className="mt-4 max-w-[20ch] font-display text-[clamp(2rem,4.4vw,3.4rem)] leading-[1.05] text-balance">
          Three ways your team already works.
        </h2>
      </div>

      {/* Desktop: sticky two-column */}
      <div ref={containerRef} className="relative mt-16 hidden md:block" style={{ height: `${products.length * 90}vh` }}>
        <div className="sticky top-24 mx-auto grid max-w-[1180px] grid-cols-[36px_1fr_1fr] gap-10 px-10">
          <div className="flex flex-col items-center gap-3 pt-2">
            {products.map((p, i) => (
              <button
                key={p.slug}
                aria-label={`Jump to ${p.name}`}
                onClick={() => {
                  const target = containerRef.current;
                  if (!target) return;
                  const y = target.offsetTop + (i / products.length) * target.offsetHeight + 40;
                  window.scrollTo({ top: y, behavior: "smooth" });
                }}
                className="flex flex-col items-center gap-3"
              >
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full border-2 transition-all",
                    i === active ? "scale-125 border-transparent" : "border-border-strong bg-transparent",
                  )}
                  style={i === active ? { background: colorVar[p.color] } : undefined}
                />
                {i < products.length - 1 ? <span className="h-16 w-px bg-border-soft" /> : null}
              </button>
            ))}
          </div>

          <div className="flex min-h-[380px] flex-col justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeProduct.slug}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] as const }}
              >
                <span className="font-mono text-[12px] uppercase tracking-[0.1em]" style={{ color: colorVar[activeProduct.color] }}>
                  {activeProduct.eyebrow}
                </span>
                <h3 className="mt-3 font-display text-[2.2rem] leading-[1.05] text-text-primary">{activeProduct.name}</h3>
                <p className="mt-4 max-w-[42ch] text-[15.5px] leading-relaxed text-text-secondary">{activeProduct.description}</p>
                <ul className="mt-6 flex flex-col gap-2.5">
                  {activeProduct.features.slice(0, 3).map((f) => (
                    <li key={f.title} className="flex items-start gap-2 text-[14px] text-text-secondary">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-text-muted" />
                      <span>
                        <span className="font-medium text-text-primary">{f.title}.</span> {f.description}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/product/${activeProduct.slug}`}
                  className="mt-7 inline-flex items-center gap-1.5 text-[14px] font-semibold text-text-primary hover:text-accent"
                >
                  Learn about {activeProduct.name} <ArrowRight size={15} />
                </Link>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeProduct.slug}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] as const }}
                className="flex aspect-[4/3] w-full max-w-[420px] items-center justify-center rounded-[22px] border border-border-soft"
                style={{ background: `color-mix(in srgb, ${colorVar[activeProduct.color]} 10%, var(--bg-elevated))` }}
              >
                {(() => {
                  const Icon = icons[activeProduct.slug];
                  return <Icon size={64} strokeWidth={1.1} style={{ color: colorVar[activeProduct.color] }} />;
                })()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Mobile: stacked cards */}
      <div className="mt-12 flex flex-col gap-6 px-6 md:hidden">
        {products.map((p) => {
          const Icon = icons[p.slug];
          return (
            <div key={p.slug} className="rounded-[20px] border border-border-soft bg-bg-elevated p-6">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-[14px]"
                style={{ background: `color-mix(in srgb, ${colorVar[p.color]} 12%, transparent)` }}
              >
                <Icon size={26} strokeWidth={1.3} style={{ color: colorVar[p.color] }} />
              </div>
              <h3 className="mt-4 font-display text-[1.5rem] text-text-primary">{p.name}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-text-secondary">{p.description}</p>
              <Link href={`/product/${p.slug}`} className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-semibold text-text-primary">
                Learn more <ArrowRight size={14} />
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}

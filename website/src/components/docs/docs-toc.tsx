"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function DocsToc({ headings }: { headings: { text: string; level: "h2" | "h3"; id: string }[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!headings.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 },
    );
    headings.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [headings]);

  if (!headings.length) return null;

  return (
    <nav aria-label="On this page" className="flex flex-col gap-1.5">
      <h3 className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-text-muted">On this page</h3>
      {headings.map((h) => (
        <a
          key={h.id}
          href={`#${h.id}`}
          className={cn(
            "text-[13px] leading-snug transition-colors",
            h.level === "h3" && "pl-3",
            activeId === h.id ? "font-medium text-accent" : "text-text-secondary hover:text-text-primary",
          )}
        >
          {h.text}
        </a>
      ))}
    </nav>
  );
}

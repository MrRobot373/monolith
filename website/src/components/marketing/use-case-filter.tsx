"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCases, useCaseCategories } from "@/content/use-cases";

export function UseCaseFilter() {
  const [category, setCategory] = useState<string | null>(null);
  const filtered = category ? useCases.filter((u) => u.category === category) : useCases;

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter use cases by category">
        <button
          onClick={() => setCategory(null)}
          className={cn(
            "rounded-full border px-4 py-1.5 text-[13px] transition-colors",
            category === null ? "border-accent bg-accent-soft text-accent-hover" : "border-border-soft text-text-secondary hover:border-border-strong",
          )}
        >
          All
        </button>
        {useCaseCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-[13px] transition-colors",
              category === cat ? "border-accent bg-accent-soft text-accent-hover" : "border-border-soft text-text-secondary hover:border-border-strong",
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((uc) => (
          <Link
            key={uc.slug}
            href={`/use-cases/${uc.slug}`}
            className="group flex flex-col rounded-[18px] border border-border-soft bg-bg-elevated p-6 transition-colors hover:border-border-strong"
          >
            <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-accent">{uc.category}</span>
            <h3 className="mt-2.5 text-[16.5px] font-semibold leading-snug text-text-primary">{uc.title}</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-text-secondary">{uc.outcome}</p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-text-primary">
              Explore workflow
              <ArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

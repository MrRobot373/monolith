import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";
import { docsCategories, docsPages } from "@/content/docs";

export const metadata: Metadata = {
  title: "Documentation",
  description: "Setup, architecture, and reference for MONOLITH Chat, Agent, and Code.",
};

export default function DocsHomePage() {
  return (
    <section className="py-16 md:py-24">
      <Container>
        <SectionLabel>Documentation</SectionLabel>
        <h1 className="mt-4 max-w-[26ch] text-balance font-display text-[clamp(2rem,4.6vw,3.2rem)] leading-[1.05]">
          Everything you need to run MONOLITH.
        </h1>
        <p className="mt-5 max-w-[60ch] text-[16px] leading-relaxed text-text-secondary">
          Start with a quick start, then go deep on deployment, each capability, and the security
          architecture. Press <kbd className="rounded-[5px] border border-border-soft bg-bg-secondary px-1.5 py-0.5 font-mono text-[11px]">Ctrl K</kbd> to search.
        </p>

        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {docsCategories.map((cat) => {
            const pages = docsPages.filter((p) => p.category === cat);
            if (!pages.length) return null;
            return (
              <div key={cat} className="rounded-[18px] border border-border-soft bg-bg-elevated p-6">
                <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent">{cat}</h2>
                <ul className="mt-3 flex flex-col gap-2.5">
                  {pages.map((p) => (
                    <li key={p.slug}>
                      <Link
                        href={`/docs/${p.slug}`}
                        className="group flex items-start justify-between gap-2 text-[14px] text-text-secondary hover:text-text-primary"
                      >
                        {p.title}
                        <ArrowRight size={13} className="mt-0.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

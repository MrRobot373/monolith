import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCases } from "@/content/use-cases";
import { products } from "@/content/products";

export function generateStaticParams() {
  return useCases.map((uc) => ({ slug: uc.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const uc = useCases.find((u) => u.slug === slug);
  if (!uc) return {};
  return { title: uc.title, description: uc.outcome };
}

export default async function UseCaseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const useCase = useCases.find((u) => u.slug === slug);
  if (!useCase) notFound();

  const related = useCases.filter((u) => u.slug !== useCase.slug && u.category === useCase.category).slice(0, 2);

  return (
    <>
      <section className="paper-grid border-b border-border-soft py-16 md:py-24">
        <Container wide className="max-w-[820px]">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] text-text-muted">
            <Link href="/use-cases" className="hover:text-text-primary">
              Use cases
            </Link>
            <ChevronRight size={13} />
            <span className="text-text-secondary">{useCase.category}</span>
          </nav>
          <SectionLabel className="mt-6">{useCase.category}</SectionLabel>
          <h1 className="mt-4 text-balance font-display text-[clamp(2rem,4.6vw,3.2rem)] leading-[1.05] text-text-primary">
            {useCase.title}
          </h1>
          <p className="mt-5 text-[16px] leading-relaxed text-text-secondary">{useCase.description}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {useCase.products.map((slug) => {
              const p = products.find((prod) => prod.slug === slug)!;
              return (
                <Badge key={slug} tone="accent">
                  {p.name}
                </Badge>
              );
            })}
          </div>
        </Container>
      </section>

      <section className="border-b border-border-soft py-16 md:py-20">
        <Container wide className="grid max-w-[820px] gap-10">
          <div>
            <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-muted">The problem</h2>
            <p className="mt-3 text-[15.5px] leading-relaxed text-text-primary">{useCase.problem}</p>
          </div>
          <div>
            <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-muted">The workflow</h2>
            <ol className="mt-4 flex flex-col gap-4">
              {useCase.workflowSteps.map((step, i) => (
                <li key={step.title} className="flex gap-4 rounded-[14px] border border-border-soft p-5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-[12px] text-accent-hover">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-[15px] font-semibold text-text-primary">{step.title}</p>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-text-secondary">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-muted">Tools used</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {useCase.toolsUsed.map((t) => (
                <Badge key={t}>{t}</Badge>
              ))}
            </div>
          </div>
          <div className="rounded-[14px] border border-border-soft bg-bg-secondary p-5">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-muted">Safety & review</h2>
            <p className="mt-3 text-[13.5px] leading-relaxed text-text-secondary">{useCase.safetyNotes}</p>
          </div>
        </Container>
      </section>

      {related.length ? (
        <section className="border-b border-border-soft py-16">
          <Container wide className="max-w-[820px]">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-muted">Related use cases</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {related.map((r) => (
                <Link key={r.slug} href={`/use-cases/${r.slug}`} className="group rounded-[14px] border border-border-soft p-5 hover:border-border-strong">
                  <p className="text-[14.5px] font-semibold text-text-primary">{r.title}</p>
                  <span className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-text-secondary group-hover:text-accent">
                    View <ArrowRight size={12} />
                  </span>
                </Link>
              ))}
            </div>
          </Container>
        </section>
      ) : null}

      <section className="py-16 text-center">
        <Container>
          <Button href="/download" size="lg" showArrow>
            Get started
          </Button>
        </Container>
      </section>
    </>
  );
}

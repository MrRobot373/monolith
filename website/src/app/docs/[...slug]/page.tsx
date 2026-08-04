import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { DocsSidebar } from "@/components/docs/docs-sidebar";
import { DocsToc } from "@/components/docs/docs-toc";
import { ContentBlocks, extractHeadings } from "@/components/marketing/content-blocks";
import { docsPages } from "@/content/docs";

export function generateStaticParams() {
  return docsPages.map((p) => ({ slug: p.slug.split("/") }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = docsPages.find((p) => p.slug === slug.join("/"));
  if (!page) return {};
  return { title: page.title, description: page.description };
}

export default async function DocsPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const joined = slug.join("/");
  const index = docsPages.findIndex((p) => p.slug === joined);
  if (index === -1) notFound();

  const page = docsPages[index];
  const prev = docsPages[index - 1];
  const next = docsPages[index + 1];
  const headings = extractHeadings(page.content);

  return (
    <Container wide className="grid grid-cols-1 gap-10 py-12 md:grid-cols-[220px_1fr] md:py-16 lg:grid-cols-[220px_1fr_200px]">
      <aside className="hidden md:block">
        <div className="sticky top-[128px]">
          <DocsSidebar />
        </div>
      </aside>

      <article className="min-w-0 max-w-[760px]">
        <nav aria-label="Breadcrumb" className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">
          {page.category}
        </nav>
        <h1 className="mt-3 text-balance font-display text-[clamp(1.9rem,3.6vw,2.6rem)] leading-[1.08] text-text-primary">{page.title}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">{page.description}</p>

        <div className="mt-10">
          <ContentBlocks blocks={page.content} />
        </div>

        <div className="mt-16 flex flex-col gap-3 border-t border-border-soft pt-6 sm:flex-row sm:justify-between">
          {prev ? (
            <Link href={`/docs/${prev.slug}`} className="group flex items-center gap-2 text-[13.5px] text-text-secondary hover:text-text-primary">
              <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
              {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={`/docs/${next.slug}`} className="group flex items-center gap-2 text-right text-[13.5px] text-text-secondary hover:text-text-primary">
              {next.title}
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : null}
        </div>
      </article>

      <aside className="hidden lg:block">
        <div className="sticky top-[128px]">
          <DocsToc headings={headings} />
        </div>
      </aside>
    </Container>
  );
}

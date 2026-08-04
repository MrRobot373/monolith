import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";
import { Button } from "@/components/ui/button";
import { FeatureGrid } from "./feature-grid";
import { FaqAccordion } from "./faq-accordion";
import { MediaFrame } from "./media-frame";
import type { Product } from "@/content/products";

const colorVar: Record<Product["color"], string> = {
  accent: "var(--accent)",
  success: "var(--success)",
  warning: "var(--warning)",
};

export function ProductDetailTemplate({ product }: { product: Product }) {
  const accent = colorVar[product.color];

  return (
    <>
      <section className="paper-grid border-b border-border-soft py-16 md:py-24">
        <Container>
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] text-text-muted">
            <Link href="/product" className="hover:text-text-primary">
              Product
            </Link>
            <ChevronRight size={13} />
            <span className="text-text-secondary">{product.name}</span>
          </nav>

          <div className="mt-8 grid gap-12 md:grid-cols-2 md:items-center">
            <div>
              <span className="font-mono text-[12px] uppercase tracking-[0.1em]" style={{ color: accent }}>
                {product.eyebrow}
              </span>
              <h1 className="mt-4 text-balance font-display text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.05] text-text-primary">
                {product.headline}
              </h1>
              <p className="mt-5 max-w-[52ch] text-[16px] leading-relaxed text-text-secondary">{product.description}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button href="/download" showArrow>
                  Get started
                </Button>
                <Button href="/docs" variant="outline">
                  Read the docs
                </Button>
              </div>
            </div>
            <MediaFrame label={`${product.slug}.monolith / session`}>
              <div className="flex flex-col gap-3 p-6">
                {product.workflow.map((step, i) => (
                  <div key={step.title} className="flex items-start gap-3 rounded-[10px] bg-bg-secondary p-3">
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] text-on-accent"
                      style={{ background: accent }}
                    >
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold text-text-primary">{step.title}</p>
                      <p className="text-[12px] text-text-secondary">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </MediaFrame>
          </div>
        </Container>
      </section>

      <section className="border-b border-border-soft py-20 md:py-28">
        <Container>
          <SectionLabel>Capabilities</SectionLabel>
          <h2 className="mt-4 max-w-[26ch] font-display text-[clamp(1.8rem,3.6vw,2.8rem)] leading-[1.08] text-balance">
            What {product.name} actually does.
          </h2>
          <div className="mt-12">
            <FeatureGrid features={product.features} accent={accent} />
          </div>
        </Container>
      </section>

      <section className="py-20 md:py-28">
        <Container wide className="max-w-[760px]">
          <SectionLabel>Questions</SectionLabel>
          <h2 className="mt-4 font-display text-[clamp(1.6rem,3vw,2.2rem)] text-text-primary">Frequently asked</h2>
          <div className="mt-8">
            <FaqAccordion items={product.faq} />
          </div>
        </Container>
      </section>
    </>
  );
}

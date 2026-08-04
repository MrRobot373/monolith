import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/marketing/product-card";
import { DemoGallery } from "@/components/home/demo-gallery";
import { HomeFinalCta } from "@/components/home/final-cta";
import { products, productPillars } from "@/content/products";

export const metadata: Metadata = {
  title: "Product overview",
  description: "One platform. Three ways your team already works — Chat, Agent, and Code.",
};

export default function ProductOverviewPage() {
  return (
    <>
      <section className="paper-grid border-b border-border-soft py-20 md:py-28">
        <Container className="text-center">
          <SectionLabel className="justify-center">Product</SectionLabel>
          <h1 className="mx-auto mt-5 max-w-[20ch] text-balance font-display text-[clamp(2.4rem,5.6vw,4.2rem)] leading-[1.02]">
            One platform. Three ways to work.
          </h1>
          <p className="mx-auto mt-6 max-w-[60ch] text-[17px] leading-relaxed text-text-secondary">
            Chat, Agent, and Code run on the same private foundation, deployed on your
            infrastructure or ours — so every team gets AI without a separate vendor relationship
            for each one.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button href="/download" showArrow>
              Get started
            </Button>
            <Button href="/deployment" variant="outline">
              Compare deployment options
            </Button>
          </div>
        </Container>
      </section>

      <section className="border-b border-border-soft py-20 md:py-28">
        <Container>
          <div className="grid gap-6 md:grid-cols-3">
            {products.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </Container>
      </section>

      <section className="border-b border-border-soft py-20 md:py-28">
        <Container>
          <SectionLabel>Why it holds together</SectionLabel>
          <h2 className="mt-4 max-w-[26ch] font-display text-[clamp(1.8rem,3.6vw,2.8rem)] leading-[1.08] text-balance">
            Six things true of every capability.
          </h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {productPillars.map((pillar) => (
              <div key={pillar.title} className="rounded-[16px] border border-border-soft p-6">
                <h3 className="text-[15.5px] font-semibold text-text-primary">{pillar.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-text-secondary">{pillar.description}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <DemoGallery />
      <HomeFinalCta />
    </>
  );
}

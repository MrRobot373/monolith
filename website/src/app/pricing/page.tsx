import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";
import { PricingCard } from "@/components/marketing/pricing-card";
import { FeatureMatrix } from "@/components/marketing/feature-matrix";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { pricingTiers, pricingFaqs } from "@/content/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Self-hosted, managed, or enterprise — MONOLITH pricing depends on deployment shape, not a fixed seat count.",
};

export default function PricingPage() {
  return (
    <>
      <section className="paper-grid border-b border-border-soft py-20 md:py-28">
        <Container className="text-center">
          <SectionLabel className="justify-center">Pricing</SectionLabel>
          <h1 className="mx-auto mt-5 max-w-[20ch] text-balance font-display text-[clamp(2.4rem,5.6vw,4.2rem)] leading-[1.02]">
            Priced like infrastructure, not like a seat count.
          </h1>
          <p className="mx-auto mt-6 max-w-[56ch] text-[17px] leading-relaxed text-text-secondary">
            MONOLITH&apos;s cost depends on how you deploy it, not a flat per-user fee. Talk to us
            and we&apos;ll scope it against your actual usage.
          </p>
        </Container>
      </section>

      <section className="border-b border-border-soft py-20 md:py-28">
        <Container>
          <div className="grid gap-6 md:grid-cols-3">
            {pricingTiers.map((tier) => (
              <PricingCard key={tier.slug} tier={tier} />
            ))}
          </div>
        </Container>
      </section>

      <section className="border-b border-border-soft py-20 md:py-28">
        <Container>
          <SectionLabel>Compare</SectionLabel>
          <h2 className="mt-4 max-w-[26ch] font-display text-[clamp(1.8rem,3.6vw,2.8rem)] leading-[1.08] text-balance">
            What&apos;s included, by plan.
          </h2>
          <div className="mt-10">
            <FeatureMatrix />
          </div>
        </Container>
      </section>

      <section className="py-20 md:py-28">
        <Container wide className="max-w-[760px]">
          <SectionLabel>Questions</SectionLabel>
          <h2 className="mt-4 font-display text-[clamp(1.6rem,3vw,2.2rem)] text-text-primary">Pricing FAQ</h2>
          <div className="mt-8">
            <FaqAccordion items={pricingFaqs} />
          </div>
        </Container>
      </section>
    </>
  );
}

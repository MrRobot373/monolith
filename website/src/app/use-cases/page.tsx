import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";
import { UseCaseFilter } from "@/components/marketing/use-case-filter";
import { HomeFinalCta } from "@/components/home/final-cta";

export const metadata: Metadata = {
  title: "Use cases",
  description: "What organizations actually hand off to MONOLITH — Chat, Agent, and Code, by team.",
};

export default function UseCasesPage() {
  return (
    <>
      <section className="paper-grid border-b border-border-soft py-20 md:py-28">
        <Container className="text-center">
          <SectionLabel className="justify-center">Use cases</SectionLabel>
          <h1 className="mx-auto mt-5 max-w-[18ch] text-balance font-display text-[clamp(2.4rem,5.6vw,4.2rem)] leading-[1.02]">
            What will you hand off?
          </h1>
          <p className="mx-auto mt-6 max-w-[56ch] text-[17px] leading-relaxed text-text-secondary">
            Real workflows across engineering, research, operations, and IT — grounded in what
            MONOLITH actually does today, not a roadmap.
          </p>
        </Container>
      </section>

      <section className="py-20 md:py-28">
        <Container>
          <UseCaseFilter />
        </Container>
      </section>

      <HomeFinalCta />
    </>
  );
}

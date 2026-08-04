import type { Metadata } from "next";
import { Check } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";
import { Button } from "@/components/ui/button";
import { ComparisonTable } from "@/components/marketing/comparison-table";
import { HomeFinalCta } from "@/components/home/final-cta";
import { deploymentPlans, sharedGuarantees, comparisonRows } from "@/content/deployment";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Deployment",
  description: "Two ways to run MONOLITH — on your infrastructure, or ours. Same architecture, same guarantee.",
};

const toneVar = { cool: "var(--accent-yellow)", warm: "var(--accent)" } as const;

export default function DeploymentPage() {
  return (
    <>
      <section className="paper-grid border-b border-border-soft py-20 md:py-28">
        <Container className="text-center">
          <SectionLabel className="justify-center">Deployment</SectionLabel>
          <h1 className="mx-auto mt-5 max-w-[22ch] text-balance font-display text-[clamp(2.4rem,5.6vw,4.2rem)] leading-[1.02]">
            Two ways to run it. Same guarantee.
          </h1>
          <p className="mx-auto mt-6 max-w-[60ch] text-[17px] leading-relaxed text-text-secondary">
            MONOLITH is built to be deployed, not just subscribed to. Choose the shape that fits
            your infrastructure — the privacy guarantee doesn&apos;t change either way.
          </p>
        </Container>
      </section>

      <section className="border-b border-border-soft py-20 md:py-28">
        <Container>
          <div className="grid gap-1 overflow-hidden rounded-[24px] border border-border-soft bg-border-soft md:grid-cols-2">
            {deploymentPlans.map((plan) => (
              <div key={plan.slug} id={plan.slug} className="scroll-mt-28 bg-bg-elevated p-8 md:p-10">
                <span
                  className="inline-block h-[3px] w-10 rounded-full"
                  style={{ background: toneVar[plan.color] }}
                  aria-hidden
                />
                <span className="mt-4 block font-mono text-[11px] uppercase tracking-[0.1em]" style={{ color: toneVar[plan.color] }}>
                  {plan.eyebrow}
                </span>
                <h2 className="mt-3 font-display text-[28px] text-text-primary">{plan.name}</h2>
                <p className="mt-1 text-[14px] font-medium text-text-secondary">{plan.tagline}</p>
                <p className="mt-4 text-[14.5px] leading-relaxed text-text-secondary">{plan.description}</p>

                <h3 className="mt-6 font-mono text-[11px] uppercase tracking-[0.1em] text-text-muted">Best for</h3>
                <ul className="mt-3 flex flex-col gap-2">
                  {plan.bestFor.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-[13.5px] text-text-secondary">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-text-muted" />
                      {item}
                    </li>
                  ))}
                </ul>

                <h3 className="mt-6 font-mono text-[11px] uppercase tracking-[0.1em] text-text-muted">Included</h3>
                <ul className="mt-3 flex flex-col gap-2">
                  {plan.included.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-[13.5px] text-text-primary">
                      <Check size={14} className="mt-0.5 shrink-0" style={{ color: toneVar[plan.color] }} />
                      {item}
                    </li>
                  ))}
                </ul>

                <div className="mt-8">
                  <Button href="/download" showArrow>
                    {plan.cta}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-b border-border-soft py-20 md:py-28">
        <Container>
          <SectionLabel>Shared, not split</SectionLabel>
          <h2 className="mt-4 max-w-[24ch] font-display text-[clamp(1.8rem,3.6vw,2.8rem)] leading-[1.08] text-balance">
            What&apos;s identical on both plans.
          </h2>
          <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-text-secondary">
            The managed plan is not a separate, more scalable product — it&apos;s the same
            deployable stack, operated by MONOLITH instead of your own team.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {sharedGuarantees.map((g) => (
              <div key={g.key} className={cn("rounded-[14px] border border-border-soft p-5")}>
                <h3 className="font-mono text-[11px] uppercase tracking-[0.08em] text-accent">{g.key}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-text-primary">{g.value}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-20 md:py-28">
        <Container>
          <SectionLabel>The trade-off</SectionLabel>
          <h2 className="mt-4 max-w-[26ch] font-display text-[clamp(1.8rem,3.6vw,2.8rem)] leading-[1.08] text-balance">
            Compared to a public AI vendor.
          </h2>
          <div className="mt-10">
            <ComparisonTable rows={comparisonRows} />
          </div>
        </Container>
      </section>

      <HomeFinalCta />
    </>
  );
}

import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";
import { CodeBlock } from "@/components/ui/code-block";

export const metadata: Metadata = {
  title: "Press",
  description: "Company boilerplate, product description, and press contact for MONOLITH.",
};

const boilerplate =
  "MONOLITH is a private AI workspace — chat, agents, and a coding assistant — built by GetMySolution. " +
  "It deploys either on a customer's own infrastructure or on a dedicated, isolated MONOLITH-operated " +
  "environment, and never uses customer data to train any model.";

export default function PressPage() {
  return (
    <section className="py-16 md:py-24">
      <Container wide className="max-w-[760px]">
        <SectionLabel>Press</SectionLabel>
        <h1 className="mt-4 max-w-[20ch] text-balance font-display text-[clamp(2rem,4.6vw,3.2rem)] leading-[1.05]">
          Press &amp; company resources.
        </h1>

        <div className="mt-14">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-muted">Company boilerplate</h2>
          <p className="mt-3 max-w-[64ch] text-[15px] leading-relaxed text-text-primary">{boilerplate}</p>
          <div className="mt-4">
            <CodeBlock lang="text" code={boilerplate} />
          </div>
        </div>

        <div className="mt-14">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-muted">Quick facts</h2>
          <ul className="mt-3 flex flex-col gap-2 text-[14.5px] leading-relaxed text-text-secondary">
            <li>Product: MONOLITH — AI Chat, Agent, and Code</li>
            <li>Company: GetMySolution</li>
            <li>Deployment: self-hosted or MONOLITH-managed, same architecture</li>
            <li>Status: early access — actively onboarding design partners</li>
          </ul>
        </div>

        <div className="mt-14">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-muted">Brand assets</h2>
          <p className="mt-3 max-w-[62ch] text-[14.5px] leading-relaxed text-text-secondary">
            A downloadable logo and brand-asset kit isn&apos;t published yet. Reach out to your
            MONOLITH contact for wordmark and color-token files ahead of a formal press kit.
          </p>
        </div>

        <div className="mt-14 rounded-[16px] border border-border-soft bg-bg-secondary p-6">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-muted">Press contact</h2>
          <p className="mt-3 text-[14.5px] leading-relaxed text-text-secondary">
            For press inquiries, reach out through your existing MONOLITH point of contact. A
            dedicated press address will be published here once established.
          </p>
        </div>

        <div className="mt-14">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-muted">In the news</h2>
          <p className="mt-3 text-[14.5px] leading-relaxed text-text-secondary">
            No press coverage to link yet — MONOLITH is in early access.
          </p>
        </div>
      </Container>
    </section>
  );
}

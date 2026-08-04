import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Placeholder terms of service structure for MONOLITH — replace with counsel-reviewed content before launch.",
};

const sections = [
  { title: "Acceptance of terms", body: "State how a customer agrees to these terms (order form, click-through, or signed agreement)." },
  { title: "The service", body: "Describe what's being licensed — the self-hosted deployment, the managed service, or both — and any usage limits." },
  { title: "Customer data", body: "State ownership of customer content and confirm the no-training guarantee as a contractual term, not just marketing language." },
  { title: "Acceptable use", body: "Describe prohibited uses of the platform." },
  { title: "Service levels and support", body: "Describe uptime commitments (if any) for the managed plan and support response expectations." },
  { title: "Liability and warranty", body: "Standard limitation-of-liability and warranty disclaimer language, reviewed by counsel." },
  { title: "Termination", body: "Describe how either party can end the agreement and what happens to customer data on exit." },
];

export default function TermsPage() {
  return (
    <section className="py-16 md:py-24">
      <Container wide className="max-w-[720px]">
        <SectionLabel>Legal</SectionLabel>
        <h1 className="mt-4 font-display text-[clamp(2rem,4.2vw,2.8rem)] leading-[1.05] text-text-primary">Terms of Service</h1>

        <div className="mt-6 rounded-[14px] border border-warning/30 bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] p-5 text-[13.5px] leading-relaxed text-text-primary">
          <strong className="font-semibold">Placeholder content.</strong> This page is a structural
          skeleton, not a real terms of service — replace every section below with
          counsel-reviewed language before this page is published or relied on contractually.
        </div>

        <div className="mt-12 flex flex-col gap-10">
          {sections.map((s) => (
            <div key={s.title}>
              <h2 className="text-[17px] font-semibold text-text-primary">{s.title}</h2>
              <p className="mt-2 text-[14.5px] leading-relaxed text-text-secondary">{s.body}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

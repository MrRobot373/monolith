import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Placeholder privacy policy structure for MONOLITH — replace with counsel-reviewed content before launch.",
};

const sections = [
  { title: "Information we collect", body: "Describe what account, usage, and telemetry data is collected across the self-hosted and managed deployment paths." },
  { title: "How we use it", body: "Describe operational uses (billing, support, product improvement) — and state explicitly that customer content is never used for model training." },
  { title: "Data residency and retention", body: "Describe where data lives on each deployment plan and how long it's retained." },
  { title: "Third parties and subprocessors", body: "List any subprocessors used for the managed plan (infrastructure providers, model providers if applicable)." },
  { title: "Your rights", body: "Describe access, correction, deletion, and export rights, and how a customer exercises them today." },
  { title: "Contact", body: "Provide a real contact channel for privacy questions." },
];

export default function PrivacyPolicyPage() {
  return (
    <section className="py-16 md:py-24">
      <Container wide className="max-w-[720px]">
        <SectionLabel>Legal</SectionLabel>
        <h1 className="mt-4 font-display text-[clamp(2rem,4.2vw,2.8rem)] leading-[1.05] text-text-primary">Privacy Policy</h1>

        <div className="mt-6 rounded-[14px] border border-warning/30 bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] p-5 text-[13.5px] leading-relaxed text-text-primary">
          <strong className="font-semibold">Placeholder content.</strong> This page is a structural
          skeleton, not a real privacy policy — replace every section below with
          counsel-reviewed language specific to your actual data handling before this page goes
          live. Publishing this as-is would misrepresent your practices.
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

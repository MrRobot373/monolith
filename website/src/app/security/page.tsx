import type { Metadata } from "next";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";
import { HomeFinalCta } from "@/components/home/final-cta";

export const metadata: Metadata = {
  title: "Security",
  description: "What's true of MONOLITH's architecture today, and what isn't built yet — stated plainly.",
};

const real = [
  "Host-level password authentication before reaching the application",
  "A real in-app account system with a verified sign-up flow",
  "Proven per-user container and data isolation — no session crossover",
  "Org admin controls: approval mode, search access, member visibility, usage tracking",
  "Manual approval mode by default — agents ask before sensitive actions",
  "Volume-level backup and restore tooling for self-hosted deployments",
];

const notYet = [
  "True single sign-on — access today is host-level password auth per subdomain",
  "Compliance certifications (SOC 2, ISO 27001, HIPAA, or similar) — none currently held",
  "Fine-grained role-based permissions beyond admin vs. member",
  "A self-serve one-click data export button in the product UI",
];

export default function SecurityPage() {
  return (
    <>
      <section className="paper-grid border-b border-border-soft py-20 md:py-28">
        <Container className="text-center">
          <SectionLabel className="justify-center">Security</SectionLabel>
          <h1 className="mx-auto mt-5 max-w-[22ch] text-balance font-display text-[clamp(2.4rem,5.6vw,4.2rem)] leading-[1.02]">
            What&apos;s real today, stated plainly.
          </h1>
          <p className="mx-auto mt-6 max-w-[58ch] text-[17px] leading-relaxed text-text-secondary">
            Trust isn&apos;t a claim in a policy document — it&apos;s a property of the
            architecture. Here&apos;s what&apos;s actually true, and what isn&apos;t built yet.
          </p>
        </Container>
      </section>

      <section className="border-b border-border-soft py-20 md:py-28">
        <Container>
          <div className="grid gap-8 md:grid-cols-2">
            <div className="rounded-[20px] border border-border-soft bg-bg-elevated p-8">
              <h2 className="flex items-center gap-2 text-[16px] font-semibold text-success">
                <Check size={18} /> True today
              </h2>
              <ul className="mt-5 flex flex-col gap-3">
                {real.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[14px] leading-relaxed text-text-primary">
                    <Check size={15} className="mt-0.5 shrink-0 text-success" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[20px] border border-border-soft bg-bg-elevated p-8">
              <h2 className="flex items-center gap-2 text-[16px] font-semibold text-warning">
                <X size={18} /> Not built yet
              </h2>
              <ul className="mt-5 flex flex-col gap-3">
                {notYet.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[14px] leading-relaxed text-text-primary">
                    <X size={15} className="mt-0.5 shrink-0 text-warning" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-[12.5px] leading-relaxed text-text-muted">
                If you need any of these for a compliance review, confirm current status directly
                rather than assuming from general marketing language.
              </p>
            </div>
          </div>
        </Container>
      </section>

      <section className="py-20 md:py-28">
        <Container wide className="max-w-[700px]">
          <SectionLabel>The core guarantee</SectionLabel>
          <h2 className="mt-4 font-display text-[clamp(1.8rem,3.6vw,2.6rem)] leading-[1.08] text-balance">
            Your data is never used to train a model — ours or anyone else&apos;s.
          </h2>
          <p className="mt-5 text-[15.5px] leading-relaxed text-text-secondary">
            This is true whether you self-host or run on MONOLITH-managed infrastructure, because
            both plans run the identical architecture — the only variable that changes is who
            operates it. See the{" "}
            <Link href="/deployment" className="text-accent hover:text-accent-hover">
              deployment page
            </Link>{" "}
            for the full comparison, or the{" "}
            <Link href="/docs/security/architecture" className="text-accent hover:text-accent-hover">
              full security architecture doc
            </Link>
            .
          </p>
        </Container>
      </section>

      <HomeFinalCta />
    </>
  );
}

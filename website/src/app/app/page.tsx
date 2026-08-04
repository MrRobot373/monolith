import type { Metadata } from "next";
import { Info } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";
import { AppShell } from "@/components/demo/app-shell";

export const metadata: Metadata = {
  title: "Interactive demo",
  description: "A static, front-end-only walkthrough of the real MONOLITH workspace — Dispatch, Projects, Scheduled tasks, Customize, and Admin.",
  robots: { index: false, follow: true },
};

export default function AppDemoPage() {
  return (
    <section className="py-14 md:py-20">
      <Container wide>
        <div className="text-center">
          <SectionLabel className="justify-center">Interactive demo</SectionLabel>
          <h1 className="mx-auto mt-4 max-w-[24ch] text-balance font-display text-[clamp(1.9rem,4vw,3rem)] leading-[1.05]">
            Click around the real workspace layout.
          </h1>
        </div>

        <div className="mx-auto mt-6 flex max-w-[640px] items-start gap-2.5 rounded-[12px] border border-border-soft bg-bg-secondary px-4 py-3 text-[13px] text-text-secondary">
          <Info size={15} className="mt-0.5 shrink-0 text-accent" />
          This is a static front-end demo, not connected to a live agent or a real model — it
          mirrors the actual product&apos;s layout and interactions (mode tabs, task rail, scheduled
          tasks, approvals, customize) so you can see how it behaves before deploying it for real.
        </div>

        <div className="mt-10">
          <AppShell />
        </div>
      </Container>
    </section>
  );
}

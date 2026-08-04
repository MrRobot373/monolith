import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";
import { Button } from "@/components/ui/button";
import { changelog } from "@/content/changelog";

export const metadata: Metadata = {
  title: "Releases",
  description: "MONOLITH's current release status and how it ships.",
};

export default function ReleasesPage() {
  const latest = changelog[0];

  return (
    <section className="py-16 md:py-24">
      <Container wide className="max-w-[720px]">
        <SectionLabel>Releases</SectionLabel>
        <h1 className="mt-4 max-w-[22ch] text-balance font-display text-[clamp(2rem,4.6vw,3.2rem)] leading-[1.05]">
          Continuously deployed, not versioned in the traditional sense.
        </h1>
        <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-text-secondary">
          MONOLITH doesn&apos;t currently ship numbered point releases (v1.2.3-style) — self-hosted
          deployments update by pulling the latest deployment scripts, and managed deployments are
          updated directly. The most recent dated entry is below; the full history lives in the
          changelog.
        </p>

        <div className="mt-10 rounded-[18px] border border-border-soft bg-bg-elevated p-7">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-accent">Most recent</span>
          <h2 className="mt-2 font-display text-[22px] text-text-primary">{latest.version}</h2>
          <p className="mt-1 font-mono text-[12.5px] text-text-muted">{latest.date}</p>
          <div className="mt-5">
            <Button href="/changelog" variant="outline" showArrow>
              View full changelog
            </Button>
          </div>
        </div>

        <div className="mt-10 rounded-[14px] border border-border-soft bg-bg-secondary p-6 text-[13.5px] leading-relaxed text-text-secondary">
          Self-hosting and want update notes before pulling the latest deployment? See the{" "}
          <Link href="/docs/deployment/self-hosted" className="text-accent hover:text-accent-hover">
            self-hosted deployment docs
          </Link>
          .
        </div>
      </Container>
    </section>
  );
}

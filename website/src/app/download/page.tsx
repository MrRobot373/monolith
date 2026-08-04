import type { Metadata } from "next";
import Link from "next/link";
import * as Tabs from "@radix-ui/react-tabs";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import { OsDetectNote } from "@/components/marketing/os-detect-note";

export const metadata: Metadata = {
  title: "Download & deploy",
  description: "Three real ways to get MONOLITH running: self-hosted Docker, a native Windows launcher, or a managed instance.",
};

const tabTriggerClass =
  "rounded-[10px] px-4 py-2.5 text-[14px] font-medium text-text-secondary transition-colors data-[state=active]:bg-bg-elevated data-[state=active]:text-text-primary data-[state=active]:shadow-[0_1px_0_rgba(0,0,0,0.04)]";

export default function DownloadPage() {
  return (
    <>
      <section className="paper-grid border-b border-border-soft py-20 md:py-28">
        <Container className="text-center">
          <SectionLabel className="justify-center">Get started</SectionLabel>
          <h1 className="mx-auto mt-5 max-w-[22ch] text-balance font-display text-[clamp(2.4rem,5.6vw,4.2rem)] leading-[1.02]">
            Get MONOLITH running.
          </h1>
          <p className="mx-auto mt-6 max-w-[56ch] text-[17px] leading-relaxed text-text-secondary">
            MONOLITH isn&apos;t a single installer — it&apos;s infrastructure you deploy. Pick the
            path that matches how you want to run it.
          </p>
          <div className="mx-auto max-w-[420px]">
            <OsDetectNote />
          </div>
        </Container>
      </section>

      <section className="py-20 md:py-28">
        <Container wide className="max-w-[820px]">
          <Tabs.Root defaultValue="docker">
            <Tabs.List className="flex flex-wrap gap-1 rounded-[14px] bg-bg-secondary p-1.5" aria-label="Deployment path">
              <Tabs.Trigger value="docker" className={tabTriggerClass}>
                Self-Hosted (Docker)
              </Tabs.Trigger>
              <Tabs.Trigger value="native" className={tabTriggerClass}>
                Native (Windows)
              </Tabs.Trigger>
              <Tabs.Trigger value="managed" className={tabTriggerClass}>
                Managed
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="docker" className="mt-8 focus-visible:outline-none">
              <h2 className="font-display text-[24px] text-text-primary">Self-hosted with Docker Compose</h2>
              <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-text-secondary">
                The full multi-user stack — reverse proxy, model gateway, isolated per-user
                workspaces — on infrastructure you control. Requires Docker and Docker Compose.
              </p>
              <div className="mt-6 flex flex-col gap-4">
                <CodeBlock
                  lang="bash"
                  code={`cp .env.example .env
# add a provider key for stronger answers, e.g. ANTHROPIC_API_KEY=
docker compose up -d --build`}
                />
                <CodeBlock lang="bash" code={`docker compose exec ollama ollama pull qwen2.5:0.5b`} />
              </div>
              <p className="mt-4 text-[13px] text-text-muted">
                Minimum requirements: a machine that can run Docker Compose with at least a few GB
                of free memory for local models. See the{" "}
                <Link href="/docs/getting-started/quick-start-docker" className="text-accent hover:text-accent-hover">
                  full setup guide
                </Link>{" "}
                for adding users and cloud model keys.
              </p>
            </Tabs.Content>

            <Tabs.Content value="native" className="mt-8 focus-visible:outline-none">
              <h2 className="font-display text-[24px] text-text-primary">Native, single machine (Windows)</h2>
              <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-text-secondary">
                Run the real MONOLITH workspace locally, backed by local models, without standing
                up Docker. Best for a fast, single-user evaluation — not for team rollout.
              </p>
              <div className="mt-6 rounded-[14px] border border-border-soft bg-bg-secondary p-5 text-[14px] text-text-secondary">
                The native launcher currently supports Windows. See the{" "}
                <Link href="/docs/getting-started/quick-start-native" className="text-accent hover:text-accent-hover">
                  native quick start
                </Link>{" "}
                in the docs for setup steps.
              </div>
              <p className="mt-4 text-[13px] text-text-muted">
                Minimum requirements: Windows 10/11, a few GB of free disk space for local models.
              </p>
            </Tabs.Content>

            <Tabs.Content value="managed" className="mt-8 focus-visible:outline-none">
              <h2 className="font-display text-[24px] text-text-primary">Managed instance</h2>
              <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-text-secondary">
                Skip provisioning entirely — MONOLITH operates a dedicated, isolated environment
                for your organization, with the same guarantees as self-hosting.
              </p>
              <div className="mt-6">
                <Button href="/pricing" showArrow>
                  Talk to us about a managed instance
                </Button>
              </div>
            </Tabs.Content>
          </Tabs.Root>

          <div className="mt-16 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-border-soft pt-8 text-[13.5px] text-text-secondary">
            <Link href="/changelog" className="hover:text-text-primary">
              Previous releases →
            </Link>
            <Link href="/docs" className="hover:text-text-primary">
              Installation help →
            </Link>
            <Link href="/security" className="hover:text-text-primary">
              Security note →
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}

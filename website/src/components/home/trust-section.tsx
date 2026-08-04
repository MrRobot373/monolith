import { ShieldCheck, Eye, ListChecks } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";
import { Button } from "@/components/ui/button";

const points = [
  {
    icon: ShieldCheck,
    title: "Approval mode, org-wide",
    body: "Manual is the default: agents stop and ask before a sensitive action. Switch to automatic only once your org is ready to trust the workflow.",
  },
  {
    icon: ListChecks,
    title: "Per-action approval, in-session",
    body: "Even under automatic mode, individual tool calls can surface an explicit approve/deny prompt — a finer checkpoint than the org-wide setting alone.",
  },
  {
    icon: Eye,
    title: "A run history you can actually audit",
    body: "Every scheduled run is logged with a pass/fail state and a link to the real session — not a summary someone has to trust blindly.",
  },
];

export function TrustSection() {
  return (
    <section className="border-t border-border-soft bg-[#12110f] py-24 text-[#f5f0e7] md:py-32">
      <Container>
        <SectionLabel className="text-[#8f877d]">Trust and control</SectionLabel>
        <h2 className="mt-4 max-w-[26ch] font-display text-[clamp(2rem,4.4vw,3.4rem)] leading-[1.05] text-balance">
          Automation you can actually inspect.
        </h2>
        <p className="mt-5 max-w-[60ch] text-[16px] leading-relaxed text-[#bdb4a8]">
          Trust isn&apos;t a claim in a policy document here — it&apos;s a checkpoint built into how agents run.
        </p>

        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {points.map((p) => (
            <div key={p.title} className="rounded-[18px] border border-white/10 bg-white/[0.03] p-7">
              <p.icon size={22} strokeWidth={1.4} className="text-[#e57d58]" />
              <h3 className="mt-4 text-[17px] font-semibold">{p.title}</h3>
              <p className="mt-2.5 text-[14px] leading-relaxed text-[#bdb4a8]">{p.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10">
          <Button href="/security" variant="outline" className="border-white/25 text-[#f5f0e7] hover:border-[#e57d58] hover:text-[#e57d58]" showArrow>
            Read the security architecture
          </Button>
        </div>
      </Container>
    </section>
  );
}

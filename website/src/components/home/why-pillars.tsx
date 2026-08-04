import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";
import { cn } from "@/lib/utils";

const pillars = [
  {
    label: "Not narration",
    title: "Agents that do the work, not just describe it",
    body: "Chat, research, and coding agents act inside your real workspace — reading real files, running real commands, producing a real diff — instead of telling a human what they should go do next.",
    dark: false,
  },
  {
    label: "Not a black box",
    title: "Nothing runs invisibly",
    body: "A task rail shows progress, artifacts, and context for every session. Scheduled runs keep a full history with a link to exactly what happened. If something fails, you're looking at the real transcript, not a log line.",
    dark: true,
  },
  {
    label: "Not unattended by default",
    title: "Approval before anything sensitive",
    body: "Manual approval is the default — an agent stops and asks before a risky action. Individual tool calls can require sign-off even when the org runs in automatic mode for everything else.",
    dark: false,
  },
];

export function WhyPillars() {
  return (
    <section className="border-t border-border-soft">
      {pillars.map((p) => (
        <div
          key={p.title}
          className={cn("border-b border-border-soft py-20 md:py-24", p.dark && "bg-[#171512] text-[#f5f0e7]")}
        >
          <Container className="grid gap-6 md:grid-cols-[1fr_1.4fr] md:gap-16">
            <div>
              <SectionLabel className={cn(p.dark && "text-[#8f877d]")}>{p.label}</SectionLabel>
            </div>
            <div>
              <h3 className={cn("max-w-[18ch] font-display text-[clamp(1.8rem,3.4vw,2.6rem)] leading-[1.08] text-balance", !p.dark && "text-text-primary")}>
                {p.title}
              </h3>
              <p className={cn("mt-5 max-w-[56ch] text-[16px] leading-relaxed", p.dark ? "text-[#bdb4a8]" : "text-text-secondary")}>
                {p.body}
              </p>
            </div>
          </Container>
        </div>
      ))}
    </section>
  );
}

import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";
import { Badge } from "@/components/ui/badge";
import { changelog } from "@/content/changelog";

export const metadata: Metadata = {
  title: "Changelog",
  description: "What shipped in MONOLITH, and when.",
};

export default function ChangelogPage() {
  return (
    <section className="py-16 md:py-24">
      <Container wide className="max-w-[820px]">
        <SectionLabel>Changelog</SectionLabel>
        <h1 className="mt-4 max-w-[22ch] text-balance font-display text-[clamp(2rem,4.6vw,3.2rem)] leading-[1.05]">
          What shipped, and when.
        </h1>
        <p className="mt-5 max-w-[60ch] text-[15px] leading-relaxed text-text-secondary">
          MONOLITH ships continuously rather than on a fixed release train — entries below are
          grouped by the day they landed.
        </p>

        <ol className="mt-14 flex flex-col gap-10 border-l border-border-soft pl-8">
          {changelog.map((entry) => (
            <li key={entry.version} id={entry.date} className="relative scroll-mt-28">
              <span className="absolute -left-[37px] top-1 h-3 w-3 rounded-full border-2 border-bg-primary bg-accent" aria-hidden />
              <div className="flex flex-wrap items-center gap-3">
                <time className="font-mono text-[13px] text-text-muted">{entry.date}</time>
                <div className="flex gap-1.5">
                  {entry.products.map((p) => (
                    <Badge key={p}>{p}</Badge>
                  ))}
                </div>
              </div>
              <h2 className="mt-2 font-display text-[19px] text-text-primary">{entry.version}</h2>

              {entry.additions.length ? (
                <div className="mt-4">
                  <h3 className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-accent">Added</h3>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {entry.additions.map((item) => (
                      <li key={item} className="text-[14px] leading-relaxed text-text-secondary">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {entry.improvements.length ? (
                <div className="mt-4">
                  <h3 className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-text-muted">Improved</h3>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {entry.improvements.map((item) => (
                      <li key={item} className="text-[14px] leading-relaxed text-text-secondary">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {entry.fixes.length ? (
                <div className="mt-4">
                  <h3 className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-warning">Fixed</h3>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {entry.fixes.map((item) => (
                      <li key={item} className="text-[14px] leading-relaxed text-text-secondary">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

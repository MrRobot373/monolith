import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PricingTier } from "@/content/pricing";

export function PricingCard({ tier }: { tier: PricingTier }) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-[22px] border p-8",
        tier.highlighted ? "border-accent bg-accent-soft/40 shadow-[0_20px_50px_-24px_rgba(216,111,76,0.35)]" : "border-border-soft bg-bg-elevated",
      )}
    >
      {tier.highlighted ? (
        <span className="mb-4 inline-flex w-fit items-center rounded-full bg-accent px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-on-accent">
          Most common
        </span>
      ) : null}
      <h3 className="font-display text-[22px] text-text-primary">{tier.name}</h3>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-display text-[34px] text-text-primary">{tier.price}</span>
      </div>
      <p className="mt-1 text-[13px] text-text-muted">{tier.priceNote}</p>
      <p className="mt-4 text-[14px] leading-relaxed text-text-secondary">{tier.description}</p>

      <ul className="mt-6 flex flex-1 flex-col gap-2.5">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-[13.5px] text-text-secondary">
            <Check size={14} className="mt-0.5 shrink-0 text-accent" />
            {f}
          </li>
        ))}
      </ul>

      <Button href={tier.ctaHref} variant={tier.highlighted ? "solid" : "outline"} className="mt-8 w-full justify-center">
        {tier.cta}
      </Button>
    </div>
  );
}

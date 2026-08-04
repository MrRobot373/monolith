import { cn } from "@/lib/utils";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "success" | "warning";
  className?: string;
}) {
  // Tinted backgrounds pair with dark ink text (not colored text) so every
  // tone clears WCAG AA contrast at this font size — the dot carries the color.
  const tones: Record<string, string> = {
    neutral: "bg-bg-secondary text-text-secondary border-border-soft",
    accent: "bg-accent-soft text-text-primary border-transparent",
    success: "bg-[color-mix(in_srgb,var(--success)_18%,var(--bg-elevated))] text-text-primary border-transparent",
    warning: "bg-[color-mix(in_srgb,var(--warning)_18%,var(--bg-elevated))] text-text-primary border-transparent",
  };
  const dots: Record<string, string> = {
    neutral: "bg-text-muted",
    accent: "bg-accent",
    success: "bg-success",
    warning: "bg-warning",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.08em]",
        tones[tone],
        className,
      )}
    >
      {tone !== "neutral" ? <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", dots[tone])} /> : null}
      {children}
    </span>
  );
}

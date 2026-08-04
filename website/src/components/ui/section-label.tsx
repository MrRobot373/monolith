import { cn } from "@/lib/utils";

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.14em] text-text-muted",
        className,
      )}
    >
      <span aria-hidden className="h-[6px] w-[6px] rounded-full bg-accent" />
      {children}
    </span>
  );
}

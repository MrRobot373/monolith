import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-6 w-6", className)}
      aria-hidden
    >
      <rect x="2" y="12" width="6" height="14" rx="1.5" fill="currentColor" opacity="0.55" />
      <rect x="11" y="4" width="6" height="22" rx="1.5" fill="currentColor" />
      <rect x="20" y="9" width="6" height="17" rx="1.5" fill="currentColor" opacity="0.8" />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-text-primary", className)}>
      <LogoMark className={cn("text-accent", markClassName)} />
      <span className="font-display text-[19px] tracking-[0.01em]">MONOLITH</span>
    </span>
  );
}

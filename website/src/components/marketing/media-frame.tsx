import { cn } from "@/lib/utils";

export function MediaFrame({
  label,
  children,
  className,
  tone = "light",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  tone?: "light" | "dark";
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[20px] border shadow-[0_30px_70px_-30px_rgba(23,21,18,0.35)]",
        tone === "dark" ? "border-white/10 bg-[#171512]" : "border-border-soft bg-bg-elevated",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 border-b px-4 py-2.5",
          tone === "dark" ? "border-white/10" : "border-border-soft",
        )}
      >
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-[#e57d58]/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#e7b95a]/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#557a57]/70" />
        </span>
        <span
          className={cn(
            "ml-2 truncate font-mono text-[11px] tracking-tight",
            tone === "dark" ? "text-[#8f877d]" : "text-text-muted",
          )}
        >
          {label}
        </span>
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}

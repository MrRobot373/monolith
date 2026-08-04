import { cn } from "@/lib/utils";

export function Container({
  className,
  children,
  wide,
}: {
  className?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={cn("mx-auto w-full px-6 md:px-10", wide ? "max-w-[1400px]" : "max-w-[1180px]", className)}>
      {children}
    </div>
  );
}

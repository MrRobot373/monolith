import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type ButtonBaseProps = {
  variant?: "solid" | "outline" | "ghost";
  size?: "md" | "lg";
  showArrow?: boolean;
  className?: string;
  children: React.ReactNode;
};

const base =
  "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<NonNullable<ButtonBaseProps["variant"]>, string> = {
  solid:
    "bg-accent text-on-accent hover:bg-accent-hover rounded-[12px] shadow-[0_1px_0_rgba(0,0,0,0.08)]",
  outline:
    "border border-border-strong text-text-primary hover:border-accent hover:text-accent rounded-[12px] bg-transparent",
  ghost: "text-text-secondary hover:text-text-primary rounded-[10px]",
};

const sizes: Record<NonNullable<ButtonBaseProps["size"]>, string> = {
  md: "text-sm px-5 py-2.5",
  lg: "text-[15px] px-6 py-3.5",
};

export function Button({
  href,
  variant = "solid",
  size = "md",
  showArrow,
  className,
  children,
  onClick,
  type = "button",
}: ButtonBaseProps & { href?: string; onClick?: () => void; type?: "button" | "submit" }) {
  const classes = cn(base, variants[variant], sizes[size], "group", className);

  const content = (
    <>
      {children}
      {showArrow ? (
        <ArrowRight
          size={16}
          strokeWidth={2}
          className="transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1"
        />
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} className={classes}>
      {content}
    </button>
  );
}

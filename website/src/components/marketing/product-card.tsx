import Link from "next/link";
import { ArrowRight, MessageSquare, Bot, Code2 } from "lucide-react";
import type { Product } from "@/content/products";

const icons = { chat: MessageSquare, agent: Bot, code: Code2 };
const colorVar: Record<Product["color"], string> = {
  accent: "var(--accent)",
  success: "var(--success)",
  warning: "var(--warning)",
};

export function ProductCard({ product }: { product: Product }) {
  const Icon = icons[product.slug];
  const accent = colorVar[product.color];

  return (
    <div className="flex flex-col rounded-[22px] border border-border-soft bg-bg-elevated p-7">
      <span
        className="flex h-12 w-12 items-center justify-center rounded-[14px]"
        style={{ background: `color-mix(in srgb, ${accent} 12%, transparent)` }}
      >
        <Icon size={22} strokeWidth={1.4} style={{ color: accent }} />
      </span>
      <h3 className="mt-5 font-display text-[22px] text-text-primary">{product.name}</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-text-secondary">{product.description}</p>
      <ul className="mt-5 flex flex-col gap-2">
        {product.features.slice(0, 3).map((f) => (
          <li key={f.title} className="flex items-start gap-2 text-[13px] text-text-secondary">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-text-muted" />
            {f.title}
          </li>
        ))}
      </ul>
      <div className="mt-6 flex items-center gap-4">
        <Link href={`/product/${product.slug}`} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-text-primary hover:text-accent">
          Learn more <ArrowRight size={14} />
        </Link>
        <Link href="/download" className="text-[13.5px] text-text-secondary hover:text-text-primary">
          Get started
        </Link>
      </div>
    </div>
  );
}

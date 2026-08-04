import type { Feature } from "@/content/products";

export function FeatureGrid({ features, accent = "var(--accent)" }: { features: Feature[]; accent?: string }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {features.map((f) => (
        <div key={f.title} className="rounded-[18px] border border-border-soft bg-bg-elevated p-6">
          <span aria-hidden className="block h-1.5 w-6 rounded-full" style={{ background: accent }} />
          <h3 className="mt-4 text-[16.5px] font-semibold text-text-primary">{f.title}</h3>
          <p className="mt-2 text-[14px] leading-relaxed text-text-secondary">{f.description}</p>
        </div>
      ))}
    </div>
  );
}

import { Check } from "lucide-react";
import { comparisonMatrix, pricingTiers } from "@/content/pricing";

export function FeatureMatrix() {
  return (
    <div className="overflow-x-auto rounded-[18px] border border-border-soft bg-bg-elevated">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="bg-bg-secondary">
            <th className="px-6 py-4 font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">Feature</th>
            {pricingTiers.map((tier) => (
              <th key={tier.slug} className="px-6 py-4 text-center font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">
                {tier.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {comparisonMatrix.rows.map((row) => (
            <tr key={row.feature} className="border-t border-border-soft">
              <td className="px-6 py-4 text-[14px] text-text-secondary">{row.feature}</td>
              {pricingTiers.map((tier) => {
                const key = tier.slug as "self-hosted" | "managed" | "enterprise";
                const included = row[key];
                return (
                  <td key={tier.slug} className="px-6 py-4 text-center">
                    {included ? <Check size={16} className="mx-auto text-accent" /> : <span className="text-text-muted">—</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { Check, Minus } from "lucide-react";

export function ComparisonTable({ rows }: { rows: { label: string; bad: string; good: string }[] }) {
  return (
    <div className="overflow-x-auto rounded-[18px] border border-border-soft bg-bg-elevated">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="bg-bg-secondary">
            <th className="px-6 py-4 font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">&nbsp;</th>
            <th className="px-6 py-4 font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">
              Public AI (ChatGPT, Claude, etc.)
            </th>
            <th className="px-6 py-4 font-mono text-[11px] uppercase tracking-[0.08em] text-accent">MONOLITH</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-border-soft">
              <td className="px-6 py-5 text-[14px] font-medium text-text-secondary">{row.label}</td>
              <td className="px-6 py-5 align-top text-[14px] text-text-muted">
                <span className="flex items-start gap-2">
                  <Minus size={15} className="mt-0.5 shrink-0 text-text-muted" />
                  {row.bad}
                </span>
              </td>
              <td className="px-6 py-5 align-top text-[14px] text-text-primary">
                <span className="flex items-start gap-2">
                  <Check size={15} className="mt-0.5 shrink-0 text-accent" />
                  {row.good}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

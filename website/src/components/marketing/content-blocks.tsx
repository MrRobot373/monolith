import { AlertTriangle, Info } from "lucide-react";
import { CodeBlock } from "@/components/ui/code-block";
import type { ContentBlock } from "@/lib/blocks";
import { cn } from "@/lib/utils";

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function ContentBlocks({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="flex flex-col gap-5">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "p":
            return (
              <p key={i} className="max-w-[68ch] text-[15.5px] leading-relaxed text-text-secondary">
                {block.text}
              </p>
            );
          case "h2":
            return (
              <h2
                id={slugify(block.text)}
                key={i}
                className="mt-6 scroll-mt-28 font-display text-[24px] leading-snug text-text-primary"
              >
                {block.text}
              </h2>
            );
          case "h3":
            return (
              <h3
                id={slugify(block.text)}
                key={i}
                className="mt-4 scroll-mt-28 text-[17px] font-semibold text-text-primary"
              >
                {block.text}
              </h3>
            );
          case "ul":
            return (
              <ul key={i} className="flex max-w-[68ch] flex-col gap-2">
                {block.items.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[14.5px] leading-relaxed text-text-secondary">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-text-muted" />
                    {item}
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="flex max-w-[68ch] flex-col gap-2">
                {block.items.map((item, idx) => (
                  <li key={item} className="flex items-start gap-2.5 text-[14.5px] leading-relaxed text-text-secondary">
                    <span className="font-mono text-[12px] text-text-muted">{idx + 1}.</span>
                    {item}
                  </li>
                ))}
              </ol>
            );
          case "quote":
            return (
              <blockquote key={i} className="max-w-[64ch] border-l-2 border-accent pl-5 font-display text-[19px] italic leading-snug text-text-primary">
                {block.text}
              </blockquote>
            );
          case "code":
            return <CodeBlock key={i} lang={block.lang} code={block.text} />;
          case "callout":
            return (
              <div
                key={i}
                className={cn(
                  "flex max-w-[68ch] items-start gap-3 rounded-[12px] border px-4 py-3.5 text-[13.5px] leading-relaxed",
                  block.tone === "warning"
                    ? "border-warning/30 bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] text-text-primary"
                    : "border-accent/25 bg-accent-soft/40 text-text-primary",
                )}
              >
                {block.tone === "warning" ? (
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" />
                ) : (
                  <Info size={16} className="mt-0.5 shrink-0 text-accent" />
                )}
                {block.text}
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

export function extractHeadings(blocks: ContentBlock[]) {
  return blocks
    .filter((b): b is Extract<ContentBlock, { type: "h2" | "h3" }> => b.type === "h2" || b.type === "h3")
    .map((b) => ({ text: b.text, level: b.type, id: slugify(b.text) }));
}

import { CopyButton } from "./copy-button";

export function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-black/20 bg-[#171512] text-[#f5f0e7] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#8f877d]">
          {lang ?? "shell"}
        </span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto px-4 py-4 text-[13.5px] leading-relaxed">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}

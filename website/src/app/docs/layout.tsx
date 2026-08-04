import Link from "next/link";
import { DocsSearch } from "@/components/docs/docs-search";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-border-soft">
      <div className="sticky top-[64px] z-20 border-b border-border-soft bg-bg-primary/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-3 md:px-10">
          <div className="flex items-center gap-3">
            <Link href="/docs" className="font-mono text-[12px] uppercase tracking-[0.1em] text-text-primary">
              Docs
            </Link>
          </div>
          <DocsSearch />
        </div>
      </div>
      {children}
    </div>
  );
}

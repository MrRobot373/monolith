"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { docsCategories, docsPages } from "@/content/docs";
import { cn } from "@/lib/utils";

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <nav aria-label="Documentation" className="flex flex-col gap-6">
      {docsCategories.map((cat) => {
        const pages = docsPages.filter((p) => p.category === cat);
        if (!pages.length) return null;
        return (
          <div key={cat}>
            <h3 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-muted">{cat}</h3>
            <ul className="mt-2 flex flex-col gap-0.5">
              {pages.map((p) => {
                const href = `/docs/${p.slug}`;
                const active = pathname === href;
                return (
                  <li key={p.slug}>
                    <Link
                      href={href}
                      className={cn(
                        "block rounded-[8px] px-2.5 py-1.5 text-[13.5px] transition-colors",
                        active ? "bg-accent-soft font-medium text-accent-hover" : "text-text-secondary hover:bg-bg-secondary",
                      )}
                    >
                      {p.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

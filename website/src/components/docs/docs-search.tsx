"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import Fuse from "fuse.js";
import { Search, X } from "lucide-react";
import { docsPages } from "@/content/docs";

export function DocsSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const fuse = useMemo(
    () =>
      new Fuse(docsPages, {
        keys: ["title", "description", "category"],
        threshold: 0.35,
      }),
    [],
  );

  const results = query ? fuse.search(query).slice(0, 8).map((r) => r.item) : docsPages.slice(0, 8);

  function go(slug: string) {
    setOpen(false);
    setQuery("");
    router.push(`/docs/${slug}`);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="flex w-full max-w-[280px] items-center gap-2 rounded-[10px] border border-border-soft bg-bg-primary px-3.5 py-2 text-[13px] text-text-muted transition-colors hover:border-border-strong"
        >
          <Search size={14} />
          Search docs
          <kbd className="ml-auto rounded-[5px] border border-border-soft bg-bg-secondary px-1.5 py-0.5 font-mono text-[10.5px]">Ctrl K</kbd>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className="fixed left-1/2 top-[14vh] z-50 w-[min(92vw,560px)] -translate-x-1/2 overflow-hidden rounded-[18px] border border-border-soft bg-bg-elevated shadow-2xl focus:outline-none"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Search documentation</Dialog.Title>
          <div className="flex items-center gap-2.5 border-b border-border-soft px-4 py-3.5">
            <Search size={16} className="text-text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search docs…"
              className="w-full bg-transparent text-[15px] text-text-primary outline-none placeholder:text-text-muted"
            />
            <Dialog.Close asChild>
              <button aria-label="Close search" className="text-text-muted hover:text-text-primary">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>
          <div className="max-h-[50vh] overflow-y-auto p-2">
            {results.length === 0 ? (
              <p className="px-3 py-6 text-center text-[13.5px] text-text-muted">No results.</p>
            ) : (
              results.map((r) => (
                <button
                  key={r.slug}
                  onClick={() => go(r.slug)}
                  className="flex w-full flex-col items-start rounded-[10px] px-3 py-2.5 text-left hover:bg-bg-secondary"
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-accent">{r.category}</span>
                  <span className="text-[14px] font-medium text-text-primary">{r.title}</span>
                  <span className="text-[12.5px] text-text-muted">{r.description}</span>
                </button>
              ))
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

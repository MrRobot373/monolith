"use client";

import { useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronDown, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MegaMenuItem } from "./mega-menu";

function MobileGroup({
  title,
  items,
  open,
  onToggle,
}: {
  title: string;
  items: MegaMenuItem[];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-border-soft py-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-3 text-left text-[17px] font-medium text-text-primary"
      >
        {title}
        <ChevronDown size={18} className={cn("transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="flex flex-col gap-1 pb-3">
          {items.map((item) => (
            <Dialog.Close asChild key={item.href}>
              <Link href={item.href} className="rounded-[10px] px-2 py-2.5 text-[15px] text-text-secondary hover:bg-bg-secondary">
                {item.label}
              </Link>
            </Dialog.Close>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function MobileMenu({
  open,
  onOpenChange,
  productItems,
  resourcesItems,
  navLinks,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productItems: MegaMenuItem[];
  resourcesItems: MegaMenuItem[];
  navLinks: { label: string; href: string }[];
}) {
  const [expanded, setExpanded] = useState<string | null>("product");

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 data-[state=open]:animate-[fadeIn_0.24s_ease] lg:hidden" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col bg-bg-primary p-6 shadow-2xl focus:outline-none lg:hidden"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between">
            <Dialog.Title asChild>
              <Link href="/" onClick={() => onOpenChange(false)}>
                <Logo />
              </Link>
            </Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" aria-label="Close menu" className="rounded-full p-2 text-text-secondary hover:text-text-primary">
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-6 flex-1 overflow-y-auto">
            <MobileGroup
              title="Product"
              items={productItems}
              open={expanded === "product"}
              onToggle={() => setExpanded((e) => (e === "product" ? null : "product"))}
            />
            <div className="border-b border-border-soft py-2">
              {navLinks.map((link) => (
                <Dialog.Close asChild key={link.href}>
                  <Link href={link.href} className="block py-3 text-[17px] font-medium text-text-primary">
                    {link.label}
                  </Link>
                </Dialog.Close>
              ))}
            </div>
            <MobileGroup
              title="Resources"
              items={resourcesItems}
              open={expanded === "resources"}
              onToggle={() => setExpanded((e) => (e === "resources" ? null : "resources"))}
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-border-soft pt-5">
            <Button href="/app" variant="outline" className="w-full justify-center">
              Try the demo
            </Button>
            <Button href="/download" className="w-full justify-center">
              Get started
            </Button>
            <div className="flex justify-center gap-4 pt-2 text-[12px] text-text-muted">
              <Link href="/legal/privacy">Privacy</Link>
              <Link href="/legal/terms">Terms</Link>
              <Link href="/security">Security</Link>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

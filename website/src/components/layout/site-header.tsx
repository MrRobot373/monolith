"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { MegaMenuPanel, type MegaMenuItem } from "./mega-menu";
import { MobileMenu } from "./mobile-menu";
import { cn } from "@/lib/utils";

const productItems: MegaMenuItem[] = [
  { label: "Overview", href: "/product", description: "One platform, three ways your team already works.", eyebrow: "Start here" },
  { label: "Chat", href: "/product/chat", description: "A private assistant grounded in your own knowledge." },
  { label: "Agent", href: "/product/agent", description: "Multi-step work, including fully scheduled runs." },
  { label: "Code", href: "/product/code", description: "A coding agent that ships in your real repos." },
];

const resourcesItems: MegaMenuItem[] = [
  { label: "Documentation", href: "/docs", description: "Setup, architecture, and reference for every capability." },
  { label: "Blog", href: "/blog", description: "Notes on how the platform is actually built." },
  { label: "Changelog", href: "/changelog", description: "What shipped, and when." },
  { label: "Security", href: "/security", description: "What's real today, and what isn't built yet." },
];

const navLinks = [
  { label: "Deployment", href: "/deployment" },
  { label: "Use cases", href: "/use-cases" },
  { label: "Pricing", href: "/pricing" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [openMenu, setOpenMenu] = useState<"product" | "resources" | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 28);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    // Route change is an external signal this component must react to by
    // resetting transient UI state — not derivable during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenMenu(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenMenu(null);
    }
    function onClick(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) setOpenMenu(null);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header
        ref={headerRef}
        className={cn(
          "sticky top-0 z-40 w-full transition-[background-color,backdrop-filter,box-shadow,padding] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          scrolled
            ? "border-b border-border-soft bg-bg-primary/85 py-2.5 shadow-[0_1px_0_rgba(0,0,0,0.02)] backdrop-blur-md"
            : "border-b border-transparent bg-transparent py-4",
        )}
      >
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 md:px-10">
          <Link href="/" aria-label="MONOLITH home">
            <Logo />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
            <div
              className="relative"
              onMouseEnter={() => setOpenMenu("product")}
              onMouseLeave={() => setOpenMenu((m) => (m === "product" ? null : m))}
            >
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={openMenu === "product"}
                onClick={() => setOpenMenu((m) => (m === "product" ? null : "product"))}
                className="flex items-center gap-1 rounded-full px-4 py-2 text-[14px] text-text-secondary transition-colors hover:text-text-primary"
              >
                Product
                <ChevronDown size={14} className={cn("transition-transform", openMenu === "product" && "rotate-180")} />
              </button>
              <MegaMenuPanel
                open={openMenu === "product"}
                items={productItems}
                featured={{ label: "See the full product overview", href: "/product" }}
              />
            </div>

            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full px-4 py-2 text-[14px] text-text-secondary transition-colors hover:text-text-primary"
              >
                {link.label}
              </Link>
            ))}

            <div
              className="relative"
              onMouseEnter={() => setOpenMenu("resources")}
              onMouseLeave={() => setOpenMenu((m) => (m === "resources" ? null : m))}
            >
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={openMenu === "resources"}
                onClick={() => setOpenMenu((m) => (m === "resources" ? null : "resources"))}
                className="flex items-center gap-1 rounded-full px-4 py-2 text-[14px] text-text-secondary transition-colors hover:text-text-primary"
              >
                Resources
                <ChevronDown size={14} className={cn("transition-transform", openMenu === "resources" && "rotate-180")} />
              </button>
              <MegaMenuPanel open={openMenu === "resources"} items={resourcesItems} />
            </div>
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden lg:block">
              <ThemeToggle />
            </div>
            <Link
              href="/app"
              className="hidden rounded-full px-4 py-2 text-[14px] text-text-secondary transition-colors hover:text-text-primary md:inline-block"
            >
              Try the demo
            </Link>
            <div className="hidden sm:block">
              <Button href="/download" size="md">
                Get started
              </Button>
            </div>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-text-primary lg:hidden"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>
      <MobileMenu
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        productItems={productItems}
        resourcesItems={resourcesItems}
        navLinks={navLinks}
      />
    </>
  );
}

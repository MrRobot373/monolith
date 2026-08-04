import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { footerLinks, site } from "@/content/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-border-soft bg-bg-secondary">
      <Container className="flex flex-col gap-6 border-b border-border-soft py-12 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-[26px] text-text-primary text-balance">
            Bring AI in-house without giving up control.
          </h2>
          <p className="mt-1.5 text-[15px] text-text-secondary">Deploy on your infrastructure, or ours.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button href="/download" showArrow>
            Get started
          </Button>
          <Button href="/docs" variant="outline">
            Read the docs
          </Button>
        </div>
      </Container>

      <Container className="grid grid-cols-2 gap-10 py-14 sm:grid-cols-3 md:grid-cols-5">
        <div className="col-span-2 sm:col-span-3 md:col-span-1">
          <Logo />
          <p className="mt-4 max-w-[26ch] text-[13.5px] leading-relaxed text-text-secondary">{site.tagline}</p>
        </div>
        {Object.entries(footerLinks).map(([group, links]) => (
          <div key={group}>
            <h3 className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-muted">{group}</h3>
            <ul className="mt-4 flex flex-col gap-2.5">
              {links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-[13.5px] text-text-secondary transition-colors hover:text-text-primary">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>

      <Container className="flex flex-col gap-3 border-t border-border-soft py-6 text-[12.5px] text-text-muted sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono">
          © {new Date().getFullYear()} {site.company}. MONOLITH is a product of {site.company}.
        </p>
        <div className="flex gap-5">
          <Link href="/legal/privacy" className="hover:text-text-secondary">
            Privacy
          </Link>
          <Link href="/legal/terms" className="hover:text-text-secondary">
            Terms
          </Link>
          <Link href="/security" className="hover:text-text-secondary">
            Security
          </Link>
        </div>
      </Container>
    </footer>
  );
}

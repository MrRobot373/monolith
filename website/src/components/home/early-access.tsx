import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

export function EarlyAccess() {
  return (
    <section className="border-t border-border-soft py-20">
      <Container className="flex flex-col items-center gap-5 text-center">
        <span className="rounded-full border border-border-soft bg-bg-secondary px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-text-muted">
          Early access
        </span>
        <p className="max-w-[52ch] text-balance font-display text-[22px] leading-snug text-text-primary md:text-[26px]">
          MONOLITH is in active development. We&apos;re working directly with early deployments to
          shape what ships next — no invented customer logos here, just an open invitation.
        </p>
        <Button href="/pricing" variant="outline" showArrow>
          Become a design partner
        </Button>
      </Container>
    </section>
  );
}

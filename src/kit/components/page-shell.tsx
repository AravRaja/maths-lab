import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Page shell: phone-first column, wide Archivo hero, numbered sections.
 *
 *   <PageShell title="Policy Gradient" tagline="..." eyebrow="Lab 03" visual={<MyCanvas />}>
 *     <Section index={1} title="Train">...</Section>
 *   </PageShell>
 */
export function PageShell({
  title,
  tagline,
  eyebrow,
  visual,
  actions,
  nav,
  children,
  footer,
  className,
}: {
  /** Slim bar above the hero (the project pages use it for the maths-lab breadcrumb). */
  nav?: ReactNode;
  title: ReactNode;
  tagline?: ReactNode;
  eyebrow?: ReactNode;
  /** The signature visual. Rendered full-bleed behind/under the hero title. */
  visual?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 pb-16 sm:px-6", className)}>
      {nav}
      <Hero title={title} tagline={tagline} eyebrow={eyebrow} visual={visual} actions={actions} compact={!!nav} />
      <main className="flex flex-col gap-12">{children}</main>
      <footer className="mt-16 border-t border-rule pt-6 type-narrow text-sm text-ink-soft">
        {footer ?? "Scaffolding by Claude Code. The maths is mine."}
      </footer>
    </div>
  );
}

export function Hero({
  title,
  tagline,
  eyebrow,
  visual,
  actions,
  compact,
}: {
  /** Less top padding, for when a nav bar sits above. */
  compact?: boolean;
  title: ReactNode;
  tagline?: ReactNode;
  eyebrow?: ReactNode;
  visual?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className={cn("relative pb-10", compact ? "pt-2" : "pt-[max(env(safe-area-inset-top),2.5rem)]")}>
      {visual && (
        <div className="relative -mx-4 mb-6 aspect-[4/3] overflow-hidden border-y border-rule sm:mx-0 sm:aspect-[16/9] sm:rounded-2xl sm:border">
          {visual}
        </div>
      )}
      {eyebrow && <p className="type-narrow mb-3 text-xs tracking-[0.2em] text-ink-soft uppercase">{eyebrow}</p>}
      <h1 className="type-wide text-[clamp(2.6rem,11vw,5.5rem)] leading-[0.9] break-words uppercase">{title}</h1>
      {tagline && <p className="mt-4 max-w-xl text-lg leading-snug text-ink-soft">{tagline}</p>}
      {actions && <div className="mt-6 flex flex-wrap gap-3">{actions}</div>}
    </header>
  );
}

export function Section({
  id,
  index,
  title,
  kicker,
  children,
  className,
}: {
  id?: string;
  /** Shown as a big outlined number, e.g. 01. */
  index?: number;
  title: ReactNode;
  kicker?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-6", className)}>
      <div className="mb-5 flex items-end gap-4 border-b border-rule pb-3">
        {index !== undefined && (
          <span
            aria-hidden
            className="type-wide text-5xl leading-none text-transparent [-webkit-text-stroke:1px_var(--ink-soft)]"
          >
            {String(index).padStart(2, "0")}
          </span>
        )}
        <div className="min-w-0">
          {kicker && <p className="type-narrow text-xs tracking-[0.18em] text-ink-soft uppercase">{kicker}</p>}
          <h2 className="type-semi text-2xl leading-tight">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

/** A bordered sheet: the default container for demos and controls. */
export function Sheet({ children, className }: { children?: ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-rule bg-sheet p-4 sm:p-5", className)}>{children}</div>;
}

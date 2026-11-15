import type { ReactNode } from "react";
import { PenLine } from "lucide-react";
import { InlineCode } from "@/components/spectrumui/inline-code";
import { milestoneHref } from "@/kit/cores";
import { cn } from "@/lib/utils";

/**
 * The panel shown wherever a maths core is still a stub.
 * Pass `children` to render a ghosted preview of what will appear (it is dimmed and hatched).
 */
export function YoursToWrite({
  file,
  fn,
  milestone,
  summary,
  children,
  className,
}: {
  file: string;
  fn: string;
  milestone?: string;
  summary?: ReactNode;
  /** Ghost preview: a placeholder visual of what this core will unlock. */
  children?: ReactNode;
  className?: string;
}) {
  const href = milestoneHref(milestone, file);
  return (
    // Ghost and text share one grid cell, so whichever is taller sets the height (nothing clips).
    <div className={cn("relative grid overflow-hidden rounded-2xl border border-dashed border-ink-soft/50 bg-paper", className)}>
      {children && (
        <div aria-hidden className="pointer-events-none [grid-area:1/1] select-none opacity-25 blur-[1px]">
          {children}
        </div>
      )}
      <div
        className={cn(
          "flex flex-col gap-3 p-5 [grid-area:1/1]",
          children && "justify-end bg-gradient-to-t from-paper via-paper/85 to-paper/30 pt-16",
        )}
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex size-7 items-center justify-center rounded-full bg-ink text-paper">
            <PenLine className="size-3.5" />
          </span>
          <span className="type-narrow text-xs tracking-[0.2em] uppercase">Yours to write</span>
        </div>
        <p className="type-semi text-xl leading-tight break-words">
          <code className="font-mono text-[0.9em]">{fn}()</code>
        </p>
        {summary && <p className="text-sm leading-snug text-ink-soft">{summary}</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <InlineCode className="rounded-lg border border-rule bg-sheet px-2 py-1 text-xs font-normal break-all">{file}</InlineCode>
          {href && (
            <a
              href={href}
              className="inline-flex min-h-11 items-center underline decoration-ink-soft underline-offset-4 hover:decoration-ink"
            >
              LEARNING.md, {milestone}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/** Hatched placeholder block with a label, for ghost previews. */
export function Ghost({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center rounded-xl border border-rule bg-hatch text-ink-soft", className)}>
      {label && <span className="type-narrow text-xs tracking-[0.2em] uppercase">{label}</span>}
    </div>
  );
}

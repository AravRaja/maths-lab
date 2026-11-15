"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Pill radio group: 44px targets, ink when selected. */
export function Pills<T extends string | number>({
  value,
  options,
  onChange,
  label,
  render,
  className,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  label: string;
  render?: (v: T) => ReactNode;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          role="radio"
          aria-checked={o === value}
          onClick={() => onChange(o)}
          className={cn(
            "type-narrow min-h-11 min-w-11 rounded-xl border px-3 text-sm tracking-wide transition-colors",
            o === value ? "border-ink bg-ink text-paper" : "border-rule text-ink-soft hover:text-ink",
          )}
        >
          {render ? render(o) : String(o)}
        </button>
      ))}
    </div>
  );
}

/** Small-caps label with a mono readout on the right. */
export function Field({ label, value, children, className }: { label: string; value?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="flex items-baseline justify-between gap-3">
        <span className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">{label}</span>
        {value !== undefined && <span className="font-mono text-xs tabular-nums">{value}</span>}
      </p>
      {children}
    </div>
  );
}

export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase", className)}>{children}</p>;
}

/** A small readout tile (for numbers that need decimals or a dash). */
export function Readout({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-2xl border border-rule bg-sheet p-3 sm:p-4", className)}>
      <Kicker>{label}</Kicker>
      <p className="type-wide mt-1 truncate text-xl leading-tight tabular-nums sm:text-3xl">{value}</p>
      {sub && <p className="mt-1 truncate text-xs text-ink-soft">{sub}</p>}
    </div>
  );
}

/** "Lights up at M3" chip for features waiting on a later milestone. */
export function Waiting({ children }: { children: ReactNode }) {
  return (
    <span className="type-narrow inline-flex items-center gap-2 rounded-full border border-dashed border-rule px-3 py-1 text-xs tracking-[0.15em] text-ink-soft uppercase">
      <span className="size-1.5 rounded-full bg-ink-soft" aria-hidden />
      {children}
    </span>
  );
}

export function sliderValue(v: number | readonly number[]): number {
  return Array.isArray(v) ? (v as number[])[0] : (v as number);
}

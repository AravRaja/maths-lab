"use client";

import type { ReactNode } from "react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

/** Label + slider + live value. 44px tall control (the kit's slider). */
export function LabeledSlider({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  format = (v) => v.toFixed(2),
  className,
}: {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-0.5", className)}>
      <span className="flex items-baseline justify-between gap-3">
        <span className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">{label}</span>
        <span className="font-mono text-sm tabular-nums">{format(value)}</span>
      </span>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)} />
    </label>
  );
}

/** Small key/value readout tile. */
export function Readout({ label, value, sub, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-xl border border-rule bg-paper px-3 py-2", className)}>
      <p className="type-narrow truncate text-[0.65rem] tracking-[0.2em] text-ink-soft uppercase">{label}</p>
      <p className="type-wide truncate text-lg leading-tight tabular-nums">{value}</p>
      {sub && <p className="truncate font-mono text-[0.65rem] text-ink-soft">{sub}</p>}
    </div>
  );
}

/** A matrix as a grid of mono numbers, with bracket rules. */
export function MatrixGrid({ M, digits = 2, label, className }: { M: number[][]; digits?: number; label?: ReactNode; className?: string }) {
  const cols = M[0]?.length ?? 0;
  return (
    <figure className={cn("min-w-0", className)}>
      {label && <figcaption className="type-narrow mb-1 text-[0.65rem] tracking-[0.2em] text-ink-soft uppercase">{label}</figcaption>}
      <div className="relative overflow-x-auto px-2">
        <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 rounded-l border-y border-l border-ink-soft" />
        <span aria-hidden className="absolute inset-y-0 right-0 w-1.5 rounded-r border-y border-r border-ink-soft" />
        <div className="grid gap-x-2 py-1 font-mono text-[0.7rem] leading-5 tabular-nums" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {M.flatMap((row, i) =>
            row.map((v, j) => (
              <span key={`${i}-${j}`} className={cn("text-right", Math.abs(v) < 0.5 * 10 ** -digits && "text-ink-soft")}>
                {fmt(v, digits)}
              </span>
            )),
          )}
        </div>
      </div>
    </figure>
  );
}

function fmt(v: number, d: number) {
  if (!Number.isFinite(v)) return "∞";
  const s = v.toFixed(d);
  return s === `-${(0).toFixed(d)}` ? (0).toFixed(d) : s;
}

/** Pill-style segmented control (44px). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" className={cn("flex flex-wrap gap-1 rounded-xl border border-rule bg-paper p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "type-narrow min-h-11 min-w-11 flex-1 rounded-lg px-3 text-xs tracking-[0.15em] uppercase transition-colors",
            value === o.value ? "bg-ink text-paper" : "text-ink-soft hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A "predict before you look" prompt. */
export function Predict({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 rounded-xl border border-dashed border-rule px-4 py-3 text-sm leading-snug text-ink-soft">
      <span className="type-narrow mr-2 text-xs tracking-[0.2em] text-ink uppercase">Predict</span>
      {children}
    </p>
  );
}

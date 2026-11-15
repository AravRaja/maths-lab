"use client";

import type { ReactNode } from "react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

/** Segmented pill radio group, 44px targets. */
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

/** Labelled slider with a mono readout. */
export function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = (v) => v.toFixed(2),
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="flex items-baseline justify-between gap-3">
        {/* Greek symbols must not be upper-cased (σ would become Σ). */}
        <span className={cn("type-narrow text-xs text-ink-soft", /[\u0370-\u03ff]/.test(label) ? "font-mono" : "tracking-[0.2em] uppercase")}>{label}</span>
        <span className="font-mono text-xs tabular-nums">{format(value)}</span>
      </p>
      <Slider
        aria-label={label}
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
      />
    </div>
  );
}

/** Small label + big mono number, for dense readout rows. */
export function Readout({ label, value, sub, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-xl border border-rule bg-paper px-3 py-2.5", className)}>
      <p className="type-narrow truncate text-[11px] tracking-[0.2em] text-ink-soft uppercase">{label}</p>
      <p className="type-wide mt-1 truncate text-xl leading-none tabular-nums">{value}</p>
      {sub && <p className="mt-1 truncate font-mono text-[11px] text-ink-soft">{sub}</p>}
    </div>
  );
}

/** A plain button in the house style (for when shadcn Button's sizes are too small). */
export function Action({
  children,
  onClick,
  primary,
  disabled,
  className,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "type-semi inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm transition-colors select-none disabled:opacity-40",
        primary ? "border-ink bg-ink text-paper hover:bg-ink/85" : "border-rule bg-sheet text-ink hover:border-ink-soft",
        className,
      )}
    >
      {children}
    </button>
  );
}

export const fmt = (v: number | null | undefined, d = 3) => (v === null || v === undefined || !Number.isFinite(v) ? "–" : v.toFixed(d));

/** Compact scientific-ish format for tiny probabilities. */
export const fmtSmall = (v: number | null | undefined) => {
  if (v === null || v === undefined || !Number.isFinite(v)) return "–";
  if (v !== 0 && Math.abs(v) < 1e-3) return v.toExponential(2);
  return v.toFixed(4);
};

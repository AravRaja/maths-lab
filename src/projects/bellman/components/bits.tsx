"use client";

import { useMemo, useSyncExternalStore, type ReactNode } from "react";
import { Check, PenLine } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { milestoneHref, probeCore } from "@/kit/cores";
import { cn } from "@/lib/utils";
import { CORES } from "../core";

const noop = () => () => {};

/** Client-only render (numbers from cores can differ in their last digits between Node and the browser). */
export function ClientOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const client = useSyncExternalStore(noop, () => true, () => false);
  return client ? children : (fallback ?? null);
}

/** Which of this project's cores are written, by function name. null before hydration. */
export function useWritten(): Record<string, boolean> | null {
  const probed = useMemo(() => Object.fromEntries(CORES.map((c) => [c.fn, probeCore(c).state === "done"])), []);
  return useSyncExternalStore(noop, () => probed, () => null);
}

/** A square-ish toggle chip, 44px tall. */
export function Chip({
  active, onClick, children, disabled, className, label,
}: { active?: boolean; onClick?: () => void; children: ReactNode; disabled?: boolean; className?: string; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "type-narrow inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs tracking-[0.16em] uppercase transition-colors disabled:opacity-40",
        active ? "border-ink bg-ink text-paper" : "border-rule bg-sheet text-ink hover:border-ink-soft",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Slider with a narrow label and a live readout. */
export function Knob({
  label, value, min, max, step, onChange, format = (v) => v.toFixed(2),
}: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between gap-2">
        <span className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">{lc(label)}</span>
        <span className="type-wide text-sm tabular-nums">{format(value)}</span>
      </span>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
        aria-label={label}
      />
    </label>
  );
}

/** "What each core switches on in this section": a checklist with milestone links. */
export function Unlocks({ items, className }: { items: { fn: string; what: string }[]; className?: string }) {
  const written = useWritten();
  return (
    <ul className={cn("flex flex-col divide-y divide-rule rounded-2xl border border-rule bg-sheet px-4", className)}>
      {items.map(({ fn, what }) => {
        const spec = CORES.find((c) => c.fn === fn);
        const ok = written?.[fn];
        const href = spec ? milestoneHref(spec.milestone, spec.file) : undefined;
        return (
          <li key={fn} className="flex min-h-11 items-center gap-3 py-2">
            <span
              className={cn(
                "inline-flex size-6 shrink-0 items-center justify-center rounded-full border",
                ok ? "border-ink bg-ink text-paper" : "border-dashed border-ink-soft text-ink-soft",
              )}
              aria-label={ok ? "written" : "yours to write"}
            >
              {ok ? <Check className="size-3.5" /> : <PenLine className="size-3" />}
            </span>
            <span className="min-w-0 flex-1">
              <code className="font-mono text-sm">{fn}()</code>
              <span className="block text-xs leading-snug text-ink-soft">{what}</span>
            </span>
            {href && !ok && (
              <a href={href} className="type-narrow inline-flex min-h-11 shrink-0 items-center text-xs text-ink-soft underline underline-offset-4">
                {spec?.milestone}
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Tiny label/value readout for inside sheets. */
export function Readout({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-rule bg-paper px-3 py-2", className)}>
      <p className="type-narrow text-[10px] tracking-[0.2em] text-ink-soft uppercase">{lc(label)}</p>
      <p className="type-wide mt-0.5 text-lg leading-none tabular-nums">{value}</p>
    </div>
  );
}

/** Keep Greek letters lower-case inside `uppercase` labels (ε would otherwise render as Ε). */
export function lc(text: string): ReactNode {
  const parts = text.split(/([\u0370-\u03ff])/);
  return parts.length === 1 ? text : parts.map((p, i) => (i % 2 ? <span key={i} className="normal-case">{p}</span> : p));
}

export const fmt = (v: number | null | undefined, d = 3) => (v == null || !isFinite(v) ? "–" : Math.abs(v) < 1e-3 && v !== 0 ? v.toExponential(1) : v.toFixed(d));

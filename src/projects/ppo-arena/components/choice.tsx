"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/** Segmented single choice built on the shadcn ToggleGroup, black and white, 44px tall. */
export function Choice<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(v: unknown[]) => onChange((v[0] as T | undefined) ?? value)}
      variant="outline"
      spacing={0}
      aria-label={label}
      className={cn("w-full sm:w-auto", className)}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className="h-11 flex-1 px-3 text-sm aria-pressed:bg-ink aria-pressed:text-paper data-pressed:bg-ink data-pressed:text-paper sm:flex-none"
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** Label + big number + slider row. */
export function Knob({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="type-narrow text-sm text-ink-soft">{label}</span>
        <span className="type-wide text-xl tabular-nums">{value}</span>
      </div>
      {children}
    </div>
  );
}

export function num(v: number | readonly number[]): number {
  return typeof v === "number" ? v : v[0];
}

/** Small labelled number tile. */
export function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-rule bg-sheet p-3">
      <p className="type-narrow text-xs text-ink-soft">{label}</p>
      <p className="type-wide mt-1 text-2xl leading-none tabular-nums">{value}</p>
    </div>
  );
}

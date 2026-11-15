"use client";

import { NumberTicker } from "@/components/motion/number-ticker";
import { cn } from "@/lib/utils";

/** Big wide number with a narrow label. Uses Spectrum's rolling NumberTicker for integers. */
export function Stat({
  label,
  value,
  decimals = 0,
  suffix,
  className,
}: {
  label: string;
  value: number;
  /** >0 shows a fixed-point readout instead of the rolling ticker. */
  decimals?: number;
  suffix?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-rule bg-sheet p-4", className)}>
      <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">{label}</p>
      <p className="type-wide mt-1 text-4xl leading-none tabular-nums">
        {decimals > 0 ? (
          <span>
            {value.toFixed(decimals)}
            {suffix}
          </span>
        ) : (
          <NumberTicker value={value} suffix={suffix} startOnView={false} />
        )}
      </p>
    </div>
  );
}

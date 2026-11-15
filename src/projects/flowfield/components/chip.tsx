"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A 44px pill toggle. Selected = inverted (white on black → black on white). */
export function Chip({
  active,
  onClick,
  children,
  className,
  disabled,
  ariaLabel,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border px-3 text-sm transition-colors disabled:opacity-40",
        active ? "border-ink bg-ink text-paper" : "border-rule bg-sheet text-ink hover:border-ink-soft",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Narrow small-caps label. */
export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase", className)}>{children}</p>;
}

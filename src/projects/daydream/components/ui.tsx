"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { startLoop, type CanvasSize } from "@/kit";
import { cn } from "@/lib/utils";

/** Segmented choice, 44px targets. */
export function Pills<T extends string | number>({
  value,
  options,
  onChange,
  label,
  render,
  disabled,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  label: string;
  render?: (v: T) => ReactNode;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          role="radio"
          aria-checked={o === value}
          disabled={disabled}
          onClick={() => onChange(o)}
          className={cn(
            "type-narrow min-h-11 min-w-11 rounded-xl border px-3 text-sm tracking-wide transition-colors disabled:opacity-40",
            o === value ? "border-ink bg-ink text-paper" : "border-rule text-ink-soft hover:text-ink",
          )}
        >
          {render ? render(o) : String(o)}
        </button>
      ))}
    </div>
  );
}

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

/** A small "KICKER  value" readout. */
export function Readout({ k, v, className }: { k: string; v: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col rounded-xl border border-rule px-3 py-2", className)}>
      <span className="type-narrow truncate text-[10px] tracking-[0.2em] text-ink-soft uppercase">{k}</span>
      <span className="type-wide truncate text-lg leading-tight tabular-nums">{v}</span>
    </div>
  );
}

/**
 * Press-and-hold button: `onHold(true)` on press, `onHold(false)` on release or leave.
 * Space / Enter work too.
 */
export function HoldButton({
  onHold,
  held,
  children,
  className,
  disabled,
  ariaLabel,
}: {
  onHold: (down: boolean) => void;
  held?: boolean;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={held}
      aria-label={ariaLabel}
      disabled={disabled}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onHold(true);
      }}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          onHold(true);
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") onHold(false);
      }}
      onBlur={() => held && onHold(false)}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "type-narrow inline-flex min-h-11 touch-none items-center justify-center gap-2 rounded-xl border px-4 text-sm tracking-wide uppercase transition-colors select-none disabled:opacity-40",
        held ? "border-ink bg-ink text-paper" : "border-rule text-ink hover:border-ink-soft",
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * A canvas driven by a mutable-state loop: `draw` runs every frame with the latest closure.
 * Like the kit's useCanvas, but hands back the size and keeps the loop alive across renders.
 */
/** Size the backing store to the element's layout box (clientWidth, unaffected by CSS transforms). */
export function fitLayout(c: HTMLCanvasElement, ctx: CanvasRenderingContext2D, maxDpr = 2): CanvasSize {
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const width = Math.max(1, c.clientWidth);
  const height = Math.max(1, c.clientHeight);
  const bw = Math.round(width * dpr);
  const bh = Math.round(height * dpr);
  if (c.width !== bw || c.height !== bh) {
    c.width = bw;
    c.height = bh;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width, height, dpr };
}

/**
 * A canvas driven by a mutable-state loop: `draw` runs every frame with the latest closure.
 * Like the kit's useCanvas, but returns a callback ref (so canvases that mount late still start)
 * and pauses while the canvas is off screen, so a long page of live canvases stays smooth.
 */
export function useLoopCanvas(draw: (ctx: CanvasRenderingContext2D, size: CanvasSize, t: number, dt: number) => void, fps = 30) {
  const [el, setEl] = useState<HTMLCanvasElement | null>(null);
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  });
  useEffect(() => {
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { rootMargin: "80px" });
    io.observe(el);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let first = true;
    const loop = startLoop((t, dt) => {
      if (!visible && !first) return;
      first = false;
      const size = fitLayout(el, ctx);
      drawRef.current(ctx, size, t, dt);
    }, reduced ? 4 : fps);
    return () => {
      loop.stop();
      io.disconnect();
    };
  }, [el, fps]);
  return setEl;
}

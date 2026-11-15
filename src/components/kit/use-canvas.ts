"use client";

import { useEffect, useRef } from "react";
import { fitCanvas, startLoop, type CanvasSize } from "@/lib/kit/canvas";

export interface DrawArgs extends CanvasSize {
  ctx: CanvasRenderingContext2D;
  /** Seconds since the loop started (0 for static draws). */
  t: number;
  /** Seconds since the previous frame. */
  dt: number;
  /** Pointer in CSS px relative to the canvas, or null when outside. */
  pointer: { x: number; y: number; down: boolean } | null;
}

export interface UseCanvasOptions {
  /** Run a rAF loop. false = redraw only on resize and when `deps` change. Default true. */
  animate?: boolean;
  /** Cap the frame rate (aura runs at ~28). */
  fps?: number;
  /** Max device pixel ratio. Default 2. */
  maxDpr?: number;
  /** Respect prefers-reduced-motion by drawing a single frame. Default true. */
  respectReducedMotion?: boolean;
}

/**
 * DPR-aware canvas with resize handling, pointer tracking and an animation loop.
 *
 *   const ref = useCanvas(({ ctx, width, height, t }) => { ctx.clearRect(0, 0, width, height); ... });
 *   return <canvas ref={ref} className="h-64 w-full" />;
 *
 * The draw function is read through a ref, so it can close over fresh state without restarting the loop.
 */
export function useCanvas(
  draw: (args: DrawArgs) => void,
  { animate = true, fps, maxDpr = 2, respectReducedMotion = true }: UseCanvasOptions = {},
  deps: unknown[] = [],
) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let size = fitCanvas(canvas, ctx, maxDpr);
    let pointer: DrawArgs["pointer"] = null;
    let lastT = 0;
    const paint = (t: number, dt: number) => {
      lastT = t;
      drawRef.current({ ctx, ...size, t, dt, pointer });
    };

    const ro = new ResizeObserver(() => {
      size = fitCanvas(canvas, ctx, maxDpr);
      paint(lastT, 0);
    });
    ro.observe(canvas);

    const toLocal = (e: PointerEvent, down: boolean) => {
      const r = canvas.getBoundingClientRect();
      pointer = { x: e.clientX - r.left, y: e.clientY - r.top, down };
    };
    const onMove = (e: PointerEvent) => toLocal(e, pointer?.down ?? false);
    const onDown = (e: PointerEvent) => toLocal(e, true);
    const onUp = (e: PointerEvent) => toLocal(e, false);
    const onLeave = () => (pointer = null);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onLeave);

    const reduced = respectReducedMotion && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const loop = animate && !reduced ? startLoop(paint, fps) : null;
    if (!loop) paint(0, 0);

    return () => {
      loop?.stop();
      ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate, fps, maxDpr, respectReducedMotion, ...deps]);

  return ref;
}

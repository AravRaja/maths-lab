"use client";

import { useRef } from "react";
import { useCanvas, type DrawArgs } from "@/kit/components/use-canvas";
import { makeRng } from "@/projects/say-and-reach/lib/arm/rng";
import { randomObjects, type Obj } from "@/projects/say-and-reach/lib/arm/world";
import { cn } from "@/lib/utils";
import { ditherBuf, makeView, type DitherBuf, type View } from "./draw";
import { renderFrame } from "./render";

/**
 * A 4:3 tabletop canvas. Give it `draw` for a custom frame (it gets the view and a dither
 * buffer), or nothing for a still, ghosted table (used as the "Yours to write" preview).
 */
export function TableCanvas({
  draw,
  animate = true,
  className,
  onPointer,
  label,
}: {
  draw?: (a: DrawArgs & { v: View; buf: DitherBuf }) => void;
  animate?: boolean;
  className?: string;
  /** Pointer down / drag on the table, in world coordinates. */
  onPointer?: (world: [number, number], v: View) => void;
  label?: string;
}) {
  const buf = useRef<DitherBuf | null>(null);
  const objs = useRef<Obj[] | null>(null);
  const view = useRef<View | null>(null);
  const ref = useCanvas(
    (a) => {
      const v = makeView(a.width, a.height, 2);
      view.current = v;
      buf.current = ditherBuf(buf.current, a.width, a.height, 3);
      if (draw) draw({ ...a, v, buf: buf.current });
      else {
        objs.current ??= randomObjects(makeRng(4));
        renderFrame(a.ctx, v, buf.current, a.t, null, { objects: objs.current, theta: null });
      }
    },
    { fps: 30, animate },
  );

  const handle = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!onPointer || !view.current) return;
    if (e.type === "pointermove" && e.buttons === 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    const v = view.current;
    onPointer([(e.clientX - r.left - v.ox) / v.s, (v.oy - (e.clientY - r.top)) / v.s], v);
  };

  return (
    <canvas
      ref={ref}
      role={onPointer ? "application" : "img"}
      aria-label={label ?? "Tabletop"}
      onPointerDown={handle}
      onPointerMove={handle}
      className={cn("block aspect-[4/3] w-full touch-none rounded-2xl border border-rule bg-paper", className)}
    />
  );
}

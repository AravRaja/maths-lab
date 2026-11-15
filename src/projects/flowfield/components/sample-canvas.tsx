"use client";

import { useCanvas } from "@/kit/components/use-canvas";
import { grey } from "@/kit/canvas";
import { makeView } from "../lib/view";
import { clear, drawGrid, drawPoints, label, offscreen } from "./draw";
import { cn } from "@/lib/utils";

/**
 * Animates sample paths (P × (S+1) × 2, flat) from noise to sample with trails, then holds.
 * Used for the trained models.
 */
export function SampleCanvas({
  source,
  data,
  caption,
  className,
  period = 2.4,
  small,
}: {
  /** Read every frame, so new samples swap in without a remount. */
  source: () => { flat: Float32Array; P: number; S: number } | null;
  data?: number[][];
  caption?: () => string;
  className?: string;
  period?: number;
  small?: boolean;
}) {
  const ref = useCanvas(
    ({ ctx, width, height, t }) => {
      if (t > 0 && offscreen(ctx)) return;
      const v = makeView(width, height, 2.3, 0);
      clear(ctx, width, height);
      if (!small) drawGrid(ctx, v, width, height);
      if (data) drawPoints(ctx, v, data, small ? 1 : 1.4, grey(1, 0.18));
      const p = source();
      if (p) {
        const cyc = (t % (period + 1.2)) / period;
        const f = Math.min(1, cyc) * p.S;
        const k = Math.min(p.S - 1, Math.floor(f));
        const u = f - k;
        const tail = Math.max(0, k - 5);
        ctx.lineWidth = 1;
        if (!small) {
          ctx.strokeStyle = grey(1, 0.18);
          ctx.beginPath();
          for (let i = 0; i < p.P; i++) {
            const o = i * (p.S + 1);
            ctx.moveTo(v.x(p.flat[(o + tail) * 2]), v.y(p.flat[(o + tail) * 2 + 1]));
            for (let j = tail + 1; j <= k; j++) ctx.lineTo(v.x(p.flat[(o + j) * 2]), v.y(p.flat[(o + j) * 2 + 1]));
          }
          ctx.stroke();
        }
        ctx.fillStyle = grey(1);
        const sz = small ? 1.4 : 2;
        for (let i = 0; i < p.P; i++) {
          const o = (i * (p.S + 1) + k) * 2;
          const x = p.flat[o] + u * (p.flat[o + 2] - p.flat[o]);
          const y = p.flat[o + 1] + u * (p.flat[o + 3] - p.flat[o + 1]);
          ctx.fillRect(v.x(x) - sz / 2, v.y(y) - sz / 2, sz, sz);
        }
        if (!small) label(ctx, `t = ${Math.min(1, cyc).toFixed(2)}`, width - 12, 12, "right", 0.9);
      }
      const c = caption?.();
      if (c) label(ctx, c, 12, 11, "left", 0.85, false);
    },
    { fps: 30 },
    [data, small, period],
  );
  return <canvas ref={ref} aria-hidden className={cn("w-full rounded-xl border border-rule", className)} />;
}

"use client";

import { useRef } from "react";
import { useCanvas } from "@/kit/components/use-canvas";
import { grey } from "@/kit/canvas";
import { ditherField } from "@/kit/dither";
import { cn } from "@/lib/utils";

/**
 * A rollout as a dithered ribbon: one column per step, brightness = `values` (scaled to [0,1]),
 * gaps at episode starts, a scrub line under the pointer. Shared by the M1 and M2 labs.
 */
export function RolloutStrip({
  values,
  starts,
  cursor,
  onCursor,
  overlay,
  label,
  className,
}: {
  values: number[];
  starts: number[];
  cursor: number;
  onCursor: (t: number) => void;
  /** Optional second ribbon drawn as a bright band over the top (e.g. a credit kernel), [0,1] per step. */
  overlay?: number[];
  label: string;
  className?: string;
}) {
  const buf = useRef<{ w: number; h: number; f: Float32Array; img: ImageData; off: OffscreenCanvas } | null>(null);
  const ref = useCanvas(
    ({ ctx, width, height }) => {
      const px = 2;
      const w = Math.max(8, Math.floor(width / px)), h = Math.max(4, Math.floor(height / px));
      if (!buf.current || buf.current.w !== w || buf.current.h !== h) buf.current = { w, h, f: new Float32Array(w * h), img: new ImageData(w, h), off: new OffscreenCanvas(w, h) };
      const b = buf.current;
      const n = values.length || 1;
      let lo = Infinity, hi = -Infinity;
      for (const v of values) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      if (!isFinite(lo)) { lo = 0; hi = 1; }
      const span = hi - lo || 1;
      for (let x = 0; x < w; x++) {
        const t = Math.min(n - 1, Math.floor((x / w) * n));
        const v = values.length ? (values[t] - lo) / span : 0;
        const k = overlay ? overlay[t] ?? 0 : 0;
        for (let y = 0; y < h; y++) {
          const yy = y / h;
          // Bottom band: the values. Top band: the overlay, if any.
          b.f[y * w + x] = overlay ? (yy < 0.42 ? k : yy > 0.5 ? 0.08 + 0.92 * v : 0) : 0.05 + 0.95 * v * (0.75 + 0.25 * yy);
        }
      }
      ditherField(b.f, w, h, b.img.data, [0, 0.3, 0.7, 1]);
      b.off.getContext("2d")!.putImageData(b.img, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(b.off, 0, 0, w * px, h * px);
      ctx.fillStyle = grey(0);
      for (const s of starts) if (s > 0) ctx.fillRect((s / n) * width - 1.5, 0, 3, height);
      const cx = ((cursor + 0.5) / n) * width;
      ctx.fillStyle = grey(1);
      ctx.fillRect(cx - 0.75, 0, 1.5, height);
    },
    { animate: false },
    [values, starts, cursor, overlay],
  );

  const pick = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const n = values.length || 1;
    onCursor(Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left) / r.width) * n))));
  };

  return (
    <canvas
      ref={ref}
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.max(0, values.length - 1)}
      aria-valuenow={cursor}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") onCursor(Math.max(0, cursor - 1));
        if (e.key === "ArrowRight") onCursor(Math.min(values.length - 1, cursor + 1));
      }}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); pick(e); }}
      onPointerMove={(e) => { if (e.buttons) pick(e); }}
      className={cn("block h-16 w-full cursor-ew-resize touch-none rounded-xl border border-rule [image-rendering:pixelated]", className)}
    />
  );
}


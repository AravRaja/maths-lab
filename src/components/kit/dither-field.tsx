"use client";

import { useRef } from "react";
import { useCanvas } from "./use-canvas";
import { ditherField, fbm } from "@/lib/kit/dither";
import { cn } from "@/lib/utils";

/**
 * The kit's signature visual: a domain-warped noise field, Bayer-8 dithered to a few greys,
 * drifting slowly and bulging under the pointer. Pass `field` to dither your own function
 * instead (e.g. a value function, a density, a loss surface): (u, v, t) -> [0,1], u,v in [0,1].
 */
export function DitherField({
  field,
  pixel = 3,
  tones = [0, 0.22, 0.6, 1],
  fps = 24,
  speed = 1,
  className,
}: {
  field?: (u: number, v: number, t: number) => number;
  /** Size of one dither pixel in CSS px. */
  pixel?: number;
  /** Grey levels 0..1, dark to light. */
  tones?: number[];
  fps?: number;
  speed?: number;
  className?: string;
}) {
  const buf = useRef<{ w: number; h: number; f: Float32Array; img: ImageData; off: OffscreenCanvas } | null>(null);
  const bump = useRef({ x: 0.5, y: 0.5, a: 0 });

  const ref = useCanvas(
    ({ ctx, width, height, t, pointer }) => {
      const w = Math.max(8, Math.floor(width / pixel));
      const h = Math.max(8, Math.floor(height / pixel));
      if (!buf.current || buf.current.w !== w || buf.current.h !== h) {
        buf.current = { w, h, f: new Float32Array(w * h), img: new ImageData(w, h), off: new OffscreenCanvas(w, h) };
      }
      const b = buf.current;
      const s = bump.current;
      // Ease the pointer bulge in and out.
      if (pointer) { s.x += (pointer.x / width - s.x) * 0.15; s.y += (pointer.y / height - s.y) * 0.15; }
      s.a += ((pointer ? 1 : 0) - s.a) * 0.08;
      const tt = t * 0.08 * speed;
      const aspect = width / height;
      for (let y = 0; y < h; y++) {
        const v = y / h;
        for (let x = 0; x < w; x++) {
          const u = x / w;
          let val: number;
          if (field) val = field(u, v, t);
          else {
            const nx = u * aspect * 2.2, ny = v * 2.2;
            const qx = fbm(nx + 11.3 + tt, ny + 7.9, 81);
            const qy = fbm(nx + 3.7, ny + 19.1 - tt, 82);
            val = fbm(nx + 2.2 * (qx - 0.5) + tt * 0.6, ny + 2.2 * (qy - 0.5), 60);
            val = (val - 0.25) * 1.9; // stretch contrast
          }
          if (s.a > 0.01) {
            const dx = (u - s.x) * aspect, dy = v - s.y;
            val += s.a * 0.55 * Math.exp(-(dx * dx + dy * dy) * 18);
          }
          b.f[y * w + x] = val;
        }
      }
      ditherField(b.f, w, h, b.img.data, tones);
      b.off.getContext("2d")!.putImageData(b.img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(b.off, 0, 0, w * pixel, h * pixel);
    },
    { fps, maxDpr: 2 },
    [pixel, tones.join(","), speed, field],
  );

  return <canvas ref={ref} aria-hidden className={cn("block h-full w-full touch-none [image-rendering:pixelated]", className)} />;
}

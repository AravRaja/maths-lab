"use client";

import { useEffect, useRef } from "react";
import { useCanvas } from "@/kit/components/use-canvas";
import { grey } from "@/kit/canvas";
import { ditherField, fbm } from "@/kit/dither";
import type { Dataset } from "@/projects/chainrule/lib/engine/data";

const LIM = 1.6;
const TONES = [0.02, 0.1, 0.2, 0.33, 0.48];

/**
 * Decision boundary: the score field tanh(s) dithered to five greys, the s = 0 contour in white,
 * and the data as filled (+1) and hollow (−1) dots. Without a field it shows a drifting ghost.
 */
export function BoundaryCanvas({ data, grid, g }: { data: Dataset; grid: Float32Array | null; g: number }) {
  const gridRef = useRef(grid);
  const dataRef = useRef(data);
  useEffect(() => {
    gridRef.current = grid;
    dataRef.current = data;
  });
  const buf = useRef<{ w: number; h: number; f: Float32Array; img: ImageData; off: OffscreenCanvas } | null>(null);

  const ref = useCanvas(
    ({ ctx, width, height, t }) => {
      const px = 3;
      const w = Math.max(8, Math.floor(width / px)), h = Math.max(8, Math.floor(height / px));
      if (!buf.current || buf.current.w !== w || buf.current.h !== h) buf.current = { w, h, f: new Float32Array(w * h), img: new ImageData(w, h), off: new OffscreenCanvas(w, h) };
      const b = buf.current;
      const G = gridRef.current;
      const sample = (u: number, v: number) => {
        // Bilinear lookup in the g×g score grid.
        const x = u * g - 0.5, y = v * g - 0.5;
        const x0 = Math.max(0, Math.min(g - 1, Math.floor(x))), y0 = Math.max(0, Math.min(g - 1, Math.floor(y)));
        const x1 = Math.min(g - 1, x0 + 1), y1 = Math.min(g - 1, y0 + 1);
        const fx = Math.max(0, Math.min(1, x - x0)), fy = Math.max(0, Math.min(1, y - y0));
        const a = G![y0 * g + x0], bb = G![y0 * g + x1], c = G![y1 * g + x0], d = G![y1 * g + x1];
        return (a * (1 - fx) + bb * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
      };
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const u = (i + 0.5) / w, v = (j + 0.5) / h;
        b.f[j * w + i] = G ? 0.5 + 0.5 * Math.tanh(sample(u, v) * 1.2) : 0.15 + 0.35 * fbm(u * 3 + t * 0.05, v * 3, 5);
      }
      ditherField(b.f, w, h, b.img.data, TONES);
      // Boundary: where the sign of s flips between neighbouring cells.
      if (G) {
        for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) {
          const a = b.f[j * w + i] > 0.5, r = b.f[j * w + i + 1] > 0.5, dn = b.f[(j + 1) * w + i] > 0.5;
          if (a !== r || a !== dn) {
            const p = (j * w + i) * 4;
            b.img.data[p] = b.img.data[p + 1] = b.img.data[p + 2] = 255;
          }
        }
      }
      b.off.getContext("2d")!.putImageData(b.img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(b.off, 0, 0, w * px, h * px);

      const d = dataRef.current;
      const r = Math.max(3, Math.min(5, width / 90));
      d.x.forEach(([x, y], n) => {
        const sx = ((x + LIM) / (2 * LIM)) * width, sy = ((LIM - y) / (2 * LIM)) * height;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        if (d.y[n] > 0) {
          ctx.fillStyle = grey(1);
          ctx.fill();
          ctx.strokeStyle = grey(0);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else {
          ctx.fillStyle = grey(0);
          ctx.fill();
          ctx.strokeStyle = grey(1);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });
    },
    { fps: 24 },
  );
  return <canvas ref={ref} aria-label="Decision boundary and training data" role="img" className="block aspect-square w-full touch-none [image-rendering:pixelated]" />;
}

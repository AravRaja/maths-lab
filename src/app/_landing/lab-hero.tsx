"use client";

import { DitherField } from "@/kit/components/dither-field";

/**
 * Landing hero: three wave sources drifting on Lissajous paths. Their ripples interfere,
 * and the sum is Bayer-dithered to four greys. Pointer bulge comes from DitherField.
 */
const SOURCES = [
  { ax: 0.32, ay: 0.22, fx: 0.31, fy: 0.23, px: 0, py: 1.3, k: 34 },
  { ax: 0.28, ay: 0.3, fx: 0.19, fy: 0.27, px: 2.1, py: 0.4, k: 29 },
  { ax: 0.36, ay: 0.18, fx: 0.23, fy: 0.17, px: 4.2, py: 2.6, k: 41 },
];

function field(u: number, v: number, t: number): number {
  const x = u * 1.6;
  let s = 0;
  for (const q of SOURCES) {
    const cx = 0.8 + q.ax * Math.sin(q.fx * t + q.px) * 1.6;
    const cy = 0.5 + q.ay * Math.sin(q.fy * t + q.py);
    const d = Math.hypot(x - cx, v - cy);
    s += Math.cos(q.k * d - 1.6 * t) / (1 + 6 * d);
  }
  const vignette = 1 - 0.55 * Math.hypot(u - 0.5, v - 0.5);
  return Math.max(0, Math.min(1, (0.5 + 0.42 * s) * vignette));
}

export function LabHero() {
  return <DitherField field={field} pixel={3} fps={24} tones={[0, 0.16, 0.5, 1]} className="absolute inset-0" />;
}

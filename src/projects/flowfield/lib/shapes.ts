/** 2D datasets. Pure and worker-safe; glyphs (which need a DOM canvas) live in glyphs.ts. */

import { gauss, mulberry32, type Rng } from "./rng";

export type Pt = [number, number];

export interface Shape {
  id: string;
  label: string;
  points: Pt[];
}

/** Centre a point cloud and scale it so its larger half-extent is `extent`. */
export function normalise(points: Pt[], extent = 1.5): Pt[] {
  if (points.length === 0) return points;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of points) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const s = extent / Math.max(1e-6, (x1 - x0) / 2, (y1 - y0) / 2);
  return points.map(([x, y]) => [(x - cx) * s, (y - cy) * s]);
}

export function spiral(n: number, seed = 1): Pt[] {
  const rng = mulberry32(seed);
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const u = Math.sqrt((i + rng()) / n);
    const a = u * 3.4 * Math.PI;
    const r = 0.15 + 1.35 * u;
    pts.push([r * Math.cos(a) + 0.03 * gauss(rng), r * Math.sin(a) + 0.03 * gauss(rng)]);
  }
  return normalise(pts);
}

export function rings(n: number, seed = 2): Pt[] {
  const rng = mulberry32(seed);
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const r = i % 3 === 0 ? 0.55 : 1.4;
    const a = rng() * Math.PI * 2;
    pts.push([r * Math.cos(a) + 0.025 * gauss(rng), r * Math.sin(a) + 0.025 * gauss(rng)]);
  }
  return pts;
}

export function moons(n: number, seed = 3): Pt[] {
  const rng = mulberry32(seed);
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI;
    if (i % 2) pts.push([Math.cos(a) - 0.5 + 0.05 * gauss(rng), Math.sin(a) - 0.2 + 0.05 * gauss(rng)]);
    else pts.push([0.5 - Math.cos(a) + 0.05 * gauss(rng), 0.2 - Math.sin(a) + 0.05 * gauss(rng)]);
  }
  return normalise(pts, 1.5);
}

/**
 * Resample hand-drawn strokes (in world units) to n points spaced evenly by arc length,
 * with a little jitter so the data has width.
 */
export function resampleStrokes(strokes: Pt[][], n: number, seed = 7, jitter = 0.035): Pt[] {
  const rng = mulberry32(seed);
  const segs: { a: Pt; b: Pt; len: number }[] = [];
  for (const s of strokes) {
    if (s.length === 1) segs.push({ a: s[0], b: s[0], len: 0.02 });
    for (let i = 1; i < s.length; i++) {
      const len = Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
      if (len > 0) segs.push({ a: s[i - 1], b: s[i], len });
    }
  }
  const total = segs.reduce((a, s) => a + s.len, 0);
  if (!segs.length || total <= 0) return [];
  const out: Pt[] = [];
  let si = 0;
  let acc = 0;
  for (let k = 0; k < n; k++) {
    const target = ((k + rng()) / n) * total;
    while (si < segs.length - 1 && acc + segs[si].len < target) acc += segs[si++].len;
    const s = segs[si];
    const f = s.len > 0 ? Math.min(1, Math.max(0, (target - acc) / s.len)) : 0;
    out.push([s.a[0] + f * (s.b[0] - s.a[0]) + jitter * gauss(rng), s.a[1] + f * (s.b[1] - s.a[1]) + jitter * gauss(rng)]);
  }
  return out;
}

/** A random subset of the data (with replacement), as the training loop draws x₁. */
export function sampleData(points: Pt[], n: number, rng: Rng): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) out.push(points[Math.floor(rng() * points.length) % points.length]);
  return out;
}

import type { Matrix } from "../core/types";
import { gaussian, rng } from "./rng";

/** A tilted spiral galaxy of points in ℝ³: nearly planar, so it has a best-fit plane worth finding. */
export function galaxy(n = 320, seed = 3): Matrix {
  const r = rng(seed);
  const g = gaussian(r);
  const X: Matrix = { rows: n, cols: 3, data: new Float64Array(n * 3) };
  const tx = 1.05, tz = 0.6;
  for (let i = 0; i < n; i++) {
    const arm = i % 2;
    const rad = 0.25 + Math.sqrt(r()) * 1.25;
    const th = arm * Math.PI + rad * 2.4 + g() * 0.18;
    let x = rad * Math.cos(th) * 1.15 + g() * 0.05;
    let y = rad * Math.sin(th) * 0.8 + g() * 0.05;
    let z = g() * 0.09;
    // Tilt about x, then turn about z.
    [y, z] = [y * Math.cos(tx) - z * Math.sin(tx), y * Math.sin(tx) + z * Math.cos(tx)];
    [x, y] = [x * Math.cos(tz) - y * Math.sin(tz), x * Math.sin(tz) + y * Math.cos(tz)];
    X.data.set([x, y, z], i * 3);
  }
  // Centre it, so the best plane passes through the origin like every subspace does.
  for (let c = 0; c < 3; c++) {
    let m = 0;
    for (let i = 0; i < n; i++) m += X.data[i * 3 + c] / n;
    for (let i = 0; i < n; i++) X.data[i * 3 + c] -= m;
  }
  return X;
}

export type V3 = [number, number, number];

export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const unit = (a: V3): V3 => {
  const n = Math.hypot(...a) || 1;
  return [a[0] / n, a[1] / n, a[2] / n];
};

/** Two skewed, unnormalised vectors spanning the plane with normal set by (tilt, turn). Gram–Schmidt has work to do. */
export function rawSpan(tilt: number, turn: number): { normal: V3; a: V3; b: V3 } {
  const normal: V3 = [Math.sin(tilt) * Math.cos(turn), Math.sin(tilt) * Math.sin(turn), Math.cos(tilt)];
  const ref: V3 = Math.abs(normal[2]) > 0.95 ? [1, 0, 0] : [0, 0, 1];
  const au = unit(cross(normal, ref));
  const side = cross(normal, au);
  const a: V3 = [au[0] * 1.35, au[1] * 1.35, au[2] * 1.35];
  const b: V3 = [0.75 * au[0] + 1.05 * side[0], 0.75 * au[1] + 1.05 * side[1], 0.75 * au[2] + 1.05 * side[2]];
  return { normal, a, b };
}

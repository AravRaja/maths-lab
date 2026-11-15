import type { Matrix } from "../types";
import { rng } from "../../lib/rng";

/** Test helpers (not cores). */
export function randMatrix(m: number, n: number, seed: number): Matrix {
  const r = rng(seed);
  const data = new Float64Array(m * n);
  for (let i = 0; i < data.length; i++) data[i] = r() * 2 - 1;
  return { rows: m, cols: n, data };
}

export function randVec(n: number, seed: number): Float64Array {
  const r = rng(seed);
  return Float64Array.from({ length: n }, () => r() * 2 - 1);
}

export const dot = (a: ArrayLike<number>, b: ArrayLike<number>) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};
export const norm = (a: ArrayLike<number>) => Math.sqrt(dot(a, a));

export function frob(A: Matrix, B?: Matrix): number {
  let s = 0;
  for (let i = 0; i < A.data.length; i++) s += (A.data[i] - (B ? B.data[i] : 0)) ** 2;
  return Math.sqrt(s);
}

/** A = U diag(sigmas) Vᵀ with random orthonormal U (m × r) and V (n × r). */
export function withSpectrum(m: number, n: number, sigmas: number[], seed: number): Matrix {
  const U = orthonormal(m, sigmas.length, seed);
  const V = orthonormal(n, sigmas.length, seed + 1);
  const data = new Float64Array(m * n);
  for (let k = 0; k < sigmas.length; k++)
    for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) data[i * n + j] += sigmas[k] * U[k][i] * V[k][j];
  return { rows: m, cols: n, data };
}

/** r orthonormal vectors in ℝⁿ (reference Gram–Schmidt with re-orthogonalisation, test-only). */
export function orthonormal(n: number, r: number, seed: number): Float64Array[] {
  const out: Float64Array[] = [];
  let s = seed;
  while (out.length < r) {
    const v = randVec(n, s++ * 7919);
    for (let pass = 0; pass < 2; pass++)
      for (const q of out) {
        const d = dot(q, v);
        for (let i = 0; i < n; i++) v[i] -= d * q[i];
      }
    const nv = norm(v);
    if (nv > 1e-6) out.push(v.map((x) => x / nv));
  }
  return out;
}

export function maxAbs(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs(a[i] - b[i]));
  return d;
}

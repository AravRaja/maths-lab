import type { Matrix, SVD } from "../core/types";
import { deflate, powerIteration } from "../core/power";

/*
 * "Your SVD": the top-k singular triples found by your powerIteration() and deflate(), packed
 * into the same SVD layout as the library so your rankK() can use it. The loop is plumbing; the
 * two calls are yours.
 */
export function topKByPower(A: Matrix, k: number, onTriple?: (i: number, sigma: number, iters: number) => void, iters = 500): SVD & { iters: number[] } {
  const m = A.rows, n = A.cols;
  k = Math.min(k, m, n);
  const U: Matrix = { rows: m, cols: k, data: new Float64Array(m * k) };
  const V: Matrix = { rows: n, cols: k, data: new Float64Array(n * k) };
  const S = new Float64Array(k);
  const used: number[] = [];
  let R = A;
  for (let i = 0; i < k; i++) {
    const r = powerIteration(R, { iters, tol: 1e-10 });
    S[i] = r.sigma;
    for (let a = 0; a < m; a++) U.data[a * k + i] = r.u[a];
    for (let b = 0; b < n; b++) V.data[b * k + i] = r.v[b];
    used.push(r.iters);
    onTriple?.(i, r.sigma, r.iters);
    R = deflate(R, r.sigma, r.u, r.v);
  }
  return { U, S, V, iters: used };
}

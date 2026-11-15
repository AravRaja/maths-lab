import type { Matrix } from "../core/types";

/*
 * Test matrices with a spectrum you choose, built from smooth cosine modes so their singular
 * vectors look like waves when you plot them. Used by the power-iteration race.
 */

/** Orthonormal DCT-II basis vector j of length n. */
export function cosineMode(n: number, j: number): Float64Array {
  const s = j === 0 ? Math.sqrt(1 / n) : Math.sqrt(2 / n);
  return Float64Array.from({ length: n }, (_, i) => s * Math.cos((Math.PI * j * (i + 0.5)) / n));
}

/** m × n matrix Σ σ_i u_i v_iᵀ with cosine modes u_i (offset to look less symmetric) and v_i. */
export function gapMatrix(m: number, n: number, sigmas: number[]): { A: Matrix; U: Float64Array[]; V: Float64Array[] } {
  const U = sigmas.map((_, i) => cosineMode(m, i + 1));
  const V = sigmas.map((_, i) => cosineMode(n, (i * 2 + 1) % n));
  const A: Matrix = { rows: m, cols: n, data: new Float64Array(m * n) };
  sigmas.forEach((s, k) => {
    for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) A.data[i * n + j] += s * U[k][i] * V[k][j];
  });
  return { A, U, V };
}

/** The spectrum used by the race: σ_1 = 1, σ_2 = ρ, then a quick tail. */
export function raceSpectrum(rho: number): number[] {
  return [1, rho, rho * 0.55, 0.3, 0.2, 0.12, 0.08, 0.05];
}

import { describe, expect, it } from "vitest";
import { svd, layer } from "../svd";
import { zeros, matmul, transpose } from "../matrix";
import { rng } from "../rng";
import type { Matrix, SVD } from "../../core/types";

function rand(m: number, n: number, seed: number): Matrix {
  const r = rng(seed);
  const A = zeros(m, n);
  for (let i = 0; i < A.data.length; i++) A.data[i] = r() * 2 - 1;
  return A;
}

function rebuild(s: SVD): Matrix {
  const r = s.S.length;
  const US = { rows: s.U.rows, cols: r, data: s.U.data.map((x, idx) => x * s.S[idx % r]) };
  return matmul(US, transpose(s.V));
}

function maxAbsDiff(A: Matrix, B: Matrix): number {
  let d = 0;
  for (let i = 0; i < A.data.length; i++) d = Math.max(d, Math.abs(A.data[i] - B.data[i]));
  return d;
}

function orthoErr(F: Matrix): number {
  const G = matmul(transpose(F), F);
  let e = 0;
  for (let i = 0; i < G.rows; i++) for (let j = 0; j < G.cols; j++) e = Math.max(e, Math.abs(G.data[i * G.cols + j] - (i === j ? 1 : 0)));
  return e;
}

describe("library svd (scaffolding)", () => {
  for (const [m, n] of [[7, 4], [4, 7], [12, 12], [30, 9]] as const) {
    it(`reconstructs a random ${m}x${n}`, () => {
      const A = rand(m, n, m * 31 + n);
      const s = svd(A);
      expect(s.S.length).toBe(Math.min(m, n));
      expect(maxAbsDiff(rebuild(s), A)).toBeLessThan(1e-10);
      expect(orthoErr(s.U)).toBeLessThan(1e-10);
      expect(orthoErr(s.V)).toBeLessThan(1e-10);
      for (let i = 1; i < s.S.length; i++) expect(s.S[i]).toBeLessThanOrEqual(s.S[i - 1] + 1e-12);
    });
  }

  it("handles rank deficiency with orthonormal U", () => {
    // Rank 2: outer products.
    const A = zeros(6, 5);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 5; j++) A.data[i * 5 + j] = (i + 1) * (j - 2) + Math.sin(i) * Math.cos(j);
    const s = svd(A);
    expect(s.S[2]).toBeLessThan(1e-10);
    expect(orthoErr(s.U)).toBeLessThan(1e-8);
    expect(maxAbsDiff(rebuild(s), A)).toBeLessThan(1e-10);
  });

  it("layers add back up to A", () => {
    const A = rand(5, 4, 3);
    const s = svd(A);
    const sum = zeros(5, 4);
    for (let i = 0; i < 4; i++) {
      const L = layer(s, i);
      for (let t = 0; t < sum.data.length; t++) sum.data[t] += L.data[t];
    }
    expect(maxAbsDiff(sum, A)).toBeLessThan(1e-10);
  });
});

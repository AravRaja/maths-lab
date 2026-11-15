import { describe, expect, it } from "vitest";
import { rankK, storageCost } from "../lowrank";
import { svd } from "../../lib/svd";
import { frob, maxAbs, randMatrix, withSpectrum } from "./helpers";
import type { Matrix } from "../types";

const diag = (d: number[]): Matrix => {
  const n = d.length;
  const data = new Float64Array(n * n);
  d.forEach((v, i) => (data[i * n + i] = v));
  return { rows: n, cols: n, data };
};

describe("rankK", () => {
  it("keeps the biggest diagonal entry for a diagonal matrix", () => {
    const A1 = rankK(svd(diag([3, 1])), 1);
    expect(A1.rows).toBe(2);
    expect(A1.cols).toBe(2);
    expect(maxAbs(A1.data, [3, 0, 0, 0])).toBeLessThan(1e-12);
  });

  it("k = 0 is zero, k = r (or more) gives A back", () => {
    const A = randMatrix(7, 5, 1);
    const s = svd(A);
    expect(maxAbs(rankK(s, 0).data, new Float64Array(35))).toBe(0);
    expect(maxAbs(rankK(s, 5).data, A.data)).toBeLessThan(1e-10);
    expect(maxAbs(rankK(s, 50).data, A.data)).toBeLessThan(1e-10);
  });

  it("works for wide matrices", () => {
    const A = randMatrix(4, 9, 2);
    const s = svd(A);
    const A4 = rankK(s, 4);
    expect([A4.rows, A4.cols]).toEqual([4, 9]);
    expect(maxAbs(A4.data, A.data)).toBeLessThan(1e-10);
  });

  it("has rank at most k and error sqrt(sum of dropped sigma^2)", () => {
    const sig = [5, 3, 2, 1, 0.5, 0.25];
    const A = withSpectrum(12, 8, sig, 3);
    const s = svd(A);
    for (const k of [1, 2, 3, 5]) {
      const Ak = rankK(s, k);
      const sk = svd(Ak).S;
      for (let i = k; i < sk.length; i++) expect(sk[i]).toBeLessThan(1e-9);
      const want = Math.sqrt(sig.slice(k).reduce((a, b) => a + b * b, 0));
      expect(frob(A, Ak)).toBeCloseTo(want, 9);
    }
  });

  it("exactly recovers a rank-2 matrix at k = 2 and does not mutate the SVD", () => {
    const A = withSpectrum(10, 10, [4, 2], 7);
    const s = svd(A);
    const before = Float64Array.from(s.U.data);
    expect(maxAbs(rankK(s, 2).data, A.data)).toBeLessThan(1e-10);
    expect(maxAbs(s.U.data, before)).toBe(0);
  });
});

describe("storageCost", () => {
  it("costs nothing at k = 0 and grows linearly in k", () => {
    expect(storageCost(160, 120, 0)).toBe(0);
    const d1 = storageCost(160, 120, 2) - storageCost(160, 120, 1);
    const d2 = storageCost(160, 120, 11) - storageCost(160, 120, 10);
    expect(d1).toBe(d2);
    expect(d1).toBeGreaterThan(160 + 120 - 1);
    expect(d1).toBeLessThan(160 + 120 + 2);
  });

  it("matches a hand count for a 2 x 3 matrix at k = 1", () => {
    // u is 2 numbers, v is 3, sigma is 1.
    expect(storageCost(2, 3, 1)).toBe(6);
  });

  it("clamps k to min(m, n)", () => {
    expect(storageCost(5, 3, 10)).toBe(storageCost(5, 3, 3));
  });
});

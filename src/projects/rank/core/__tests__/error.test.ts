import { describe, expect, it } from "vitest";
import { energyCaptured, frobeniusError, tailEnergy } from "../error";
import { svd, layer } from "../../lib/svd";
import { randMatrix } from "./helpers";
import type { Matrix } from "../types";

describe("frobeniusError", () => {
  it("is the root sum of squared differences", () => {
    const A: Matrix = { rows: 2, cols: 2, data: Float64Array.from([1, 2, 3, 4]) };
    const B: Matrix = { rows: 2, cols: 2, data: Float64Array.from([1, 0, 3, 0]) };
    expect(frobeniusError(A, B)).toBeCloseTo(Math.sqrt(4 + 16), 12);
    expect(frobeniusError(B, A)).toBeCloseTo(Math.sqrt(20), 12);
    expect(frobeniusError(A, A)).toBe(0);
  });

  it("equals sqrt(sum sigma^2) against the zero matrix", () => {
    const A = randMatrix(9, 6, 4);
    const Z: Matrix = { rows: 9, cols: 6, data: new Float64Array(54) };
    const S = svd(A).S;
    expect(frobeniusError(A, Z)).toBeCloseTo(Math.sqrt(S.reduce((a, s) => a + s * s, 0)), 10);
  });
});

describe("tailEnergy (Eckart–Young)", () => {
  it("matches the measured error of the truncated SVD", () => {
    const A = randMatrix(10, 7, 5);
    const s = svd(A);
    for (let k = 0; k <= 7; k++) {
      const Ak: Matrix = { rows: 10, cols: 7, data: new Float64Array(70) };
      for (let i = 0; i < k; i++) {
        const L = layer(s, i);
        for (let t = 0; t < 70; t++) Ak.data[t] += L.data[t];
      }
      let e = 0;
      for (let t = 0; t < 70; t++) e += (A.data[t] - Ak.data[t]) ** 2;
      expect(tailEnergy(s.S, k)).toBeCloseTo(Math.sqrt(e), 10);
    }
  });

  it("closed forms", () => {
    expect(tailEnergy([3, 4], 0)).toBeCloseTo(5, 12);
    expect(tailEnergy([3, 4, 0], 1)).toBeCloseTo(4, 12);
    expect(tailEnergy([3, 4], 2)).toBe(0);
  });

  it("no rank-k matrix beats it (random rivals)", () => {
    const A = randMatrix(8, 8, 6);
    const S = svd(A).S;
    const k = 3;
    const bound = tailEnergy(S, k);
    for (let trial = 0; trial < 20; trial++) {
      const L = randMatrix(8, k, 100 + trial), R = randMatrix(k, 8, 200 + trial);
      // Best scaling of the random rank-k matrix B = L R, still rank k.
      const B = new Float64Array(64);
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) for (let t = 0; t < k; t++) B[i * 8 + j] += L.data[i * k + t] * R.data[t * 8 + j];
      let ab = 0, bb = 0;
      for (let t = 0; t < 64; t++) { ab += A.data[t] * B[t]; bb += B[t] * B[t]; }
      const c = ab / bb;
      let e = 0;
      for (let t = 0; t < 64; t++) e += (A.data[t] - c * B[t]) ** 2;
      expect(Math.sqrt(e)).toBeGreaterThanOrEqual(bound - 1e-12);
    }
  });
});

describe("energyCaptured", () => {
  it("runs from 0 to 1 and is consistent with tailEnergy", () => {
    const S = [5, 3, 1, 0.5];
    expect(energyCaptured(S, 0)).toBe(0);
    expect(energyCaptured(S, 4)).toBeCloseTo(1, 12);
    expect(energyCaptured(S, 1)).toBeCloseTo(25 / 35.25, 12);
    const total = S.reduce((a, s) => a + s * s, 0);
    let prev = -1;
    for (let k = 0; k <= 4; k++) {
      const e = energyCaptured(S, k);
      expect(e).toBeGreaterThanOrEqual(prev);
      prev = e;
      expect(e).toBeCloseTo(1 - tailEnergy(S, k) ** 2 / total, 12);
    }
  });

  it("is 1 for an all-zero spectrum", () => {
    expect(energyCaptured([0, 0, 0], 1)).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import { matmulBackward, type Matrix } from "../matmul";

const matmul = (A: Matrix, B: Matrix): Matrix => A.map((row) => B[0].map((_, j) => row.reduce((s, a, p) => s + a * B[p][j], 0)));
// L = Σ G ⊙ (A·B) has ∂L/∂C = G exactly, so finite differences of L check dA and dB.
const L = (A: Matrix, B: Matrix, G: Matrix) => matmul(A, B).reduce((s, row, i) => s + row.reduce((t, c, j) => t + c * G[i][j], 0), 0);

let seed = 5;
const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const rand = (m: number, n: number): Matrix => Array.from({ length: m }, () => Array.from({ length: n }, r));

describe("matmulBackward", () => {
  it("returns the right shapes", () => {
    const { dA, dB } = matmulBackward(rand(3, 4), rand(4, 2), rand(3, 2));
    expect(dA.length).toBe(3);
    dA.forEach((row) => expect(row.length).toBe(4));
    expect(dB.length).toBe(4);
    dB.forEach((row) => expect(row.length).toBe(2));
  });

  it("matches finite differences in every entry of A and B", () => {
    const A = rand(3, 4), B = rand(4, 5), G = rand(3, 5);
    const { dA, dB } = matmulBackward(A, B, G);
    const h = 1e-6;
    for (let i = 0; i < 3; i++) for (let p = 0; p < 4; p++) {
      const up = A.map((row) => row.slice()); up[i][p] += h;
      const dn = A.map((row) => row.slice()); dn[i][p] -= h;
      expect(dA[i][p]).toBeCloseTo((L(up, B, G) - L(dn, B, G)) / (2 * h), 6);
    }
    for (let p = 0; p < 4; p++) for (let j = 0; j < 5; j++) {
      const up = B.map((row) => row.slice()); up[p][j] += h;
      const dn = B.map((row) => row.slice()); dn[p][j] -= h;
      expect(dB[p][j]).toBeCloseTo((L(A, up, G) - L(A, dn, G)) / (2 * h), 6);
    }
  });

  it("dot product case (1×k · k×1)", () => {
    const { dA, dB } = matmulBackward([[1, 2, 3]], [[4], [5], [6]], [[2]]);
    expect(dA).toEqual([[8, 10, 12]]);
    expect(dB).toEqual([[2], [4], [6]]);
  });

  it("outer product case (m×1 · 1×n)", () => {
    const A = [[1], [-2]], B = [[3, 0.5, -1]], G = [[1, 0, 2], [0, 1, 0]];
    const { dA, dB } = matmulBackward(A, B, G);
    expect(dA[0][0]).toBeCloseTo(3 * 1 + -1 * 2, 12);
    expect(dA[1][0]).toBeCloseTo(0.5, 12);
    expect(dB[0]).toEqual([1, -2, 2]);
  });

  it("does not modify its inputs", () => {
    const A = rand(2, 3), B = rand(3, 2), G = rand(2, 2);
    const copies = [A, B, G].map((M) => JSON.stringify(M));
    matmulBackward(A, B, G);
    expect([A, B, G].map((M) => JSON.stringify(M))).toEqual(copies);
  });
});

import { describe, expect, it } from "vitest";
import { numericalGrad, relError } from "../gradcheck";

describe("numericalGrad", () => {
  it("is exact (to round-off) on quadratics", () => {
    const f = (x: number[]) => 3 * x[0] * x[0] - 2 * x[0] * x[1] + 0.5 * x[1] * x[1] + 7;
    const x = [1.2, -0.8];
    const g = numericalGrad(f, x);
    expect(g).toHaveLength(2);
    expect(g[0]).toBeCloseTo(6 * 1.2 - 2 * -0.8, 8);
    expect(g[1]).toBeCloseTo(-2 * 1.2 + -0.8, 8);
  });

  it("is a CENTRAL difference: on x³ with h = 0.1 the error is exactly h²", () => {
    // (f(x+h) − f(x−h)) / 2h = 3x² + h² for f = x³. A one-sided difference would give 3x² + 3xh + h².
    const g = numericalGrad((x) => x[0] ** 3, [1], 0.1)[0];
    expect(g).toBeCloseTo(3.01, 10);
  });

  it("uses the default h = 1e-5 well enough for smooth functions", () => {
    const f = (x: number[]) => Math.sin(x[0]) * Math.exp(x[1]) + Math.tanh(x[2]);
    const x = [0.3, -0.2, 1.1];
    const g = numericalGrad(f, x);
    const want = [Math.cos(0.3) * Math.exp(-0.2), Math.sin(0.3) * Math.exp(-0.2), 1 - Math.tanh(1.1) ** 2];
    g.forEach((v, i) => expect(Math.abs(v - want[i])).toBeLessThan(1e-8));
  });

  it("error shrinks like h² (halving h quarters it)", () => {
    const f = (x: number[]) => Math.exp(x[0]);
    const e1 = Math.abs(numericalGrad(f, [0.5], 0.02)[0] - Math.exp(0.5));
    const e2 = Math.abs(numericalGrad(f, [0.5], 0.01)[0] - Math.exp(0.5));
    expect(e1 / e2).toBeGreaterThan(3.8);
    expect(e1 / e2).toBeLessThan(4.2);
  });

  it("leaves the caller's x untouched", () => {
    const x = [0.1, 0.2, 0.3];
    numericalGrad((v) => v[0] * v[1] * v[2], x);
    expect(x).toEqual([0.1, 0.2, 0.3]);
  });
});

describe("relError", () => {
  it("is 0 for identical vectors (including all-zero ones)", () => {
    expect(relError([1, -2, 3], [1, -2, 3])).toBe(0);
    expect(relError([0, 0], [0, 0])).toBe(0);
    expect(relError([], [])).toBe(0);
  });

  it("matches the definition", () => {
    // entries: |1−1.1|/2.1, |−2+2|/4 = 0, |0.5−0.4|/0.9
    expect(relError([1, -2, 0.5], [1.1, -2, 0.4])).toBeCloseTo(Math.max(0.1 / 2.1, 0.1 / 0.9), 12);
  });

  it("is symmetric and scale-invariant", () => {
    const a = [0.3, -1.7, 2.2], b = [0.31, -1.69, 2.25];
    expect(relError(a, b)).toBeCloseTo(relError(b, a), 15);
    expect(relError(a.map((v) => v * 1e6), b.map((v) => v * 1e6))).toBeCloseTo(relError(a, b), 12);
    expect(relError(a.map((v) => v * 1e-6), b.map((v) => v * 1e-6))).toBeCloseTo(relError(a, b), 9);
  });

  it("is 1 for opposite signs and lies in [0, 1]", () => {
    expect(relError([2], [-2])).toBeCloseTo(1, 12);
    expect(relError([1], [0])).toBeCloseTo(1, 12);
    const v = relError([0.2, 5], [0.3, -1]);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  });
});

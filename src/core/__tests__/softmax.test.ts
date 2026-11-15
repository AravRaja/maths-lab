import { describe, expect, it } from "vitest";
import { logSumExp, softmax } from "../softmax";

/*
 * Core tests check the maths, not the implementation: closed forms, invariants,
 * stability and a finite-difference gradient check. They fail until you write the core.
 */

const naiveLSE = (z: number[]) => Math.log(z.reduce((s, v) => s + Math.exp(v), 0));

describe("logSumExp", () => {
  it("matches the naive formula on small inputs", () => {
    for (const z of [[0], [1, 2, 3], [-1, 0.5, 2.25, -3]]) expect(logSumExp(z)).toBeCloseTo(naiveLSE(z), 10);
  });

  it("is exact on equal entries: LSE(c·1_n) = c + log n", () => {
    expect(logSumExp([5, 5, 5, 5])).toBeCloseTo(5 + Math.log(4), 12);
  });

  it("does not overflow or underflow", () => {
    expect(logSumExp([1000, 1000])).toBeCloseTo(1000 + Math.log(2), 9);
    expect(logSumExp([-1000, -1000])).toBeCloseTo(-1000 + Math.log(2), 9);
  });

  it("sits between max(z) and max(z) + log n", () => {
    const z = [0.3, -2, 4.1, 3.9, 1];
    const m = Math.max(...z);
    const v = logSumExp(z);
    expect(v).toBeGreaterThanOrEqual(m);
    expect(v).toBeLessThanOrEqual(m + Math.log(z.length));
  });

  it("has gradient softmax(z) (central finite differences)", () => {
    const z = [0.2, -1.3, 2.0, 0.7];
    const h = 1e-5;
    const p = softmax(z);
    z.forEach((_, i) => {
      const up = z.slice(); up[i] += h;
      const dn = z.slice(); dn[i] -= h;
      expect((logSumExp(up) - logSumExp(dn)) / (2 * h)).toBeCloseTo(p[i], 6);
    });
  });
});

describe("softmax", () => {
  it("is a probability distribution", () => {
    const p = softmax([2, -1, 0.5, 3]);
    p.forEach((v) => expect(v).toBeGreaterThan(0));
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  it("is invariant to adding a constant", () => {
    const z = [0.1, 0.2, -0.7];
    const a = softmax(z), b = softmax(z.map((v) => v + 123.4));
    a.forEach((v, i) => expect(b[i]).toBeCloseTo(v, 12));
  });

  it("is uniform on equal logits and at high temperature", () => {
    softmax([3, 3, 3]).forEach((v) => expect(v).toBeCloseTo(1 / 3, 12));
    softmax([1, 5, -2], 1e6).forEach((v) => expect(v).toBeCloseTo(1 / 3, 4));
  });

  it("approaches argmax as temperature → 0", () => {
    const p = softmax([1, 5, -2], 1e-3);
    expect(p[1]).toBeCloseTo(1, 9);
  });

  it("survives huge logits", () => {
    const p = softmax([1000, 1001]);
    expect(p[1]).toBeCloseTo(Math.E / (1 + Math.E), 12);
  });
});

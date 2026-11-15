import { describe, expect, it } from "vitest";
import { entropy, logProb } from "../policy";

/*
 * Categorical policy: probabilities sum to one, shift invariance, numerical stability,
 * the two-action sigmoid identity, and entropy's bounds and closed forms.
 */

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("logProb", () => {
  it("gives log(1/K) for equal logits", () => {
    expect(logProb([0, 0], 0)).toBeCloseTo(Math.log(0.5), 12);
    expect(logProb([3, 3, 3, 3], 2)).toBeCloseTo(Math.log(0.25), 12);
  });

  it("is a log-probability: ≤ 0 and exp sums to 1", () => {
    for (const z of [[0.3, -1.2], [2, 0.5, -3], [10, -10], [0, 0, 0, 0, 1]]) {
      const ps = z.map((_, a) => Math.exp(logProb(z, a)));
      ps.forEach((p, a) => expect(logProb(z, a)).toBeLessThanOrEqual(1e-15));
      expect(sum(ps)).toBeCloseTo(1, 12);
    }
  });

  it("is a sigmoid of the logit gap for two actions", () => {
    for (const [l, r] of [[0, 1], [-2, 0.5], [3, -4]]) {
      expect(Math.exp(logProb([l, r], 1))).toBeCloseTo(1 / (1 + Math.exp(-(r - l))), 12);
    }
  });

  it("is unchanged by adding a constant to every logit", () => {
    const z = [0.7, -0.4, 1.9];
    for (let a = 0; a < 3; a++) expect(logProb(z.map((v) => v + 123.4), a)).toBeCloseTo(logProb(z, a), 10);
  });

  it("is stable for huge logits", () => {
    expect(logProb([1000, 999], 0)).toBeCloseTo(-Math.log(1 + Math.exp(-1)), 10);
    expect(logProb([1000, 999], 1)).toBeCloseTo(-1 - Math.log(1 + Math.exp(-1)), 10);
    expect(logProb([-1000, -1000], 1)).toBeCloseTo(Math.log(0.5), 10);
    expect(Number.isFinite(logProb([800, -800], 1))).toBe(true);
    expect(logProb([800, -800], 1)).toBeCloseTo(-1600, 6);
  });

  it("works with a single action", () => {
    expect(logProb([5], 0)).toBeCloseTo(0, 12);
  });
});

describe("entropy", () => {
  it("is log K for a uniform policy (the maximum)", () => {
    expect(entropy([0, 0])).toBeCloseTo(Math.log(2), 12);
    expect(entropy([1, 1, 1, 1, 1])).toBeCloseTo(Math.log(5), 12);
  });

  it("matches −Σ p log p for a hand-worked case", () => {
    const z = [Math.log(0.2), Math.log(0.8)];
    expect(entropy(z)).toBeCloseTo(-(0.2 * Math.log(0.2) + 0.8 * Math.log(0.8)), 12);
  });

  it("lies in [0, log K] and is shift invariant", () => {
    let s = 9;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 50; i++) {
      const z = Array.from({ length: 3 }, () => (rnd() - 0.5) * 12);
      const h = entropy(z);
      expect(h).toBeGreaterThanOrEqual(-1e-12);
      expect(h).toBeLessThanOrEqual(Math.log(3) + 1e-12);
      expect(entropy(z.map((v) => v - 50))).toBeCloseTo(h, 10);
    }
  });

  it("goes to 0, not NaN, for a near one-hot policy", () => {
    const h = entropy([1000, -1000]);
    expect(Number.isNaN(h)).toBe(false);
    expect(h).toBeCloseTo(0, 10);
    expect(entropy([0, 1e6, 0])).toBeCloseTo(0, 10);
  });

  it("falls as the logit gap grows", () => {
    expect(entropy([0, 0.5])).toBeGreaterThan(entropy([0, 2]));
    expect(entropy([0, 2])).toBeGreaterThan(entropy([0, 6]));
  });
});

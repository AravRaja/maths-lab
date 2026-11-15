import { describe, expect, it } from "vitest";
import { mcEstimate } from "../montecarlo";
import { mulberry32, normalSampler } from "../../lib/rng";

describe("mcEstimate (m4-monte-carlo)", () => {
  it("sample mean and standard error on a tiny hand-checkable set", () => {
    // values 2, 4, 4, 4, 5, 5, 7, 9: mean 5, unbiased variance 32/7
    const r = mcEstimate([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(r.n).toBe(8);
    expect(r.mean).toBeCloseTo(5, 12);
    expect(r.stdErr).toBeCloseTo(Math.sqrt(32 / 7 / 8), 12);
  });

  it("accepts typed arrays and constant data has zero error", () => {
    const r = mcEstimate(new Float64Array([3, 3, 3, 3]));
    expect(r.mean).toBe(3);
    expect(r.stdErr).toBe(0);
  });

  it("edge cases: n = 1 has unknown error, n = 0 has no mean", () => {
    expect(mcEstimate([4]).stdErr).toBe(Infinity);
    expect(mcEstimate([4]).mean).toBe(4);
    const e = mcEstimate([]);
    expect(e.n).toBe(0);
    expect(Number.isNaN(e.mean)).toBe(true);
    expect(e.stdErr).toBe(Infinity);
  });

  it("is numerically stable when the mean dwarfs the spread", () => {
    const vals = [1e9 + 4, 1e9 + 7, 1e9 + 13, 1e9 + 16];
    // spread like [4, 7, 13, 16]: unbiased variance 30
    expect(mcEstimate(vals).stdErr).toBeCloseTo(Math.sqrt(30 / 4), 6);
  });

  it("standard error shrinks like 1/√n", () => {
    const z = normalSampler(mulberry32(11));
    const xs = Float64Array.from({ length: 64000 }, () => 2 + 3 * z());
    const small = mcEstimate(xs.subarray(0, 4000));
    const big = mcEstimate(xs);
    expect(big.stdErr / small.stdErr).toBeCloseTo(0.25, 1);
    expect(big.stdErr).toBeCloseTo(3 / Math.sqrt(64000), 3);
  });

  it("±1.96 standard errors covers the truth about 95% of the time", () => {
    const rng = mulberry32(2024);
    let hits = 0;
    const trials = 2000;
    for (let k = 0; k < trials; k++) {
      // f(U) = U² for U ~ Uniform(0, 1): E = 1/3
      const vals = Array.from({ length: 50 }, () => rng() ** 2);
      const r = mcEstimate(vals);
      if (Math.abs(r.mean - 1 / 3) <= 1.96 * r.stdErr) hits++;
    }
    expect(hits / trials).toBeGreaterThan(0.92);
    expect(hits / trials).toBeLessThan(0.97);
  });
});

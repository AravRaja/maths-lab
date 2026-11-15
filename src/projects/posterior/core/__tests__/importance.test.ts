import { describe, expect, it } from "vitest";
import { effectiveSampleSize, importanceWeights } from "../importance";
import { normalLogPdf, normalTail } from "../../lib/special";
import { mulberry32, normalSampler } from "../../lib/rng";

const sum = (a: ArrayLike<number>) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };

describe("importanceWeights (m5-importance)", () => {
  it("normalises p/q on a hand-checkable case", () => {
    // p/q ratios 1 : 2 : 1
    const w = importanceWeights([Math.log(0.2), Math.log(0.4), Math.log(0.1)], [Math.log(0.2), Math.log(0.2), Math.log(0.1)]);
    expect(w).toBeInstanceOf(Float64Array);
    expect(Array.from(w).map((v) => +v.toFixed(12))).toEqual([0.25, 0.5, 0.25]);
  });

  it("ignores p's normalising constant", () => {
    const logp = [-1.2, 0.3, -0.7, 2.1];
    const logq = [0.1, -0.4, 0.2, 0.9];
    const a = importanceWeights(logp, logq);
    const b = importanceWeights(logp.map((v) => v + 123.4), logq);
    for (let i = 0; i < a.length; i++) expect(b[i]).toBeCloseTo(a[i], 12);
    expect(sum(a)).toBeCloseTo(1, 12);
  });

  it("survives huge negative and positive log weights (log-sum-exp)", () => {
    const w = importanceWeights([-1000, -1001, -1002], [0, 0, 0]);
    expect(sum(w)).toBeCloseTo(1, 12);
    expect(w[0] / w[1]).toBeCloseTo(Math.E, 8);
    const big = importanceWeights([900, 899], [0, 0]);
    expect(big[0] / big[1]).toBeCloseTo(Math.E, 8);
    for (const v of [...w, ...big]) expect(Number.isFinite(v)).toBe(true);
  });

  it("reweights samples from q into expectations under p", () => {
    // p = N(0, 1), q = N(1, 1.5²). E_p[x²] = 1.
    const z = normalSampler(mulberry32(7));
    const n = 50000;
    const xs = Array.from({ length: n }, () => 1 + 1.5 * z());
    const w = importanceWeights(xs.map((x) => normalLogPdf(x, 0, 1)), xs.map((x) => normalLogPdf(x, 1, 2.25)));
    let est = 0;
    for (let i = 0; i < n; i++) est += w[i] * xs[i] * xs[i];
    expect(est).toBeCloseTo(1, 1);
  });

  it("estimates a tail probability far better than plain Monte Carlo", () => {
    // P(X > 2.5), X ~ N(0, 1), about 0.00621. q = N(2, 1.5²) puts many more samples out there.
    const truth = normalTail(2.5);
    const z = normalSampler(mulberry32(3));
    const n = 4000;
    const xs = Array.from({ length: n }, () => 2 + 1.5 * z());
    const w = importanceWeights(xs.map((x) => normalLogPdf(x, 0, 1)), xs.map((x) => normalLogPdf(x, 2, 2.25)));
    let est = 0;
    for (let i = 0; i < n; i++) est += xs[i] > 2.5 ? w[i] : 0;
    expect(est / truth).toBeGreaterThan(0.75);
    expect(est / truth).toBeLessThan(1.25);
  });
});

describe("effectiveSampleSize (m5-importance)", () => {
  it("is n for equal weights and 1 for a single winner", () => {
    expect(effectiveSampleSize([0.25, 0.25, 0.25, 0.25])).toBeCloseTo(4, 12);
    expect(effectiveSampleSize([3, 3, 3])).toBeCloseTo(3, 12);
    expect(effectiveSampleSize([0, 0, 1, 0])).toBeCloseTo(1, 12);
  });

  it("is scale invariant and between 1 and n", () => {
    const w = [0.1, 2, 0.4, 0.4, 5, 0.05];
    const e = effectiveSampleSize(w);
    expect(effectiveSampleSize(w.map((v) => v * 17))).toBeCloseTo(e, 10);
    expect(e).toBeGreaterThanOrEqual(1);
    expect(e).toBeLessThanOrEqual(w.length);
    expect(e).toBeCloseTo((7.95 * 7.95) / (0.01 + 4 + 0.16 + 0.16 + 25 + 0.0025), 10);
  });

  it("drops as the proposal drifts away from the target", () => {
    const z = normalSampler(mulberry32(8));
    const base = Array.from({ length: 5000 }, () => z());
    const ess = (shift: number) => {
      const xs = base.map((v) => v + shift);
      return effectiveSampleSize(importanceWeights(xs.map((x) => normalLogPdf(x, 0, 1)), xs.map((x) => normalLogPdf(x, shift, 1))));
    };
    const e0 = ess(0), e1 = ess(1), e2 = ess(2.5);
    expect(e0).toBeCloseTo(5000, 6);
    expect(e1).toBeLessThan(e0);
    expect(e2).toBeLessThan(e1);
    // For a mean shift δ between unit Gaussians, ESS/n → exp(−δ²).
    expect(e1 / 5000).toBeCloseTo(Math.exp(-1), 1);
  });
});

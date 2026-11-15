import { describe, expect, it } from "vitest";
import { betaMoments, betaUpdate, logEvidence } from "../beta";
import { betaPdf } from "../../lib/special";
import { coinFlips, mulberry32 } from "../../lib/rng";

/** Simpson's rule on [lo, hi]. */
const integrate = (f: (x: number) => number, lo = 0, hi = 1, n = 4000) => {
  const h = (hi - lo) / n;
  let s = f(lo) + f(hi);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(lo + i * h);
  return (s * h) / 3;
};

describe("betaUpdate (m1-coin)", () => {
  it("posterior density is proportional to likelihood × prior", () => {
    const prior = { a: 2.5, b: 1.5 };
    const h = 7, t = 4;
    const post = betaUpdate(prior, h, t);
    // Normalise likelihood × prior numerically and compare pointwise with the Beta you returned.
    const unnorm = (th: number) => th ** h * (1 - th) ** t * betaPdf(th, prior.a, prior.b);
    const Z = integrate(unnorm, 1e-9, 1 - 1e-9);
    for (const th of [0.1, 0.3, 0.5, 0.62, 0.8, 0.95]) {
      expect(betaPdf(th, post.a, post.b)).toBeCloseTo(unnorm(th) / Z, 5);
    }
  });

  it("does not mutate the prior and handles zero counts", () => {
    const prior = { a: 1, b: 1 };
    const post = betaUpdate(prior, 0, 0);
    expect(prior).toEqual({ a: 1, b: 1 });
    expect(post).not.toBe(prior);
    expect(post.a).toBeCloseTo(1, 12);
    expect(post.b).toBeCloseTo(1, 12);
  });

  it("flip-by-flip equals all at once, in any order", () => {
    const flips = coinFlips(mulberry32(9), 0.7, 60);
    let seq = { a: 0.5, b: 0.5 };
    for (const f of flips) seq = betaUpdate(seq, f, 1 - f);
    let rev = { a: 0.5, b: 0.5 };
    for (const f of [...flips].reverse()) rev = betaUpdate(rev, f, 1 - f);
    const h = flips.reduce((s, f) => s + f, 0);
    const batch = betaUpdate({ a: 0.5, b: 0.5 }, h, flips.length - h);
    expect(seq.a).toBeCloseTo(batch.a, 10);
    expect(seq.b).toBeCloseTo(batch.b, 10);
    expect(rev.a).toBeCloseTo(batch.a, 10);
    expect(rev.b).toBeCloseTo(batch.b, 10);
  });
});

describe("betaMoments (m1-coin)", () => {
  it("matches numerical integration of the density", () => {
    for (const [a, b] of [[1, 1], [2, 5], [30, 12], [0.7, 3.2]]) {
      const m1 = integrate((th) => th * betaPdf(th, a, b), 1e-9, 1 - 1e-9, 20000);
      const m2 = integrate((th) => th * th * betaPdf(th, a, b), 1e-9, 1 - 1e-9, 20000);
      const { mean, variance } = betaMoments({ a, b });
      expect(mean).toBeCloseTo(m1, a < 1 ? 2 : 5);
      expect(variance).toBeCloseTo(m2 - m1 * m1, a < 1 ? 2 : 5);
    }
  });

  it("posterior concentrates on the true bias as flips arrive", () => {
    const flips = coinFlips(mulberry32(1), 0.3, 4000);
    const h = flips.reduce((s, f) => s + f, 0);
    const { mean, variance } = betaMoments(betaUpdate({ a: 1, b: 1 }, h, flips.length - h));
    expect(Math.abs(mean - 0.3)).toBeLessThan(0.03);
    expect(Math.sqrt(variance)).toBeLessThan(0.01);
  });
});

describe("logEvidence (m2-evidence)", () => {
  it("equals log ∫ θ^h (1−θ)^t p(θ) dθ", () => {
    for (const [a, b, h, t] of [[1, 1, 3, 2], [2, 2, 0, 5], [5, 1, 4, 1], [0.8, 1.7, 6, 9]]) {
      const ev = integrate((th) => th ** h * (1 - th) ** t * betaPdf(th, a, b), 1e-9, 1 - 1e-9, 40000);
      expect(logEvidence({ a, b }, h, t)).toBeCloseTo(Math.log(ev), a < 1 ? 3 : 6);
    }
  });

  it("no data means evidence 1", () => {
    expect(logEvidence({ a: 3, b: 4 }, 0, 0)).toBeCloseTo(0, 10);
  });

  it("chain rule: p(D1, D2) = p(D1) p(D2 | D1)", () => {
    const prior = { a: 2, b: 3 };
    const whole = logEvidence(prior, 12, 7);
    const first = logEvidence(prior, 5, 2);
    const second = logEvidence(betaUpdate(prior, 5, 2), 7, 5);
    expect(whole).toBeCloseTo(first + second, 9);
  });

  it("stays finite for long runs (work in logs)", () => {
    const v = logEvidence({ a: 1, b: 1 }, 600, 400);
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeLessThan(-600);
  });
});

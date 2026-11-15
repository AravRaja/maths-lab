import { describe, expect, it } from "vitest";
import { bernoulliLogLik, bernoulliLogLikGrad, elbo } from "../elbo";
import { gaussianKL } from "../kl";
import { fd, rand, vec } from "./helpers";

const naive = (x: number[], l: number[]) =>
  x.reduce((s, xi, i) => {
    const p = 1 / (1 + Math.exp(-l[i]));
    return s + xi * Math.log(p) + (1 - xi) * Math.log(1 - p);
  }, 0);

describe("m3 · bernoulliLogLik", () => {
  it("matches the textbook formula for moderate logits", () => {
    const r = rand(2);
    const x = vec(r, 30, 0, 1);
    const l = vec(r, 30, -6, 6);
    expect(bernoulliLogLik(x, l)).toBeCloseTo(naive(x, l), 9);
  });

  it("is log ½ per pixel at logit 0", () => {
    expect(bernoulliLogLik([1, 0, 0.3], [0, 0, 0])).toBeCloseTo(3 * Math.log(0.5), 12);
  });

  it("stays finite and accurate at extreme logits", () => {
    expect(bernoulliLogLik([1], [-100])).toBeCloseTo(-100, 8);
    expect(bernoulliLogLik([0], [100])).toBeCloseTo(-100, 8);
    expect(bernoulliLogLik([1], [100])).toBeCloseTo(0, 12);
    expect(bernoulliLogLik([0], [-100])).toBeCloseTo(0, 12);
    expect(Number.isFinite(bernoulliLogLik([0.5, 0.5], [800, -800]))).toBe(true);
  });

  it("is never positive for greys in [0, 1]", () => {
    const r = rand(4);
    for (let k = 0; k < 40; k++) expect(bernoulliLogLik(vec(r, 8, 0, 1), vec(r, 8, -10, 10))).toBeLessThanOrEqual(0);
  });
});

describe("m3 · bernoulliLogLikGrad", () => {
  it("matches finite differences (gradient check)", () => {
    const r = rand(8);
    const x = vec(r, 12, 0, 1);
    const l = vec(r, 12, -5, 5);
    const g = bernoulliLogLikGrad(x, l);
    expect(g).toHaveLength(12);
    for (let i = 0; i < 12; i++) expect(g[i]).toBeCloseTo(fd((ll) => bernoulliLogLik(x, ll), l, i), 6);
  });

  it("is zero where the decoder is exactly right", () => {
    const x = [0.2, 0.5, 0.9];
    const l = x.map((p) => Math.log(p / (1 - p)));
    expect(bernoulliLogLikGrad(x, l).every((g) => Math.abs(g) < 1e-12)).toBe(true);
  });

  it("is finite at extreme logits", () => {
    expect(bernoulliLogLikGrad([1, 0], [-1000, 1000]).every(Number.isFinite)).toBe(true);
  });
});

describe("m3 · elbo", () => {
  const r = rand(21);
  const x = vec(r, 16, 0, 1);
  const logits = vec(r, 16, -4, 4);
  const mu = vec(r, 2);
  const lv = vec(r, 2, -2, 1);

  it("is reconstruction minus β · KL", () => {
    for (const beta of [0, 0.5, 1, 4]) {
      const e = elbo(x, logits, mu, lv, beta);
      expect(e.recon).toBeCloseTo(bernoulliLogLik(x, logits), 10);
      expect(e.kl).toBeCloseTo(gaussianKL(mu, lv), 10);
      expect(e.elbo).toBeCloseTo(e.recon - beta * e.kl, 10);
    }
  });

  it("can only go down as β grows (KL ≥ 0)", () => {
    expect(elbo(x, logits, mu, lv, 2).elbo).toBeLessThanOrEqual(elbo(x, logits, mu, lv, 1).elbo);
  });
});

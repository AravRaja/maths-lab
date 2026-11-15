import { describe, expect, it } from "vitest";
import { gaussianNll } from "../policy-head";

/*
 * Gaussian negative log-likelihood: closed form, minimisers and a central
 * finite-difference check of both gradients.
 */

const LOG_2PI = Math.log(2 * Math.PI);

describe("gaussianNll", () => {
  it("is ½ log 2π per dimension for a standard normal evaluated at its mean", () => {
    const r = gaussianNll([0.3, -0.2], [0, 0], [0.3, -0.2]);
    expect(r.loss).toBeCloseTo(LOG_2PI, 12);
  });

  it("matches −log of the Gaussian pdf", () => {
    const mu = [0.1, -0.4], s = [-0.5, 0.3], a = [0.7, -1.1];
    let want = 0;
    for (let k = 0; k < 2; k++) {
      const sd = Math.exp(s[k]);
      want -= Math.log(Math.exp(-((a[k] - mu[k]) ** 2) / (2 * sd * sd)) / (sd * Math.sqrt(2 * Math.PI)));
    }
    expect(gaussianNll(mu, s, a).loss).toBeCloseTo(want, 10);
  });

  it("returns gradients the same shape as μ", () => {
    const r = gaussianNll([0, 0, 0], [0, 0, 0], [1, 2, 3]);
    expect(r.dMu).toHaveLength(3);
    expect(r.dLogStd).toHaveLength(3);
  });

  it("has the right gradients (central finite differences)", () => {
    const mu = [0.25, -0.6], s = [-0.3, 0.45], a = [-0.1, 0.35];
    const r = gaussianNll(mu, s, a);
    const h = 1e-5;
    for (let k = 0; k < 2; k++) {
      const up = mu.slice(); up[k] += h;
      const dn = mu.slice(); dn[k] -= h;
      expect(r.dMu[k]).toBeCloseTo((gaussianNll(up, s, a).loss - gaussianNll(dn, s, a).loss) / (2 * h), 6);
      const su = s.slice(); su[k] += h;
      const sd = s.slice(); sd[k] -= h;
      expect(r.dLogStd[k]).toBeCloseTo((gaussianNll(mu, su, a).loss - gaussianNll(mu, sd, a).loss) / (2 * h), 6);
    }
  });

  it("has zero mean-gradient at μ = a", () => {
    gaussianNll([0.4, -0.2], [0.1, -0.7], [0.4, -0.2]).dMu.forEach((g) => expect(g).toBeCloseTo(0, 12));
  });

  it("is stationary in log σ exactly when σ = |a − μ|", () => {
    const mu = [0], a = [0.37];
    expect(gaussianNll(mu, [Math.log(0.37)], a).dLogStd[0]).toBeCloseTo(0, 12);
    expect(gaussianNll(mu, [Math.log(0.2)], a).dLogStd[0]).toBeLessThan(0); // σ too small: grow it
    expect(gaussianNll(mu, [Math.log(0.6)], a).dLogStd[0]).toBeGreaterThan(0); // σ too big: shrink it
  });

  it("learns the data's mean and spread by gradient descent", () => {
    // Fit one (μ, log σ) to samples ±1: the best Gaussian has μ = 0, σ = 1.
    const data = [-1, 1, -1, 1];
    let mu = 0.8, s = -1.5;
    for (let it = 0; it < 4000; it++) {
      let gm = 0, gs = 0;
      for (const a of data) {
        const r = gaussianNll([mu], [s], [a]);
        gm += r.dMu[0] / data.length;
        gs += r.dLogStd[0] / data.length;
      }
      mu -= 0.05 * gm;
      s -= 0.05 * gs;
    }
    expect(mu).toBeCloseTo(0, 4);
    expect(Math.exp(s)).toBeCloseTo(1, 4);
  });
});

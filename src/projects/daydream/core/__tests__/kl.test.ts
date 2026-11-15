import { describe, expect, it } from "vitest";
import { gaussianKL, gaussianKLGrad } from "../kl";
import { fd, normPdf, rand, simpson, vec } from "./helpers";

describe("m2 · gaussianKL", () => {
  it("is exactly 0 for the prior itself", () => {
    expect(gaussianKL([0, 0, 0], [0, 0, 0])).toBeCloseTo(0, 12);
  });

  it("matches numerical integration of ∫ q log(q / p) in 1-D", () => {
    for (const [m, lv] of [[0.8, 0], [0, Math.log(0.3)], [-1.5, Math.log(2.5)], [0.4, -2]]) {
      const v = Math.exp(lv);
      const sd = Math.sqrt(v);
      const kl = simpson((z) => {
        const q = normPdf(z, m, v);
        return q > 0 ? q * Math.log(q / normPdf(z, 0, 1)) : 0;
      }, m - 12 * sd, m + 12 * sd, 6000);
      expect(gaussianKL([m], [lv])).toBeCloseTo(kl, 6);
    }
  });

  it("adds up over dimensions", () => {
    const a = gaussianKL([0.5], [-0.3]);
    const b = gaussianKL([-1], [0.7]);
    expect(gaussianKL([0.5, -1], [-0.3, 0.7])).toBeCloseTo(a + b, 12);
  });

  it("is positive away from the prior", () => {
    const r = rand(5);
    for (let k = 0; k < 50; k++) expect(gaussianKL(vec(r, 3, -2, 2), vec(r, 3, -3, 3))).toBeGreaterThan(0);
  });
});

describe("m2 · gaussianKLGrad", () => {
  it("matches finite differences (gradient check)", () => {
    const r = rand(9);
    const mu = vec(r, 5, -2, 2);
    const lv = vec(r, 5, -3, 2);
    const { dmu, dlogvar } = gaussianKLGrad(mu, lv);
    for (let i = 0; i < 5; i++) {
      expect(dmu[i]).toBeCloseTo(fd((m) => gaussianKL(m, lv), mu, i), 6);
      expect(dlogvar[i]).toBeCloseTo(fd((l) => gaussianKL(mu, l), lv, i), 6);
    }
  });

  it("is zero at the prior", () => {
    const { dmu, dlogvar } = gaussianKLGrad([0, 0], [0, 0]);
    expect([...dmu, ...dlogvar].every((g) => Math.abs(g) < 1e-12)).toBe(true);
  });
});

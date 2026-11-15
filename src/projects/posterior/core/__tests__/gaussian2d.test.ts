import { describe, expect, it } from "vitest";
import { cholesky2, condition, marginal } from "../gaussian2d";
import type { Gauss2, Mat2 } from "../types";
import { gauss2Pdf } from "../../lib/special";
import { mulberry32, normalSampler } from "../../lib/rng";

const make = (mx: number, my: number, sx: number, sy: number, rho: number): Gauss2 => ({
  mean: [mx, my],
  cov: [[sx * sx, rho * sx * sy], [rho * sx * sy, sy * sy]],
});

const CASES: Gauss2[] = [make(0, 0, 1, 1, 0), make(1, -2, 2, 0.5, 0.8), make(-0.5, 3, 1.3, 2.1, -0.6), make(0, 0, 1, 1, 0.97)];

/** Numerical moments of a 1D density on a grid. */
function moments(f: (u: number) => number, lo: number, hi: number, n = 6000) {
  const h = (hi - lo) / n;
  let z = 0, m = 0, s = 0;
  for (let i = 0; i <= n; i++) { const u = lo + i * h; const w = f(u); z += w; m += w * u; s += w * u * u; }
  m /= z;
  return { mean: m, variance: s / z - m * m };
}

describe("cholesky2 (m3-gaussian)", () => {
  it("is lower triangular with positive diagonal and L Lᵀ = Σ", () => {
    for (const g of CASES) {
      const L = cholesky2(g.cov);
      expect(L[0][1]).toBe(0);
      expect(L[0][0]).toBeGreaterThan(0);
      expect(L[1][1]).toBeGreaterThan(0);
      const LLt: Mat2 = [
        [L[0][0] * L[0][0] + L[0][1] * L[0][1], L[0][0] * L[1][0] + L[0][1] * L[1][1]],
        [L[1][0] * L[0][0] + L[1][1] * L[0][1], L[1][0] * L[1][0] + L[1][1] * L[1][1]],
      ];
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) expect(LLt[i][j]).toBeCloseTo(g.cov[i][j], 10);
    }
  });

  it("samples μ + L z have covariance Σ", () => {
    const g = CASES[1];
    const L = cholesky2(g.cov);
    const z = normalSampler(mulberry32(5));
    const n = 200000;
    let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
    for (let i = 0; i < n; i++) {
      const z0 = z(), z1 = z();
      const x = g.mean[0] + L[0][0] * z0;
      const y = g.mean[1] + L[1][0] * z0 + L[1][1] * z1;
      sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
    }
    const mx = sx / n, my = sy / n;
    expect(sxx / n - mx * mx).toBeCloseTo(g.cov[0][0], 1);
    expect(syy / n - my * my).toBeCloseTo(g.cov[1][1], 1);
    expect(sxy / n - mx * my).toBeCloseTo(g.cov[0][1], 1);
  });
});

describe("marginal (m3-gaussian)", () => {
  it("matches integrating the joint density over the other axis", () => {
    for (const g of CASES.slice(0, 3)) {
      const [mx, my] = g.mean;
      const [[a, c], [, d]] = g.cov;
      for (const axis of [0, 1] as const) {
        const lo = g.mean[axis] - 10 * Math.sqrt(g.cov[axis][axis]);
        const hi = g.mean[axis] + 10 * Math.sqrt(g.cov[axis][axis]);
        const otherLo = g.mean[1 - axis] - 10 * Math.sqrt(g.cov[1 - axis][1 - axis]);
        const otherHi = g.mean[1 - axis] + 10 * Math.sqrt(g.cov[1 - axis][1 - axis]);
        const dens = (u: number) => {
          let s = 0;
          for (let k = 0; k <= 400; k++) {
            const v = otherLo + ((otherHi - otherLo) * k) / 400;
            s += axis === 0 ? gauss2Pdf(u, v, mx, my, a, c, d) : gauss2Pdf(v, u, mx, my, a, c, d);
          }
          return s;
        };
        const num = moments(dens, lo, hi, 1500);
        const got = marginal(g, axis);
        expect(got.mean).toBeCloseTo(num.mean, 4);
        expect(got.variance).toBeCloseTo(num.variance, 3);
      }
    }
  });
});

describe("condition (m3-gaussian)", () => {
  it("matches the normalised slice of the joint density", () => {
    for (const g of CASES) {
      const [mx, my] = g.mean;
      const [[a, c], [, d]] = g.cov;
      for (const observedAxis of [0, 1] as const) {
        for (const value of [g.mean[observedAxis] - 1.3, g.mean[observedAxis] + 0.4]) {
          const other = 1 - observedAxis;
          const sd = Math.sqrt(g.cov[other][other]);
          const slice = (u: number) => (observedAxis === 0 ? gauss2Pdf(value, u, mx, my, a, c, d) : gauss2Pdf(u, value, mx, my, a, c, d));
          const num = moments(slice, g.mean[other] - 12 * sd, g.mean[other] + 12 * sd, 12000);
          const got = condition(g, observedAxis, value);
          expect(got.mean).toBeCloseTo(num.mean, 4);
          expect(got.variance).toBeCloseTo(num.variance, 4);
        }
      }
    }
  });

  it("independent axes: observing x tells you nothing about y", () => {
    const g = make(2, -1, 1.5, 0.7, 0);
    const r = condition(g, 0, 10);
    expect(r.mean).toBeCloseTo(-1, 10);
    expect(r.variance).toBeCloseTo(0.49, 10);
  });

  it("conditioning never increases variance, and the mean moves linearly in the observation", () => {
    for (const g of CASES) {
      const m = marginal(g, 1);
      const r0 = condition(g, 0, 0), r1 = condition(g, 0, 1), r2 = condition(g, 0, 2);
      expect(r0.variance).toBeLessThanOrEqual(m.variance + 1e-12);
      expect(r1.variance).toBeCloseTo(r0.variance, 10);
      expect(r2.mean - r1.mean).toBeCloseTo(r1.mean - r0.mean, 10);
    }
  });
});

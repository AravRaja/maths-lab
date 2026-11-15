import { describe, expect, it } from "vitest";
import { diagGaussianKL } from "../surprise";
import { gaussianKL } from "../kl";
import { normPdf, rand, simpson, vec } from "./helpers";

describe("m5 · diagGaussianKL", () => {
  it("is 0 between identical Gaussians", () => {
    expect(diagGaussianKL([0.3, -1], [0.2, -2], [0.3, -1], [0.2, -2])).toBeCloseTo(0, 12);
  });

  it("matches numerical integration in 1-D", () => {
    for (const [mq, lq, mp, lp] of [[0.5, 0, -0.5, 0], [0, -1, 0, 1], [1, 0.5, -1, -0.5], [2, -2, 0, 0]]) {
      const vq = Math.exp(lq), vp = Math.exp(lp);
      const sd = Math.sqrt(vq);
      const ref = simpson((z) => {
        const q = normPdf(z, mq, vq);
        return q > 0 ? q * Math.log(q / normPdf(z, mp, vp)) : 0;
      }, mq - 12 * sd, mq + 12 * sd, 6000);
      expect(diagGaussianKL([mq], [lq], [mp], [lp])).toBeCloseTo(ref, 6);
    }
  });

  it("is asymmetric", () => {
    const a = diagGaussianKL([0], [-2], [0], [1]);
    const b = diagGaussianKL([0], [1], [0], [-2]);
    expect(Math.abs(a - b)).toBeGreaterThan(0.5);
  });

  it("reduces to gaussianKL against N(0, I)", () => {
    const r = rand(17);
    const mu = vec(r, 3, -2, 2);
    const lv = vec(r, 3, -2, 2);
    expect(diagGaussianKL(mu, lv, [0, 0, 0], [0, 0, 0])).toBeCloseTo(gaussianKL(mu, lv), 10);
  });

  it("is non-negative for random pairs", () => {
    const r = rand(19);
    for (let k = 0; k < 50; k++) expect(diagGaussianKL(vec(r, 2, -2, 2), vec(r, 2, -2, 2), vec(r, 2, -2, 2), vec(r, 2, -2, 2))).toBeGreaterThanOrEqual(-1e-12);
  });
});

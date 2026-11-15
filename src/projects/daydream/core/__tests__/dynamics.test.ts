import { describe, expect, it } from "vitest";
import { gaussianNLL, gaussianNLLGrad } from "../dynamics";
import { fd, normPdf, rand, vec } from "./helpers";

describe("m4 · gaussianNLL", () => {
  it("is −log of the Gaussian density", () => {
    const r = rand(6);
    for (let k = 0; k < 20; k++) {
      const z = vec(r, 3, -2, 2);
      const m = vec(r, 3, -2, 2);
      const lv = vec(r, 3, -3, 2);
      const ref = -z.reduce((s, zi, i) => s + Math.log(normPdf(zi, m[i], Math.exp(lv[i]))), 0);
      expect(gaussianNLL(z, m, lv)).toBeCloseTo(ref, 9);
    }
  });

  it("keeps the constant: ½ log 2π per dimension at z = m, s = 0", () => {
    expect(gaussianNLL([1, -1], [1, -1], [0, 0])).toBeCloseTo(Math.log(2 * Math.PI), 12);
  });

  it("rewards confidence only when the guess is right", () => {
    expect(gaussianNLL([0], [0], [-4])).toBeLessThan(gaussianNLL([0], [0], [0]));
    expect(gaussianNLL([1], [0], [-4])).toBeGreaterThan(gaussianNLL([1], [0], [0]));
  });
});

describe("m4 · gaussianNLLGrad", () => {
  it("matches finite differences (gradient check)", () => {
    const r = rand(13);
    const z = vec(r, 4, -2, 2);
    const m = vec(r, 4, -2, 2);
    const lv = vec(r, 4, -2, 2);
    const { dmean, dlogvar } = gaussianNLLGrad(z, m, lv);
    for (let i = 0; i < 4; i++) {
      expect(dmean[i]).toBeCloseTo(fd((mm) => gaussianNLL(z, mm, lv), m, i), 6);
      expect(dlogvar[i]).toBeCloseTo(fd((ll) => gaussianNLL(z, m, ll), lv, i), 6);
    }
  });

  it("drives a learned variance to the squared error (gradient descent converges)", () => {
    // Fit a single (m, s) to a fixed target by plain gradient descent using your gradient.
    const z = [0.8];
    let m = [0];
    let s = [0];
    for (let k = 0; k < 4000; k++) {
      const g = gaussianNLLGrad(z, m, s);
      m = [m[0] - 0.05 * g.dmean[0] * Math.exp(s[0])];
      s = [s[0] - 0.05 * g.dlogvar[0]];
      if (Math.abs(z[0] - m[0]) < 0.05) break;
    }
    expect(m[0]).toBeCloseTo(0.8, 1);
  });
});

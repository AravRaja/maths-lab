import { describe, expect, it } from "vitest";
import { betaPdf, erfc, gauss2Pdf, lgamma, mixtureLogPdf, normalPdf, normalTail } from "../special";
import { mulberry32, normalSampler } from "../rng";

const trapz = (f: (x: number) => number, lo: number, hi: number, n = 20000) => {
  const h = (hi - lo) / n;
  let s = 0.5 * (f(lo) + f(hi));
  for (let i = 1; i < n; i++) s += f(lo + i * h);
  return s * h;
};

describe("special functions (plumbing)", () => {
  it("lgamma matches factorials and Γ(1/2) = √π", () => {
    expect(lgamma(5)).toBeCloseTo(Math.log(24), 10);
    expect(lgamma(11)).toBeCloseTo(Math.log(3628800), 9);
    expect(lgamma(0.5)).toBeCloseTo(0.5 * Math.log(Math.PI), 10);
  });

  it("densities integrate to one", () => {
    expect(trapz((t) => betaPdf(t, 3, 7), 0, 1)).toBeCloseTo(1, 4);
    expect(trapz((x) => normalPdf(x, 1, 2), -15, 15)).toBeCloseTo(1, 6);
    const m = { weights: [0.3, 0.7], means: [-2, 1], variances: [0.5, 1.5] };
    expect(trapz((x) => Math.exp(mixtureLogPdf(x, m)), -15, 15)).toBeCloseTo(1, 6);
    let s = 0;
    const h = 0.05;
    for (let x = -10; x <= 10; x += h) for (let y = -10; y <= 10; y += h) s += gauss2Pdf(x, y, 0.5, -1, 2, 0.8, 1) * h * h;
    expect(s).toBeCloseTo(1, 3);
  });

  it("erfc and the normal tail", () => {
    expect(erfc(0)).toBeCloseTo(1, 6);
    expect(normalTail(1.959964)).toBeCloseTo(0.025, 5);
    expect(normalTail(4) / 3.1671e-5).toBeCloseTo(1, 3);
  });

  it("the normal sampler has mean 0 and variance 1", () => {
    const z = normalSampler(mulberry32(3));
    let m = 0, v = 0;
    const n = 100000;
    for (let i = 0; i < n; i++) { const x = z(); m += x; v += x * x; }
    expect(m / n).toBeCloseTo(0, 1);
    expect(v / n).toBeCloseTo(1, 1);
  });
});

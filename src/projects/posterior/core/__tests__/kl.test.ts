import { describe, expect, it } from "vitest";
import { klNormal } from "../kl";
import { normalLogPdf } from "../../lib/special";
import { mulberry32 } from "../../lib/rng";

/** KL(p‖q) by brute-force quadrature of p (log p − log q). */
function klNumeric(mp: number, vp: number, mq: number, vq: number) {
  const sd = Math.sqrt(vp);
  const lo = mp - 14 * sd, hi = mp + 14 * sd, n = 40000;
  const h = (hi - lo) / n;
  let s = 0;
  for (let i = 0; i <= n; i++) {
    const x = lo + i * h;
    const lp = normalLogPdf(x, mp, vp);
    s += (i === 0 || i === n ? 0.5 : 1) * Math.exp(lp) * (lp - normalLogPdf(x, mq, vq));
  }
  return s * h;
}

describe("klNormal (m6-kl)", () => {
  it("is zero for identical Gaussians", () => {
    expect(klNormal({ mean: 1.7, variance: 0.3 }, { mean: 1.7, variance: 0.3 })).toBeCloseTo(0, 12);
  });

  it("matches numerical integration", () => {
    const cases: [number, number, number, number][] = [[0, 1, 1, 1], [0, 1, 0, 4], [2, 0.25, -1, 2], [-0.5, 3, 0.5, 0.2]];
    for (const [mp, vp, mq, vq] of cases) {
      expect(klNormal({ mean: mp, variance: vp }, { mean: mq, variance: vq })).toBeCloseTo(klNumeric(mp, vp, mq, vq), 6);
    }
  });

  it("is non-negative and not symmetric", () => {
    const rng = mulberry32(4);
    for (let k = 0; k < 200; k++) {
      const p = { mean: 6 * rng() - 3, variance: 0.05 + 4 * rng() };
      const q = { mean: 6 * rng() - 3, variance: 0.05 + 4 * rng() };
      expect(klNormal(p, q)).toBeGreaterThanOrEqual(-1e-12);
    }
    const a = klNormal({ mean: 0, variance: 0.25 }, { mean: 0, variance: 4 });
    const b = klNormal({ mean: 0, variance: 4 }, { mean: 0, variance: 0.25 });
    expect(Math.abs(a - b)).toBeGreaterThan(1);
  });

  it("grows quadratically in the mean gap for equal variances", () => {
    const k1 = klNormal({ mean: 0, variance: 2 }, { mean: 1, variance: 2 });
    const k3 = klNormal({ mean: 0, variance: 2 }, { mean: 3, variance: 2 });
    expect(k3 / k1).toBeCloseTo(9, 8);
  });
});

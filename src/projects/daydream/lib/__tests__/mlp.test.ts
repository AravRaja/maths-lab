import { describe, expect, it } from "vitest";
import { backward, forward, initParams, paramCount, type MlpSpec } from "../mlp";
import { rng } from "../rng";

// Plumbing test (not a core): the hand-written backward pass agrees with finite differences.
describe("mlp backward", () => {
  for (const act of ["tanh", "relu"] as const) {
    it(`matches finite differences (${act}, two hidden layers)`, () => {
      const spec: MlpSpec = { sizes: [5, 7, 6, 3], act };
      const r = rng(3);
      const p = initParams(spec, r);
      for (let i = 0; i < p.length; i++) p[i] += 0.05 * (r() - 0.5); // non-zero biases
      const x = Array.from({ length: 5 }, () => r() * 2 - 1);
      const c = [0.3, -1.1, 0.7];
      const loss = (pp: Float32Array, xx: ArrayLike<number>) => forward(spec, pp, xx).a[3].reduce((s, v, i) => s + c[i] * v, 0);
      const g = new Float32Array(paramCount(spec));
      const dx = backward(spec, p, forward(spec, p, x), c, g);
      const h = 1e-2;
      const f64 = Float64Array.from(p);
      for (let k = 0; k < p.length; k += 7) {
        const a = Float32Array.from(f64); a[k] += h;
        const b = Float32Array.from(f64); b[k] -= h;
        expect(g[k]).toBeCloseTo((loss(a, x) - loss(b, x)) / (2 * h), 2);
      }
      for (let i = 0; i < 5; i++) {
        const a = x.slice(); a[i] += h;
        const b = x.slice(); b[i] -= h;
        expect(dx[i]).toBeCloseTo((loss(p, a) - loss(p, b)) / (2 * h), 2);
      }
    });
  }
});

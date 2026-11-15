import { describe, expect, it } from "vitest";
import { conditionalPath, conditionalVelocity } from "../path";

const S = 0.02;
const close = (a: number[], b: number[], tol = 1e-9) => {
  expect(a.length).toBe(b.length);
  a.forEach((v, i) => expect(Math.abs(v - b[i])).toBeLessThan(tol));
};

describe("conditionalPath (M1)", () => {
  it("starts at the noise sample", () => {
    close(conditionalPath([0.3, -1.2], [2, 5], 0, S), [0.3, -1.2]);
  });

  it("ends within σ_min · x₀ of the data point", () => {
    const x0 = [1.5, -0.5, 2];
    const x1 = [-1, 4, 0.25];
    close(conditionalPath(x0, x1, 1, S), x1.map((v, i) => v + S * x0[i]));
  });

  it("with σ_min = 0 it is the plain straight line, and hits x₁ exactly", () => {
    close(conditionalPath([2, 0], [0, 2], 0.25, 0), [1.5, 0.5]);
    close(conditionalPath([2, 0], [0, 2], 1, 0), [0, 2]);
  });

  it("is affine in t (equal steps in t give equal steps in space)", () => {
    const x0 = [0.7, -0.3];
    const x1 = [-1.1, 0.9];
    const a = conditionalPath(x0, x1, 0.2, S);
    const b = conditionalPath(x0, x1, 0.5, S);
    const c = conditionalPath(x0, x1, 0.8, S);
    close(b.map((v, i) => v - a[i]), c.map((v, i) => v - b[i]));
  });

  it("works in 16 dimensions and does not mutate its inputs", () => {
    const x0 = Array.from({ length: 16 }, (_, i) => Math.sin(i));
    const x1 = Array.from({ length: 16 }, (_, i) => Math.cos(i));
    const c0 = [...x0];
    const c1 = [...x1];
    const out = conditionalPath(x0, x1, 0.37, S);
    expect(out).toHaveLength(16);
    expect(out).not.toBe(x0);
    close(x0, c0);
    close(x1, c1);
  });

  it("x_t has mean t·x₁ and std 1 − (1 − σ_min) t over random x₀ (Monte Carlo)", () => {
    // Deterministic quasi-normal sample: inverse-CDF-free Box–Muller over a grid.
    const n = 4000;
    const t = 0.6;
    const x1 = [1.5];
    let m = 0;
    let s2 = 0;
    for (let k = 0; k < n; k++) {
      const u1 = (k + 0.5) / n;
      const u2 = ((k * 0.618034) % 1) || 0.5;
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const x = conditionalPath([z], x1, t, S)[0];
      m += x / n;
      s2 += (x * x) / n;
    }
    const sd = Math.sqrt(s2 - m * m);
    expect(Math.abs(m - t * x1[0])).toBeLessThan(0.03);
    expect(Math.abs(sd - (1 - (1 - S) * t))).toBeLessThan(0.03);
  });
});

describe("conditionalVelocity (M1)", () => {
  it("equals d x_t / dt by central differences of your path, at several t", () => {
    const x0 = [0.4, -1.3];
    const x1 = [1.7, 0.6];
    const u = conditionalVelocity(x0, x1, S);
    for (const t of [0.1, 0.5, 0.9]) {
      const h = 1e-5;
      const up = conditionalPath(x0, x1, t + h, S);
      const dn = conditionalPath(x0, x1, t - h, S);
      close(u, up.map((v, i) => (v - dn[i]) / (2 * h)), 1e-6);
    }
  });

  it("a known case: x₀ = (1, 0), x₁ = (0, 1), σ_min = 0 gives (−1, 1)", () => {
    close(conditionalVelocity([1, 0], [0, 1], 0), [-1, 1]);
  });

  it("integrating it for one unit of time gets you from x_0 to x_1 of the path", () => {
    const x0 = [-0.2, 2.1, 0.5];
    const x1 = [1, -1, 0.3];
    const u = conditionalVelocity(x0, x1, S);
    const end = conditionalPath(x0, x1, 1, S);
    close(x0.map((v, i) => v + u[i]), end);
  });
});

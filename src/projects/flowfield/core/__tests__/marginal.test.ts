import { describe, expect, it } from "vitest";
import { marginalVelocity } from "../marginal";

const S = 0.05;
/** The path from the M1 spec, written out here so these tests do not depend on your M1 code. */
const path = (x0: number[], x1: number[], t: number) => x0.map((v, i) => (1 - (1 - S) * t) * v + t * x1[i]);

describe("marginalVelocity (M2)", () => {
  it("one data point: the field moves every point along its straight line", () => {
    const a = [1.2, -0.7];
    for (const [x0, t] of [[[0.3, 0.9], 0.2], [[-1.5, 0.1], 0.6], [[2, -2], 0.9]] as [number[], number][]) {
      const x = path(x0, a, t);
      const h = 1e-6;
      const up = path(x0, a, t + h);
      const dn = path(x0, a, t - h);
      const dxdt = up.map((v, i) => (v - dn[i]) / (2 * h));
      const u = marginalVelocity(x, t, [a], S);
      u.forEach((v, i) => expect(Math.abs(v - dxdt[i])).toBeLessThan(1e-6));
    }
  });

  it("two symmetric points: zero velocity at the midpoint", () => {
    const u = marginalVelocity([0, 0], 0.5, [[1, 0.5], [-1, -0.5]], S);
    u.forEach((v) => expect(Math.abs(v)).toBeLessThan(1e-12));
  });

  it("does not care about the order of the data", () => {
    const data = [[1, 0], [0, 1], [-1, -1], [0.3, 0.2]];
    const a = marginalVelocity([0.2, -0.4], 0.7, data, S);
    const b = marginalVelocity([0.2, -0.4], 0.7, [...data].reverse(), S);
    a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 10));
  });

  it("duplicating every data point changes nothing", () => {
    const data = [[1, 0], [-0.5, 0.8]];
    const a = marginalVelocity([0.1, 0.1], 0.4, data, S);
    const b = marginalVelocity([0.1, 0.1], 0.4, [...data, ...data], S);
    a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 10));
  });

  it("stays finite far from the data and close to t = 1 (log-sum-exp)", () => {
    const u = marginalVelocity([40, -35], 0.98, [[1, 0], [0, 1]], 0.01);
    u.forEach((v) => expect(Number.isFinite(v)).toBe(true));
  });

  it("near t = 1, a point next to one data point heads for that point", () => {
    const data = [[1, 1], [-1, -1], [1, -1]];
    const x = [0.95, 0.97];
    const t = 0.97;
    const u = marginalVelocity(x, t, data, S);
    // one small Euler step must bring x closer to (1, 1)
    const y = x.map((v, i) => v + 0.01 * u[i]);
    expect(Math.hypot(y[0] - 1, y[1] - 1)).toBeLessThan(Math.hypot(x[0] - 1, x[1] - 1));
  });

  it("satisfies the continuity equation ∂p/∂t + ∇·(p u) = 0 (finite differences)", () => {
    const data = [[0.8, 0.1], [-0.6, 0.7], [0.1, -0.9]];
    const sigma = (t: number) => 1 - (1 - S) * t;
    const p = (x: number[], t: number) => {
      const s = sigma(t);
      let sum = 0;
      for (const d of data) {
        const r2 = (x[0] - t * d[0]) ** 2 + (x[1] - t * d[1]) ** 2;
        sum += Math.exp(-r2 / (2 * s * s)) / (2 * Math.PI * s * s);
      }
      return sum / data.length;
    };
    const flux = (x: number[], t: number) => {
      const u = marginalVelocity(x, t, data, S);
      const px = p(x, t);
      return [px * u[0], px * u[1]];
    };
    const h = 1e-4;
    for (const [x, t] of [[[0.2, 0.1], 0.3], [[-0.3, 0.4], 0.6], [[0.5, -0.5], 0.75]] as [number[], number][]) {
      const dpdt = (p(x, t + h) - p(x, t - h)) / (2 * h);
      const div =
        (flux([x[0] + h, x[1]], t)[0] - flux([x[0] - h, x[1]], t)[0]) / (2 * h) +
        (flux([x[0], x[1] + h], t)[1] - flux([x[0], x[1] - h], t)[1]) / (2 * h);
      const scale = Math.abs(dpdt) + Math.abs(div) + 1e-3;
      expect(Math.abs(dpdt + div) / scale).toBeLessThan(1e-4);
    }
  });
});

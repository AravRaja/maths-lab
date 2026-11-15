import { describe, expect, it } from "vitest";
import { eulerSample, flowPair } from "../flow";

/*
 * Flow matching: the straight-line path's endpoints and velocity (checked by
 * finite differences in t), and forward Euler against closed-form ODE answers.
 */

const z = [0.8, -1.3], a = [-0.2, 0.6];

describe("flowPair", () => {
  it("starts at the noise and ends at the action", () => {
    const p0 = flowPair(z, a, 0), p1 = flowPair(z, a, 1);
    p0.xt.forEach((v, i) => expect(v).toBeCloseTo(z[i], 14));
    p1.xt.forEach((v, i) => expect(v).toBeCloseTo(a[i], 14));
  });

  it("interpolates linearly", () => {
    const p = flowPair(z, a, 0.25);
    p.xt.forEach((v, i) => expect(v).toBeCloseTo(0.75 * z[i] + 0.25 * a[i], 14));
  });

  it("targets dx_t/dt (central finite differences in t)", () => {
    const h = 1e-6;
    for (const t of [0.1, 0.5, 0.9]) {
      const up = flowPair(z, a, t + h).xt, dn = flowPair(z, a, t - h).xt;
      flowPair(z, a, t).target.forEach((v, i) => expect(v).toBeCloseTo((up[i] - dn[i]) / (2 * h), 7));
    }
  });

  it("has a target that does not depend on t", () => {
    const u1 = flowPair(z, a, 0.13).target, u2 = flowPair(z, a, 0.87).target;
    u1.forEach((v, i) => expect(v).toBeCloseTo(u2[i], 14));
  });
});

describe("eulerSample", () => {
  it("returns steps + 1 points starting at x0", () => {
    const path = eulerSample(() => [0, 0], [1, 2], 5);
    expect(path).toHaveLength(6);
    expect(path[0]).toEqual([1, 2]);
  });

  it("does not mutate x0", () => {
    const x0 = [1, 2];
    eulerSample(() => [1, 1], x0, 4);
    expect(x0).toEqual([1, 2]);
  });

  it("is exact for a constant field, in one step", () => {
    const c = [0.4, -1.1];
    const path = eulerSample(() => c, z, 1);
    path[1].forEach((v, i) => expect(v).toBeCloseTo(z[i] + c[i], 14));
  });

  it("evaluates the field at t = kΔ", () => {
    const ts: number[] = [];
    eulerSample((x, t) => { ts.push(t); return [0]; }, [0], 4);
    expect(ts).toEqual([0, 0.25, 0.5, 0.75]);
  });

  it("matches the closed form (1 − 1/N)^N for dx/dt = −x", () => {
    for (const N of [1, 2, 5, 20]) {
      const path = eulerSample((x) => x.map((v) => -v), [3], N);
      expect(path[N][0]).toBeCloseTo(3 * (1 - 1 / N) ** N, 12);
    }
  });

  it("records every intermediate point as its own array: x_k = x0 (1 − 1/N)^k for dx/dt = −x", () => {
    const N = 6;
    const path = eulerSample((x) => x.map((v) => -v), [3], N);
    for (let k = 0; k <= N; k++) expect(path[k][0]).toBeCloseTo(3 * (1 - 1 / N) ** k, 12);
  });

  it("converges at first order: doubling N about halves the error", () => {
    const err = (N: number) => Math.abs(eulerSample((x) => x.map((v) => -v), [1], N)[N][0] - Math.exp(-1));
    const ratio = err(100) / err(200);
    expect(ratio).toBeGreaterThan(1.9);
    expect(ratio).toBeLessThan(2.1);
  });

  it("integrates time-dependent fields: dx/dt = 2t gives x(1) → x0 + 1", () => {
    const path = eulerSample((x, t) => [2 * t], [0], 1000);
    expect(path[1000][0]).toBeCloseTo(1, 2);
  });
});

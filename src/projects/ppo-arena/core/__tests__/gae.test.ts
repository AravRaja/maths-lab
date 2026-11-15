import { describe, expect, it } from "vitest";
import { gae } from "../gae";

/*
 * GAE: hand-worked δs, the λ = 0 (one-step TD) and λ = 1 (Monte Carlo minus baseline) limits,
 * episode resets, bootstrapping, and the recursion Â_t = δ_t + γλ(1 − d_t) Â_{t+1}.
 * The tests compute the λ = 1 reference inline, so they do not need M1 to be written.
 */

const F = false, T = true;

function mcReturns(rs: number[], ds: boolean[], g: number, last: number) {
  const out = new Array<number>(rs.length);
  for (let t = 0; t < rs.length; t++) {
    let acc = 0, disc = 1, k = t, ended = false;
    for (; k < rs.length; k++) {
      acc += disc * rs[k];
      disc *= g;
      if (ds[k]) { ended = true; break; }
    }
    if (!ended) acc += disc * last;
    out[t] = acc;
  }
  return out;
}

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

describe("gae", () => {
  it("is empty for an empty rollout and returns one advantage per step", () => {
    expect(gae([], [], [], 0.99, 0.95)).toEqual([]);
    expect(gae([1, 1, 1], [0, 0, 0], [F, F, T], 0.9, 0.9)).toHaveLength(3);
  });

  it("matches a hand-worked two-step trace", () => {
    // γ = 0.5, λ = 0.5. V = [1, 2], terminal at the end.
    // δ_1 = 1 − 2 = −1.        Â_1 = −1
    // δ_0 = 1 + 0.5·2 − 1 = 1. Â_0 = 1 + 0.25·(−1) = 0.75
    const a = gae([1, 1], [1, 2], [F, T], 0.5, 0.5);
    expect(a[1]).toBeCloseTo(-1, 12);
    expect(a[0]).toBeCloseTo(0.75, 12);
  });

  it("is the one-step TD residual when λ = 0", () => {
    const rs = [0.5, 1, -1, 2], vs = [0.1, 0.4, -0.3, 0.8], ds = [F, F, F, F], g = 0.9, last = 0.6;
    const a = gae(rs, vs, ds, g, 0, last);
    for (let t = 0; t < 4; t++) {
      const vNext = t === 3 ? last : vs[t + 1];
      expect(a[t]).toBeCloseTo(rs[t] + g * vNext - vs[t], 12);
    }
  });

  it("is the Monte Carlo return minus the baseline when λ = 1", () => {
    const r = rng(11);
    const n = 120, g = 0.97, last = 3.2;
    const rs = Array.from({ length: n }, () => r() * 2 - 1);
    const vs = Array.from({ length: n }, () => r() * 4 - 2);
    const ds = Array.from({ length: n }, () => r() < 0.06);
    const a = gae(rs, vs, ds, g, 1, last);
    const G = mcReturns(rs, ds, g, last);
    for (let t = 0; t < n; t++) expect(a[t] + vs[t]).toBeCloseTo(G[t], 8);
  });

  it("does not bootstrap across a terminal step", () => {
    // Episode 1 ends at t = 0. Its advantage must ignore V(s_1) and everything after.
    const a = gae([1, 0, 0], [0.2, 50, 50], [T, F, T], 0.9, 0.95);
    expect(a[0]).toBeCloseTo(1 - 0.2, 12);
  });

  it("bootstraps the final unfinished step with lastValue, and ignores it after a terminal", () => {
    const a = gae([1], [0.5], [F], 0.9, 0.95, 4);
    expect(a[0]).toBeCloseTo(1 + 0.9 * 4 - 0.5, 12);
    expect(gae([1], [0.5], [T], 0.9, 0.95, 4)[0]).toBeCloseTo(0.5, 12);
  });

  it("is all zeros when the critic is exact on a deterministic chain", () => {
    // Reward 1 each step, terminal after n. Exact V(s_t) = (1 − γ^{n−t}) / (1 − γ).
    const n = 30, g = 0.9;
    const vs = Array.from({ length: n }, (_, t) => (1 - g ** (n - t)) / (1 - g));
    const ds = Array.from({ length: n }, (_, t) => t === n - 1);
    for (const lam of [0, 0.5, 0.95, 1]) {
      const a = gae(new Array(n).fill(1), vs, ds, g, lam);
      for (const x of a) expect(Math.abs(x)).toBeLessThan(1e-9);
    }
  });

  it("satisfies Â_t = δ_t + γλ(1 − d_t) Â_{t+1}", () => {
    const r = rng(5);
    const n = 150, g = 0.99, lam = 0.9, last = -1.5;
    const rs = Array.from({ length: n }, () => r());
    const vs = Array.from({ length: n }, () => r() * 3);
    const ds = Array.from({ length: n }, () => r() < 0.04);
    const a = gae(rs, vs, ds, g, lam, last);
    for (let t = 0; t < n; t++) {
      const nd = ds[t] ? 0 : 1;
      const vNext = t === n - 1 ? last : vs[t + 1];
      const aNext = t === n - 1 ? 0 : a[t + 1];
      const delta = rs[t] + g * nd * vNext - vs[t];
      expect(a[t]).toBeCloseTo(delta + g * lam * nd * aNext, 9);
    }
  });
});

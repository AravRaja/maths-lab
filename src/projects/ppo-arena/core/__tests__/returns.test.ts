import { describe, expect, it } from "vitest";
import { discountedReturns } from "../returns";

/*
 * Return-to-go: hand-worked traces, the geometric series, episode resets at dones,
 * bootstrapping the final unfinished episode, and the recursion G_t = r_t + γ G_{t+1}.
 */

const F = false, T = true;

describe("discountedReturns", () => {
  it("is empty for an empty rollout", () => {
    expect(discountedReturns([], [], 0.9)).toEqual([]);
  });

  it("returns one value per step and does not mutate its inputs", () => {
    const rs = [1, 2, 3];
    const ds = [F, F, T];
    const out = discountedReturns(rs, ds, 0.5);
    expect(out).toHaveLength(3);
    expect(rs).toEqual([1, 2, 3]);
    expect(ds).toEqual([F, F, T]);
  });

  it("matches a hand-worked trace", () => {
    const g = discountedReturns([1, 2, 3], [F, F, T], 0.5);
    expect(g[2]).toBeCloseTo(3, 12);
    expect(g[1]).toBeCloseTo(2 + 0.5 * 3, 12);
    expect(g[0]).toBeCloseTo(1 + 0.5 * 2 + 0.25 * 3, 12);
  });

  it("matches the geometric series for constant reward to a terminal", () => {
    const n = 60, g = 0.97;
    const out = discountedReturns(new Array(n).fill(1), [...new Array(n - 1).fill(F), T], g);
    expect(out[0]).toBeCloseTo((1 - g ** n) / (1 - g), 10);
    expect(out[n - 1]).toBeCloseTo(1, 12);
  });

  it("counts steps when γ = 1 and only the immediate reward when γ = 0", () => {
    expect(discountedReturns([1, 1, 1, 1], [F, F, F, T], 1)).toEqual([4, 3, 2, 1]);
    expect(discountedReturns([2, 5, 7], [F, F, T], 0)).toEqual([2, 5, 7]);
  });

  it("resets at an episode boundary", () => {
    // Two episodes: [1, 1] then [10, 10]. The first episode must not see the 10s.
    const g = discountedReturns([1, 1, 10, 10], [F, T, F, T], 0.9);
    expect(g[1]).toBeCloseTo(1, 12);
    expect(g[0]).toBeCloseTo(1 + 0.9, 12);
    expect(g[3]).toBeCloseTo(10, 12);
    expect(g[2]).toBeCloseTo(10 + 9, 12);
  });

  it("bootstraps the unfinished tail with lastValue", () => {
    const g = discountedReturns([1, 1], [F, F], 0.5, 8);
    expect(g[1]).toBeCloseTo(1 + 0.5 * 8, 12);
    expect(g[0]).toBeCloseTo(1 + 0.5 * (1 + 0.5 * 8), 12);
  });

  it("ignores lastValue when the rollout ends on a terminal step", () => {
    expect(discountedReturns([1, 1], [F, T], 0.5, 1000)).toEqual(discountedReturns([1, 1], [F, T], 0.5, 0));
  });

  it("defaults lastValue to 0", () => {
    expect(discountedReturns([1, 1], [F, F], 0.5)).toEqual(discountedReturns([1, 1], [F, F], 0.5, 0));
  });

  it("satisfies G_t = r_t + γ (1 − d_t) G_{t+1} on a random rollout", () => {
    let s = 3;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const n = 200, g = 0.95, last = 2.5;
    const rs = Array.from({ length: n }, () => rnd() * 2 - 0.5);
    const ds = Array.from({ length: n }, () => rnd() < 0.05);
    const G = discountedReturns(rs, ds, g, last);
    for (let t = 0; t < n; t++) {
      const next = t === n - 1 ? last : G[t + 1];
      expect(G[t]).toBeCloseTo(rs[t] + g * (ds[t] ? 0 : next), 9);
    }
  });
});

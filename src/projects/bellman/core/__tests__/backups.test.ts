import { describe, expect, it } from "vitest";
import { bellmanExpectationBackup, bellmanOptimalityBackup } from "../backups";
import { lookahead } from "../lookahead";
import { uniformPolicy, oneHot } from "../../lib/policy";
import { aima, corridor, maxAbsDiff, seeded, twoState } from "./fixtures";

const randVec = (n: number, r: () => number, scale = 5) => Float64Array.from({ length: n }, () => (r() - 0.5) * 2 * scale);

describe("bellmanExpectationBackup", () => {
  it("one sweep of the uniform policy on the two-state MDP (hand calculation)", () => {
    // From the lookahead hand calc Q = [0.25, 1, 0.5, 1.85]; uniform π averages each row.
    const V = bellmanExpectationBackup(twoState(), [1, -2], uniformPolicy(2, 2), 0.5);
    expect(V[0]).toBeCloseTo(0.625, 12);
    expect(V[1]).toBeCloseTo(1.175, 12);
  });

  it("is synchronous and does not mutate V", () => {
    const V = new Float64Array([1, -2]);
    const out = bellmanExpectationBackup(twoState(), V, uniformPolicy(2, 2), 0.5);
    expect(out).not.toBe(V);
    expect(Array.from(V)).toEqual([1, -2]);
  });

  it("with a one-hot policy it picks that action's Q", () => {
    const m = twoState();
    const V = [0.7, -1.3];
    const Q = lookahead(m, V, 0.8);
    const out = bellmanExpectationBackup(m, V, oneHot([1, 0], 2), 0.8);
    expect(out[0]).toBeCloseTo(Q[1], 12);
    expect(out[1]).toBeCloseTo(Q[2], 12);
  });

  it("repeated sweeps converge to V^π = (I − γP_π)⁻¹ r_π   (965/88, 945/88)", () => {
    let V: Float64Array = new Float64Array(2);
    const pi = uniformPolicy(2, 2);
    for (let k = 0; k < 600; k++) V = bellmanExpectationBackup(twoState(), V, pi, 0.9);
    expect(V[0]).toBeCloseTo(965 / 88, 8);
    expect(V[1]).toBeCloseTo(945 / 88, 8);
  });

  it("is a γ-contraction in the sup norm", () => {
    const r = seeded(7);
    const m = aima();
    const pi = uniformPolicy(m.nS, m.nA);
    for (let t = 0; t < 20; t++) {
      const V = randVec(m.nS, r), W = randVec(m.nS, r);
      const d = maxAbsDiff(bellmanExpectationBackup(m, V, pi, 0.9), bellmanExpectationBackup(m, W, pi, 0.9));
      expect(d).toBeLessThanOrEqual(0.9 * maxAbsDiff(V, W) + 1e-12);
    }
  });

  it("keeps absorbing states at 0", () => {
    const m = aima();
    const out = bellmanExpectationBackup(m, new Float64Array(m.nS), uniformPolicy(m.nS, m.nA), 1);
    expect(out[3]).toBe(0); // goal
    expect(out[7]).toBe(0); // pit
  });
});

describe("bellmanOptimalityBackup", () => {
  it("one sweep on the two-state MDP takes the max of each Q row", () => {
    const V = bellmanOptimalityBackup(twoState(), [1, -2], 0.5);
    expect(V[0]).toBeCloseTo(1, 12);
    expect(V[1]).toBeCloseTo(1.85, 12);
  });

  it("does not mutate V", () => {
    const V = new Float64Array([1, -2]);
    bellmanOptimalityBackup(twoState(), V, 0.5);
    expect(Array.from(V)).toEqual([1, -2]);
  });

  it("V* = (3080/163, 3060/163) is its fixed point", () => {
    const Vs = [3080 / 163, 3060 / 163];
    const out = bellmanOptimalityBackup(twoState(), Vs, 0.9);
    expect(out[0]).toBeCloseTo(Vs[0], 10);
    expect(out[1]).toBeCloseTo(Vs[1], 10);
  });

  it("dominates every policy's backup: T*V ≥ T^π V", () => {
    const r = seeded(3);
    const m = aima();
    for (let t = 0; t < 10; t++) {
      const V = randVec(m.nS, r);
      const star = bellmanOptimalityBackup(m, V, 0.95);
      const pi = bellmanExpectationBackup(m, V, uniformPolicy(m.nS, m.nA), 0.95);
      for (let s = 0; s < m.nS; s++) expect(star[s]).toBeGreaterThanOrEqual(pi[s] - 1e-12);
    }
  });

  it("is a γ-contraction in the sup norm", () => {
    const r = seeded(11);
    const m = aima();
    for (let t = 0; t < 20; t++) {
      const V = randVec(m.nS, r), W = randVec(m.nS, r);
      const d = maxAbsDiff(bellmanOptimalityBackup(m, V, 0.8), bellmanOptimalityBackup(m, W, 0.8));
      expect(d).toBeLessThanOrEqual(0.8 * maxAbsDiff(V, W) + 1e-12);
    }
  });

  it("is monotone: V ≤ W ⇒ T*V ≤ T*W", () => {
    const r = seeded(5);
    const m = aima();
    for (let t = 0; t < 10; t++) {
      const V = randVec(m.nS, r);
      const W = V.map((v) => v + r() * 2);
      const a = bellmanOptimalityBackup(m, V, 0.9), b = bellmanOptimalityBackup(m, W, 0.9);
      for (let s = 0; s < m.nS; s++) expect(a[s]).toBeLessThanOrEqual(b[s] + 1e-12);
    }
  });

  it("news of the goal travels one cell per sweep in a corridor", () => {
    const m = corridor(7);
    let V: Float64Array = new Float64Array(7);
    for (let k = 1; k <= 4; k++) {
      V = bellmanOptimalityBackup(m, V, 0.9);
      const lit = Array.from(V).filter((v) => v > 0).length;
      expect(lit).toBe(k);
    }
  });
});

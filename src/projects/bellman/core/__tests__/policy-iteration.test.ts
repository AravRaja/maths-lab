import { describe, expect, it } from "vitest";
import { policyIteration } from "../policy-iteration";
import { greedyPolicy, lookahead } from "../lookahead";
import { aima, AIMA_PI, AIMA_U, corridor, maxAbsDiff, twoState } from "./fixtures";

describe("policyIteration", () => {
  it("two-state MDP: always take action 1, with V = V*", () => {
    const r = policyIteration(twoState(), 0.9);
    expect(Array.from(r.policy)).toEqual([1, 1]);
    expect(r.V[0]).toBeCloseTo(3080 / 163, 6);
    expect(r.V[1]).toBeCloseTo(3060 / 163, 6);
  });

  it("starts from 'always up' and records each round", () => {
    const r = policyIteration(corridor(6), 0.9);
    expect(Array.from(r.rounds[0].policy)).toEqual(new Array(6).fill(0));
    expect(r.rounds.length).toBeGreaterThanOrEqual(2);
    r.rounds.forEach((round) => {
      expect(round.V).toHaveLength(6);
      expect(round.evalSweeps).toBeGreaterThan(0);
    });
    expect(Array.from(r.rounds[r.rounds.length - 1].policy)).toEqual(Array.from(r.policy));
  });

  it("corridor: every live cell goes right", () => {
    const r = policyIteration(corridor(6), 0.9);
    expect(Array.from(r.policy).slice(0, 5)).toEqual([1, 1, 1, 1, 1]);
  });

  it("policy improvement theorem: values never go down from round to round", () => {
    const r = policyIteration(aima(), 0.95);
    for (let k = 0; k + 1 < r.rounds.length; k++) {
      const a = r.rounds[k].V, b = r.rounds[k + 1].V;
      for (let s = 0; s < a.length; s++) expect(b[s]).toBeGreaterThanOrEqual(a[s] - 1e-6);
    }
  });

  it("terminates in a handful of rounds (far fewer than value-iteration sweeps)", () => {
    expect(policyIteration(aima(), 0.95).rounds.length).toBeLessThan(10);
  });

  it("finds Russell & Norvig's optimal policy and utilities on the 4×3 world (γ = 1)", () => {
    const r = policyIteration(aima(), 1, { evalTol: 1e-12 });
    for (const [s, a] of Object.entries(AIMA_PI)) expect(r.policy[+s]).toBe(a);
    for (const [s, u] of Object.entries(AIMA_U)) expect(r.V[+s] - 0.04).toBeCloseTo(u, 3);
  });

  it("the answer is stable: greedy w.r.t. its own value gives the same policy", () => {
    const m = aima();
    const r = policyIteration(m, 0.9);
    expect(Array.from(greedyPolicy(lookahead(m, r.V, 0.9), m.nA))).toEqual(Array.from(r.policy));
    expect(maxAbsDiff(r.V, r.rounds[r.rounds.length - 1].V)).toBeLessThan(1e-9);
  });
});

import { describe, expect, it } from "vitest";
import { valueIteration } from "../value-iteration";
import { aima, AIMA_U, corridor, twoState } from "./fixtures";

describe("valueIteration", () => {
  it("deterministic corridor: V*(s) = γ^(d − 1), d = steps to the goal", () => {
    const n = 7, g = 0.9;
    const { V } = valueIteration(corridor(n), g, { tol: 1e-12 });
    for (let s = 0; s < n - 1; s++) expect(V[s]).toBeCloseTo(g ** (n - 2 - s), 10);
    expect(V[n - 1]).toBe(0);
  });

  it("records every iterate: sweeps[0] = 0 and sweeps.length = deltas.length + 1", () => {
    const r = valueIteration(corridor(6), 0.9, { tol: 1e-9 });
    expect(Array.from(r.sweeps[0])).toEqual(new Array(6).fill(0));
    expect(r.sweeps.length).toBe(r.deltas.length + 1);
    expect(Array.from(r.sweeps[r.sweeps.length - 1])).toEqual(Array.from(r.V));
  });

  it("stops as soon as the sup-norm change drops below tol", () => {
    const r = valueIteration(twoState(), 0.9, { tol: 1e-6 });
    expect(r.deltas[r.deltas.length - 1]).toBeLessThan(1e-6);
    r.deltas.slice(0, -1).forEach((d) => expect(d).toBeGreaterThanOrEqual(1e-6));
  });

  it("successive changes shrink by at least γ (contraction)", () => {
    const g = 0.9;
    const { deltas } = valueIteration(aima(), g, { tol: 1e-10 });
    for (let k = 0; k + 1 < deltas.length; k++) expect(deltas[k + 1]).toBeLessThanOrEqual(g * deltas[k] + 1e-12);
  });

  it("respects maxSweeps", () => {
    const r = valueIteration(twoState(), 0.99, { tol: 0, maxSweeps: 25 });
    expect(r.deltas.length).toBe(25);
  });

  it("two-state MDP: V* = (3080/163, 3060/163)", () => {
    const { V } = valueIteration(twoState(), 0.9, { tol: 1e-12, maxSweeps: 5000 });
    expect(V[0]).toBeCloseTo(3080 / 163, 8);
    expect(V[1]).toBeCloseTo(3060 / 163, 8);
  });

  it("reproduces Russell & Norvig's 4×3 utilities (γ = 1) to 3 dp", () => {
    const { V } = valueIteration(aima(), 1, { tol: 1e-12, maxSweeps: 5000 });
    for (const [s, u] of Object.entries(AIMA_U)) expect(V[+s] - 0.04).toBeCloseTo(u, 3);
  });
});

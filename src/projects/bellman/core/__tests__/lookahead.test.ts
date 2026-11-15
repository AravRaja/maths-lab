import { describe, expect, it } from "vitest";
import { greedyPolicy, lookahead } from "../lookahead";
import { corridor, twoState } from "./fixtures";

describe("lookahead", () => {
  it("has shape nS·nA, laid out Q[s·nA + a]", () => {
    const m = corridor(5);
    expect(lookahead(m, new Float64Array(5), 0.9)).toHaveLength(5 * 4);
  });

  it("matches a hand calculation on the two-state MDP", () => {
    // V = [1, −2], γ = ½:
    //   Q(0,0) = ½(1 + ½·1) + ½(0 + ½·(−2)) = 0.25      Q(0,1) = 2 + ½·(−2) = 1
    //   Q(1,0) = 0 + ½·1 = 0.5                          Q(1,1) = 0.3(−1 − 1) + 0.7(3 + 0.5) = 1.85
    const Q = lookahead(twoState(), [1, -2], 0.5);
    [0.25, 1, 0.5, 1.85].forEach((q, i) => expect(Q[i]).toBeCloseTo(q, 12));
  });

  it("γ = 0 gives the expected immediate reward", () => {
    const Q = lookahead(twoState(), [100, -100], 0);
    [0.5, 2, 0, 0.3 * -1 + 0.7 * 3].forEach((q, i) => expect(Q[i]).toBeCloseTo(q, 12));
  });

  it("next to the goal in a deterministic corridor: stepping in is worth the goal reward", () => {
    const m = corridor(4); // . . . G
    const Q = lookahead(m, new Float64Array(4), 0.9);
    expect(Q[2 * 4 + 1]).toBeCloseTo(1, 12); // right, into G
    expect(Q[2 * 4 + 0]).toBeCloseTo(0, 12); // up bumps the edge
    expect(Q[2 * 4 + 3]).toBeCloseTo(0, 12); // left
  });

  it("discounts V(s′) by γ", () => {
    const m = corridor(4);
    const V = new Float64Array([0, 0, 2, 0]);
    const Q = lookahead(m, V, 0.5);
    expect(Q[1 * 4 + 1]).toBeCloseTo(1, 12); // 0 + ½·2
    expect(Q[2 * 4 + 0]).toBeCloseTo(1, 12); // bump: stays in s=2, ½·2
  });

  it("does not mutate V", () => {
    const V = new Float64Array([1, -2]);
    lookahead(twoState(), V, 0.9);
    expect(Array.from(V)).toEqual([1, -2]);
  });
});

describe("greedyPolicy", () => {
  it("picks argmax per state", () => {
    expect(Array.from(greedyPolicy([0, 3, 1, 2, 9, 8, -1, -5], 4))).toEqual([1, 0]);
  });

  it("breaks ties toward the lowest action index", () => {
    expect(Array.from(greedyPolicy([1, 5, 5, 0, 2, 2, 2, 2], 4))).toEqual([1, 0]);
  });

  it("handles negative values and returns an Int32Array of length nS", () => {
    const pi = greedyPolicy([-3, -1, -2, -9, -9, -9], 3);
    expect(pi).toBeInstanceOf(Int32Array);
    expect(Array.from(pi)).toEqual([1, 0]);
  });
});

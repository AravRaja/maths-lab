import { describe, expect, it } from "vitest";
import { qLearningUpdate, td0Update } from "../td";
import { corridor, seeded } from "./fixtures";

describe("td0Update", () => {
  it("moves V(s) by α·δ toward r + γV(s′) and returns δ", () => {
    const V = new Float64Array([0.5, 2]);
    const d = td0Update(V, 0, 1, 1, false, 0.1, 0.9);
    expect(d).toBeCloseTo(1 + 0.9 * 2 - 0.5, 12);
    expect(V[0]).toBeCloseTo(0.5 + 0.1 * 2.3, 12);
    expect(V[1]).toBe(2);
  });

  it("on termination the target is just r", () => {
    const V = new Float64Array([0.5, 100]);
    const d = td0Update(V, 0, 1, 1, true, 0.5, 0.9);
    expect(d).toBeCloseTo(0.5, 12);
    expect(V[0]).toBeCloseTo(0.75, 12);
  });

  it("α = 1 replaces V(s) with the target", () => {
    const V = new Float64Array([3, 1]);
    td0Update(V, 0, -1, 1, false, 1, 0.5);
    expect(V[0]).toBeCloseTo(-0.5, 12);
  });

  it("learns Sutton & Barto's 5-state random walk (true values 1/6 … 5/6)", () => {
    // States 1..5 are A..E, 0 and 6 are terminal. Start at C, step left/right with prob ½.
    // Reward 1 for exiting right, 0 otherwise; γ = 1.
    const V = new Float64Array(7).fill(0.5);
    V[0] = V[6] = 0;
    const r = seeded(4);
    const errs: number[] = [];
    for (let ep = 0; ep < 3000; ep++) {
      let s = 3;
      while (s !== 0 && s !== 6) {
        const s2 = r() < 0.5 ? s - 1 : s + 1;
        td0Update(V, s, s2 === 6 ? 1 : 0, s2, s2 === 0 || s2 === 6, 0.02, 1);
        s = s2;
      }
      if (ep >= 2000) {
        let se = 0;
        for (let i = 1; i <= 5; i++) se += (V[i] - i / 6) ** 2;
        errs.push(Math.sqrt(se / 5));
      }
    }
    const rms = errs.reduce((a, b) => a + b, 0) / errs.length;
    expect(rms).toBeLessThan(0.05);
  });
});

describe("qLearningUpdate", () => {
  it("bootstraps from max_a′ Q(s′, a′) and returns δ", () => {
    const Q = new Float64Array([0, 0, 1, -2, 3, 0.5]); // nA = 3, states 0 and 1
    const d = qLearningUpdate(Q, 3, 0, 1, 0.5, 1, false, 0.5, 0.9);
    expect(d).toBeCloseTo(0.5 + 0.9 * 3 - 0, 12);
    expect(Q[1]).toBeCloseTo(0.5 * d, 12);
  });

  it("only touches Q(s, a)", () => {
    const Q = new Float64Array([1, 2, 3, 4, 5, 6]);
    qLearningUpdate(Q, 3, 1, 2, 1, 0, false, 0.3, 0.9);
    expect(Array.from(Q).slice(0, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("on termination the target is just r", () => {
    const Q = new Float64Array([0, 0, 50, 50]);
    const d = qLearningUpdate(Q, 2, 0, 0, -1, 1, true, 1, 0.9);
    expect(d).toBeCloseTo(-1, 12);
    expect(Q[0]).toBeCloseTo(-1, 12);
  });

  it("off-policy: a uniformly random behaviour policy still learns Q* on a corridor", () => {
    // Q*(s, right) = γ^(d−1), and bumping the edge (up) keeps you in place: Q*(s, up) = γ·V*(s).
    const n = 6, nA = 4, g = 0.9;
    const m = corridor(n);
    const Q = new Float64Array(n * nA);
    const r = seeded(8);
    for (let ep = 0; ep < 4000; ep++) {
      let s = Math.floor(r() * (n - 1));
      for (let t = 0; t < 60 && !m.terminal[s]; t++) {
        const a = Math.floor(r() * nA);
        const o = m.outcomes[s * nA + a][0];
        qLearningUpdate(Q, nA, s, a, o.reward, o.next, m.terminal[o.next] === 1, 0.2, g);
        s = o.next;
      }
    }
    for (let s = 0; s < n - 1; s++) {
      const vStar = g ** (n - 2 - s);
      expect(Q[s * nA + 1]).toBeCloseTo(vStar, 3);
      expect(Q[s * nA + 0]).toBeCloseTo(g * vStar, 3);
    }
  });
});

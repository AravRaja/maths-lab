import { describe, expect, it } from "vitest";
import { discountedReturn, shapedRewards } from "../reward";

/*
 * Returns and potential-based shaping: closed forms and the telescoping
 * identity G' = G + γ^T Φ(s_T) − Φ(s_0) that makes shaping policy-invariant.
 */

describe("discountedReturn", () => {
  it("is 0 for an empty trace", () => {
    expect(discountedReturn([], 0.9)).toBe(0);
  });

  it("matches a hand-worked trace", () => {
    expect(discountedReturn([1, 2, 3], 0.5)).toBeCloseTo(1 + 1 + 0.75, 12);
  });

  it("matches the geometric series for constant reward", () => {
    const g = 0.97, T = 40, r = 0.3;
    expect(discountedReturn(new Array(T).fill(r), g)).toBeCloseTo((r * (1 - g ** T)) / (1 - g), 10);
    expect(discountedReturn(new Array(T).fill(r), 1)).toBeCloseTo(r * T, 10);
  });

  it("only counts the first reward when γ = 0", () => {
    expect(discountedReturn([2, 5, 7], 0)).toBe(2);
  });

  it("satisfies G_0 = r_0 + γ G_1", () => {
    const rs = [0.2, -1, 0.5, 3, 0, 0.1], g = 0.9;
    expect(discountedReturn(rs, g)).toBeCloseTo(rs[0] + g * discountedReturn(rs.slice(1), g), 12);
  });
});

describe("shapedRewards", () => {
  const rs = [0, 0, 0, 1, 0];
  const phi = [-0.5, -0.4, -0.25, -0.1, 0, 0];

  it("returns one shaped reward per step", () => {
    expect(shapedRewards(rs, phi, 0.9)).toHaveLength(rs.length);
  });

  it("matches r + γΦ(s') − Φ(s) on a hand-worked step", () => {
    expect(shapedRewards([1], [-0.3, -0.1], 0.5)[0]).toBeCloseTo(1 + 0.5 * -0.1 + 0.3, 12);
  });

  it("changes nothing for a constant potential when γ = 1", () => {
    shapedRewards(rs, new Array(6).fill(4.2), 1).forEach((v, i) => expect(v).toBeCloseTo(rs[i], 12));
  });

  it("telescopes: G' = G + γ^T Φ(s_T) − Φ(s_0)", () => {
    for (const g of [1, 0.95, 0.6]) {
      const G = discountedReturn(rs, g);
      const Gs = discountedReturn(shapedRewards(rs, phi, g), g);
      expect(Gs).toBeCloseTo(G + g ** rs.length * phi[rs.length] - phi[0], 12);
    }
  });

  it("does not change which of two trajectories is better (same start and end potential)", () => {
    const g = 0.9;
    const a = { r: [0, 0, 1], phi: [-1, -0.2, -0.9, 0] };
    const b = { r: [0, 1, 0], phi: [-1, -0.7, -0.1, 0] };
    const diff = discountedReturn(a.r, g) - discountedReturn(b.r, g);
    const diffShaped = discountedReturn(shapedRewards(a.r, a.phi, g), g) - discountedReturn(shapedRewards(b.r, b.phi, g), g);
    expect(diffShaped).toBeCloseTo(diff, 12);
  });
});

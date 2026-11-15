import { describe, expect, it } from "vitest";
import { clippedSurrogate } from "../surrogate";

/*
 * The clipped surrogate: its value inside and outside [1 − ε, 1 + ε] for each sign of Â,
 * where the slope in r is zero (checked with central finite differences), and the pessimistic bound.
 */

const eps = 0.2;
const slope = (r: number, a: number, h = 1e-6) => (clippedSurrogate(r + h, a, eps) - clippedSurrogate(r - h, a, eps)) / (2 * h);

describe("clippedSurrogate", () => {
  it("is r·Â inside the trust region", () => {
    for (const r of [0.85, 1, 1.1]) for (const a of [2, -0.7]) expect(clippedSurrogate(r, a, eps)).toBeCloseTo(r * a, 12);
  });

  it("caps the gain at (1 + ε)Â when Â > 0", () => {
    expect(clippedSurrogate(1.5, 2, eps)).toBeCloseTo(1.2 * 2, 12);
    expect(clippedSurrogate(3, 1, eps)).toBeCloseTo(1.2, 12);
  });

  it("keeps the full loss r·Â when Â > 0 and r < 1 − ε (pessimistic side)", () => {
    expect(clippedSurrogate(0.5, 2, eps)).toBeCloseTo(1, 12);
  });

  it("caps at (1 − ε)Â when Â < 0 and r < 1 − ε", () => {
    expect(clippedSurrogate(0.5, -2, eps)).toBeCloseTo(0.8 * -2, 12);
  });

  it("keeps the full penalty r·Â when Â < 0 and r > 1 + ε", () => {
    expect(clippedSurrogate(1.6, -1, eps)).toBeCloseTo(-1.6, 12);
  });

  it("is zero when the advantage is zero", () => {
    expect(clippedSurrogate(0.3, 0, eps)).toBeCloseTo(0, 12);
    expect(clippedSurrogate(1.7, 0, eps)).toBeCloseTo(0, 12);
  });

  it("is never above the unclipped objective r·Â", () => {
    for (let r = 0.05; r < 3; r += 0.07) for (const a of [-1.3, -0.2, 0.4, 2]) expect(clippedSurrogate(r, a, eps)).toBeLessThanOrEqual(r * a + 1e-12);
  });

  it("has slope Â in r inside the region and slope 0 where it is clipped", () => {
    expect(slope(1.05, 1.5)).toBeCloseTo(1.5, 6);
    expect(slope(0.9, -0.8)).toBeCloseTo(-0.8, 6);
    expect(slope(1.5, 1.5)).toBeCloseTo(0, 6); // Â > 0, pushed too far up: no more gradient
    expect(slope(0.5, -0.8)).toBeCloseTo(0, 6); // Â < 0, pushed too far down: no more gradient
    expect(slope(0.5, 1.5)).toBeCloseTo(1.5, 6); // Â > 0 but r fell: gradient still pulls it back
    expect(slope(1.6, -0.8)).toBeCloseTo(-0.8, 6); // Â < 0 but r rose: still pulls it back
  });

  it("respects ε", () => {
    expect(clippedSurrogate(1.5, 1, 0.1)).toBeCloseTo(1.1, 12);
    expect(clippedSurrogate(1.5, 1, 0.3)).toBeCloseTo(1.3, 12);
  });
});

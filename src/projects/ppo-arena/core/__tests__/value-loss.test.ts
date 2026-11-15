import { describe, expect, it } from "vitest";
import { valueLoss } from "../value-loss";

/*
 * Critic loss: ½(V − R)² unclipped, the pessimistic max with the clipped prediction,
 * and the gradient in V (central finite differences) inside and outside the clip band.
 */

const grad = (v: number, R: number, old: number, c: number | null, h = 1e-6) => (valueLoss(v + h, R, old, c) - valueLoss(v - h, R, old, c)) / (2 * h);

describe("valueLoss", () => {
  it("is ½(V − R)² without clipping", () => {
    expect(valueLoss(3, 1, 0, null)).toBeCloseTo(2, 12);
    expect(valueLoss(-1, 2, 5, null)).toBeCloseTo(4.5, 12);
    expect(valueLoss(0.4, 0.4, 0, null)).toBeCloseTo(0, 12);
  });

  it("treats clip ≤ 0 as no clipping", () => {
    expect(valueLoss(3, 1, 0, 0)).toBeCloseTo(2, 12);
  });

  it("is never negative", () => {
    for (const v of [-2, 0, 0.3, 4]) for (const c of [null, 0.2, 1]) expect(valueLoss(v, 1, 0.5, c)).toBeGreaterThanOrEqual(0);
  });

  it("equals the unclipped loss while V stays within c of V_old", () => {
    expect(valueLoss(1.1, 2, 1, 0.2)).toBeCloseTo(0.5 * 0.9 ** 2, 12);
  });

  it("takes the larger (pessimistic) of the clipped and unclipped errors", () => {
    // V_old = 0, c = 0.2, R = 1. V = 0.9 moved too far: V_c = 0.2, error 0.8 > 0.1.
    expect(valueLoss(0.9, 1, 0, 0.2)).toBeCloseTo(0.5 * 0.8 ** 2, 12);
    // V overshoots past R: V = 1.5, V_c = 0.2. max(0.5², 0.8²).
    expect(valueLoss(1.5, 1, 0, 0.2)).toBeCloseTo(0.5 * 0.8 ** 2, 12);
    // Moving away from R: V = −0.6, V_c = −0.2. max(1.6², 1.2²).
    expect(valueLoss(-0.6, 1, 0, 0.2)).toBeCloseTo(0.5 * 1.6 ** 2, 12);
  });

  it("has gradient V − R unclipped", () => {
    expect(grad(3, 1, 0, null)).toBeCloseTo(2, 6);
    expect(grad(-0.5, 0.25, 0, null)).toBeCloseTo(-0.75, 6);
  });

  it("has zero gradient once the clipped term wins", () => {
    // V_old = 0, c = 0.2, R = 1: at V = 0.9 the loss is flat in V.
    expect(grad(0.9, 1, 0, 0.2)).toBeCloseTo(0, 6);
    // Inside the band the gradient is the ordinary one.
    expect(grad(0.1, 1, 0, 0.2)).toBeCloseTo(-0.9, 6);
  });
});

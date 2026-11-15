import { describe, expect, it } from "vitest";
import { dropLabel, guidedVelocity } from "../guidance";

describe("guidedVelocity (M5)", () => {
  const c = [1, 2, -0.5];
  const u = [0.5, -1, 0];
  it("w = 0 is unconditional, w = 1 is conditional", () => {
    expect(guidedVelocity(c, u, 0)).toEqual(u);
    guidedVelocity(c, u, 1).forEach((v, i) => expect(v).toBeCloseTo(c[i], 12));
  });

  it("is affine in w and extrapolates past the conditional field for w > 1", () => {
    const g2 = guidedVelocity(c, u, 2);
    const g3 = guidedVelocity(c, u, 3);
    g2.forEach((v, i) => {
      expect(g3[i] - v).toBeCloseTo(c[i] - u[i], 12);
      expect(v).toBeCloseTo(2 * c[i] - u[i], 12);
    });
  });

  it("does nothing when both fields agree, whatever w is", () => {
    guidedVelocity([0.3, 0.3], [0.3, 0.3], 7).forEach((v) => expect(v).toBeCloseTo(0.3, 12));
  });
});

describe("dropLabel (M5)", () => {
  it("never drops with pDrop = 0, always drops with pDrop = 1", () => {
    for (let k = 0; k < 100; k++) {
      const u = k / 100;
      expect(dropLabel(3, 0, u)).toBe(3);
      expect(dropLabel(3, 1, u)).toBe(-1);
    }
  });

  it("drops a fraction pDrop of uniform draws", () => {
    for (const p of [0.1, 0.25, 0.6]) {
      let dropped = 0;
      const n = 10000;
      for (let k = 0; k < n; k++) if (dropLabel(2, p, (k + 0.5) / n) === -1) dropped++;
      expect(Math.abs(dropped / n - p)).toBeLessThan(0.002);
    }
  });

  it("returns the label untouched otherwise, and honours a custom null label", () => {
    let kept = 0;
    for (let k = 0; k < 1000; k++) {
      const out = dropLabel(5, 0.5, (k + 0.5) / 1000, 99);
      expect([5, 99]).toContain(out);
      if (out === 5) kept++;
    }
    expect(kept).toBeGreaterThan(450);
    expect(kept).toBeLessThan(550);
  });
});

import { describe, expect, it } from "vitest";
import { addBackward, expBackward, logBackward, mulBackward, powBackward, reluBackward, tanhBackward } from "../ops";

/*
 * Local derivatives, checked against central finite differences of the forward function
 * (a reference written here in the test, independent of your gradcheck.ts).
 */

const h = 1e-6;
const fd = (f: (a: number) => number, a: number) => (f(a + h) - f(a - h)) / (2 * h);
const close = (got: number, want: number, tol = 1e-6) => expect(Math.abs(got - want)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(want)));

const POINTS = [-2.3, -0.7, 0.4, 1.1, 2.9];
const G = [1, -0.5, 3.2];

describe("addBackward", () => {
  it("passes g to both inputs, whatever the values", () => {
    for (const g of G) for (const a of POINTS) {
      const [da, db] = addBackward(a, a * 3 - 1, g);
      close(da, g); close(db, g);
    }
  });
});

describe("mulBackward", () => {
  it("matches finite differences in each argument", () => {
    for (const g of G) for (const a of POINTS) {
      const b = 1.7 - a;
      const [da, db] = mulBackward(a, b, g);
      close(da, g * fd((t) => t * b, a));
      close(db, g * fd((t) => a * t, b));
    }
  });
  it("swaps the roles: ∂(ab)/∂a only depends on b", () => {
    const [da1] = mulBackward(1, 5, 1);
    const [da2] = mulBackward(-9, 5, 1);
    close(da1, da2);
  });
});

describe("powBackward", () => {
  it("matches finite differences for integer and real exponents (a > 0)", () => {
    for (const k of [2, 3, -1, -2, 0.5, 1.7]) for (const a of [0.3, 1.1, 2.9]) for (const g of G) {
      close(powBackward(a, k, g), g * fd((t) => Math.pow(t, k), a), 1e-5);
    }
  });
  it("handles negative bases with integer exponents", () => {
    close(powBackward(-1.5, 3, 1), fd((t) => t ** 3, -1.5), 1e-5);
    close(powBackward(-2, 2, 1), -4);
  });
  it("k = 1 passes g through; k = 0 kills it", () => {
    close(powBackward(4.2, 1, 2.5), 2.5);
    close(powBackward(4.2, 0, 2.5), 0);
  });
});

describe("expBackward", () => {
  it("matches finite differences", () => {
    for (const a of POINTS) for (const g of G) close(expBackward(a, Math.exp(a), g), g * fd(Math.exp, a), 1e-5);
  });
});

describe("logBackward", () => {
  it("matches finite differences for a > 0", () => {
    for (const a of [0.05, 0.4, 1, 2.9, 40]) for (const g of G) close(logBackward(a, g), g * fd(Math.log, a), 1e-5);
  });
  it("grows like 1/a near zero", () => {
    expect(Math.abs(logBackward(1e-4, 1))).toBeGreaterThan(9e3);
  });
});

describe("tanhBackward", () => {
  it("matches finite differences", () => {
    for (const a of POINTS) for (const g of G) close(tanhBackward(a, Math.tanh(a), g), g * fd(Math.tanh, a));
  });
  it("is largest at 0, where it equals g", () => {
    close(tanhBackward(0, 0, 1.3), 1.3);
    expect(tanhBackward(0.5, Math.tanh(0.5), 1)).toBeLessThan(1);
  });
  it("saturates for large |a|", () => {
    expect(Math.abs(tanhBackward(6, Math.tanh(6), 1))).toBeLessThan(1e-4);
    expect(Math.abs(tanhBackward(-6, Math.tanh(-6), 1))).toBeLessThan(1e-4);
  });
});

describe("reluBackward", () => {
  it("is a gate: g for a > 0, 0 for a < 0", () => {
    for (const g of G) {
      close(reluBackward(0.8, g), g);
      close(reluBackward(-0.8, g), 0);
    }
  });
  it("uses the subgradient 0 at a = 0", () => {
    expect(reluBackward(0, 1)).toBe(0);
  });
});

describe("every rule is linear in g", () => {
  it("scaling g scales the gradient", () => {
    const rules: ((g: number) => number)[] = [
      (g) => mulBackward(0.7, -1.9, g)[0],
      (g) => powBackward(1.3, 2.5, g),
      (g) => expBackward(0.4, Math.exp(0.4), g),
      (g) => logBackward(0.9, g),
      (g) => tanhBackward(-0.3, Math.tanh(-0.3), g),
      (g) => reluBackward(0.2, g),
    ];
    for (const r of rules) {
      close(r(3), 3 * r(1), 1e-9);
      close(r(0), 0, 1e-12);
    }
  });
});

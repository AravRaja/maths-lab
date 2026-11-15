import { describe, expect, it } from "vitest";
import { eulerStep, sampleODE } from "../euler";

describe("eulerStep (M3)", () => {
  it("takes one step with the field evaluated at the current (x, t)", () => {
    const v = (x: number[], t: number) => [t, -x[0]];
    const y = eulerStep(v, [1, 2], 0.3, 0.1);
    expect(y[0]).toBeCloseTo(1.03, 12);
    expect(y[1]).toBeCloseTo(1.9, 12);
  });

  it("allows negative dt (backwards in time) and does not mutate x", () => {
    const x = [0.5, 0.5];
    const y = eulerStep(() => [1, -2], x, 1, -0.25);
    expect(y[0]).toBeCloseTo(0.25, 12);
    expect(y[1]).toBeCloseTo(1, 12);
    expect(x).toEqual([0.5, 0.5]);
  });
});

describe("sampleODE (M3)", () => {
  it("returns steps + 1 points, starting at a copy of x0", () => {
    const x0 = [0.2, -0.1];
    const path = sampleODE(() => [0, 0], x0, 5);
    expect(path).toHaveLength(6);
    expect(path[0]).toEqual(x0);
    expect(path[0]).not.toBe(x0);
  });

  it("calls v exactly `steps` times, at t = 0, 1/N, …, (N−1)/N", () => {
    const ts: number[] = [];
    sampleODE((x, t) => {
      ts.push(t);
      return [0];
    }, [0], 4);
    expect(ts).toHaveLength(4);
    ts.forEach((t, k) => expect(t).toBeCloseTo(k / 4, 12));
  });

  it("is exact for a constant field with one step", () => {
    const path = sampleODE(() => [2, -1], [1, 1], 1);
    expect(path[1][0]).toBeCloseTo(3, 12);
    expect(path[1][1]).toBeCloseTo(0, 12);
  });

  it("is exact for straight constant-speed flows with any number of steps", () => {
    for (const n of [1, 3, 10]) {
      const end = sampleODE(() => [0.5, -1.5], [0, 0], n).at(-1)!;
      expect(end[0]).toBeCloseTo(0.5, 10);
      expect(end[1]).toBeCloseTo(-1.5, 10);
    }
  });

  it("is first order: on dx/dt = −x, doubling the steps halves the error", () => {
    const err = (n: number) => Math.abs(sampleODE((x) => [-x[0]], [1], n).at(-1)![0] - Math.exp(-1));
    const r1 = err(50) / err(100);
    const r2 = err(200) / err(400);
    expect(r1).toBeGreaterThan(1.9);
    expect(r1).toBeLessThan(2.1);
    expect(r2).toBeGreaterThan(1.95);
    expect(r2).toBeLessThan(2.05);
  });

  it("handles a time-dependent field: dx/dt = 2t integrates to 1 as N grows", () => {
    const end = sampleODE((x, t) => [2 * t], [0], 1000).at(-1)![0];
    expect(Math.abs(end - 1)).toBeLessThan(2e-3);
  });
});

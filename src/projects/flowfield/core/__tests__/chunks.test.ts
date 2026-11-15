import { describe, expect, it } from "vitest";
import { temporalEnsemble } from "../chunks";

const chunk = (start: number, vals: number[]) => ({ start, actions: vals.map((v) => [v, -v]) });

describe("temporalEnsemble (M6)", () => {
  it("returns null when nothing covers the step", () => {
    expect(temporalEnsemble([chunk(0, [1, 2])], 2, 0.1)).toBeNull();
    expect(temporalEnsemble([chunk(5, [1, 2])], 4, 0.1)).toBeNull();
    expect(temporalEnsemble([], 0, 0.1)).toBeNull();
  });

  it("one chunk: returns its action for this step", () => {
    expect(temporalEnsemble([chunk(3, [10, 20, 30])], 4, 0.5)).toEqual([20, -20]);
  });

  it("m = 0 is a plain average of every chunk covering the step", () => {
    const out = temporalEnsemble([chunk(0, [1, 1, 1, 1]), chunk(1, [4, 4, 4]), chunk(2, [7, 7])], 2, 0)!;
    expect(out[0]).toBeCloseTo(4, 12);
    expect(out[1]).toBeCloseTo(-4, 12);
  });

  it("uses exp(−m·i) with i = 0 for the oldest, whatever the input order", () => {
    const m = Math.log(2); // weights 1, 1/2, 1/4
    const cs = [chunk(2, [7, 7]), chunk(0, [1, 1, 1, 1]), chunk(1, [4, 4, 4])];
    const out = temporalEnsemble(cs, 2, m)!;
    const want = (1 * 1 + 0.5 * 4 + 0.25 * 7) / 1.75;
    expect(out[0]).toBeCloseTo(want, 12);
  });

  it("large m gives the oldest prediction; chunks that have run out are ignored", () => {
    const out = temporalEnsemble([chunk(0, [9, 9]), chunk(1, [1, 2, 3]), chunk(2, [5, 5])], 2, 50)!;
    // chunk at 0 only covers steps 0–1, so the oldest covering step 2 is the one at start 1
    expect(out[0]).toBeCloseTo(2, 6);
  });

  it("weights are normalised: identical predictions come back unchanged", () => {
    const out = temporalEnsemble([chunk(0, [2, 2, 2]), chunk(1, [2, 2]), chunk(2, [2])], 2, 0.7)!;
    expect(out[0]).toBeCloseTo(2, 12);
  });
});

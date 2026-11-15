import { describe, expect, it } from "vitest";
import { NotYoursYet, isNotYoursYet, notYoursYet, reviveError, serializeNotYoursYet } from "../not-yours-yet";
import { probeCore } from "../cores";
import { BAYER8, ditherField } from "../dither";
import { binSamples } from "../stats";
import { runCore } from "@/components/kit/core-guard";

describe("NotYoursYet", () => {
  const e = notYoursYet({ file: "src/core/x.ts", fn: "x", milestone: "m1" });
  it("is detected, also after a structured-clone round trip", () => {
    expect(e).toBeInstanceOf(NotYoursYet);
    expect(isNotYoursYet(e)).toBe(true);
    const cloned = structuredClone(serializeNotYoursYet(e));
    expect(isNotYoursYet(cloned)).toBe(true);
    const revived = reviveError(cloned);
    expect(revived).toBeInstanceOf(NotYoursYet);
    expect((revived as NotYoursYet).fn).toBe("x");
    expect(isNotYoursYet(new Error("nope"))).toBe(false);
  });

  it("classifies cores", () => {
    expect(probeCore({ file: "f", fn: "a", probe: () => { throw e; } }).state).toBe("todo");
    expect(probeCore({ file: "f", fn: "b", probe: () => 1 }).state).toBe("done");
    expect(probeCore({ file: "f", fn: "c", probe: () => { throw new Error("bad"); } }).state).toBe("broken");
    expect(runCore(() => { throw e; }).status).toBe("missing");
    expect(runCore(() => 2).value).toBe(2);
  });
});

describe("dither", () => {
  it("Bayer 8 is a permutation of 64 thresholds in (0,1)", () => {
    expect(new Set(BAYER8).size).toBe(64);
    BAYER8.forEach((t) => { expect(t).toBeGreaterThan(0); expect(t).toBeLessThan(1); });
  });
  it("preserves mean brightness on a flat field", () => {
    const w = 64, h = 64, f = new Float32Array(w * h).fill(0.3), out = new Uint8ClampedArray(w * h * 4);
    ditherField(f, w, h, out, [0, 1]);
    let s = 0;
    for (let i = 0; i < w * h; i++) s += out[i * 4] / 255;
    expect(s / (w * h)).toBeCloseTo(0.3, 2);
  });
});

describe("binSamples", () => {
  it("counts every in-range sample once", () => {
    const { counts } = binSamples([0, 0.1, 0.5, 0.99, 1], 2, [0, 1]);
    expect(counts).toEqual([2, 3]);
  });
});

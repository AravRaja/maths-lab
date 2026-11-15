import { describe, expect, it } from "vitest";
import { demoDataset, expertDemo, fk, hitsPost, ik, CHUNK } from "../reacher";
import { mulberry32 } from "../rng";
import { resampleStrokes, normalise } from "../shapes";

describe("reacher plumbing", () => {
  it("ik inverts fk", () => {
    for (const p of [[0.9, -0.9], [0.4, 0.1], [1.5, 0.3]] as [number, number][]) {
      const t = fk(ik(p)).tip;
      expect(t[0]).toBeCloseTo(p[0], 9);
      expect(t[1]).toBeCloseTo(p[1], 9);
    }
  });

  it("expert demos reach the target without touching the post, on both sides", () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 20; i++) {
      const s = { start: [0.95 + (rng() - 0.5) * 0.3, -0.95] as [number, number], target: [0.95, 0.95 + (rng() - 0.5) * 0.2] as [number, number] };
      for (const side of [-1, 1] as const) {
        const d = expertDemo(s, side);
        d.qs.forEach((q) => expect(hitsPost(fk(q).tip)).toBe(false));
        const end = fk(d.qs.at(-1)!).tip;
        expect(Math.hypot(end[0] - s.target[0], end[1] - s.target[1])).toBeLessThan(1e-6);
      }
    }
  });

  it("dataset chunks have the right shape and O(1) scale", () => {
    const { ctx, chunks } = demoDataset(10, 1);
    expect(ctx).toHaveLength(300);
    chunks.forEach((c) => expect(c).toHaveLength(CHUNK));
    const max = Math.max(...chunks.flat().map(Math.abs));
    expect(max).toBeLessThan(4);
    expect(max).toBeGreaterThan(0.3);
  });

  it("resampleStrokes spreads points along the strokes", () => {
    const pts = resampleStrokes([[[0, 0], [1, 0]]], 200, 1, 0);
    pts.forEach(([x, y]) => { expect(y).toBeCloseTo(0, 9); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(1); });
    const n = normalise(pts, 1);
    expect(Math.max(...n.map((p) => p[0]))).toBeCloseTo(1, 1);
  });
});

import { describe, expect, it } from "vitest";
import { PRESETS, TILE, buildMdp, ghostValues, goalDistance, parseWorld, presetWorld } from "../grid";
import { sampleStep } from "../env";
import { mulberry32 } from "../rng";
import { oneHot, maxPerState, supDist, uniformPolicy } from "../policy";
import { HERO_ROWS } from "../hero-world";

describe("gridworld plumbing", () => {
  it("every preset is a 14×14 rectangle with a goal and a free start", () => {
    for (const p of PRESETS) {
      expect(p.rows).toHaveLength(14);
      p.rows.forEach((r) => expect(r).toHaveLength(14));
      const w = parseWorld(p.rows);
      expect(w.tiles.includes(TILE.goal)).toBe(true);
      expect(w.tiles[w.start]).toBe(TILE.empty);
    }
  });

  it("the hero world is a rectangle", () => {
    HERO_ROWS.forEach((r) => expect(r).toHaveLength(HERO_ROWS[0].length));
  });

  it("transition probabilities sum to 1 and absorbing states loop", () => {
    const m = buildMdp(presetWorld("rooms"), { slip: 0.2, stepReward: -0.04, mudReward: -0.3, goalReward: 1, lavaReward: -1 });
    for (let i = 0; i < m.outcomes.length; i++) {
      const sum = m.outcomes[i].reduce((a, o) => a + o.p, 0);
      expect(sum).toBeCloseTo(1, 12);
    }
    const w = presetWorld("rooms");
    const g = w.tiles.indexOf(TILE.goal);
    expect(m.terminal[g]).toBe(1);
    expect(m.outcomes[g * 4]).toEqual([{ p: 1, next: g, reward: 0 }]);
  });

  it("slip sends probability sideways; walls and edges bounce", () => {
    const w = parseWorld(["...", ".S.", "..."]);
    const m = buildMdp(w, { slip: 0.2, stepReward: 0, mudReward: 0, goalReward: 1, lavaReward: -1 });
    const up = m.outcomes[4 * 4 + 0];
    expect(up.find((o) => o.next === 1)?.p).toBeCloseTo(0.8, 12);
    expect(up.find((o) => o.next === 5)?.p).toBeCloseTo(0.1, 12);
    expect(up.find((o) => o.next === 3)?.p).toBeCloseTo(0.1, 12);
    const corner = m.outcomes[0 * 4 + 0]; // up from the top-left corner
    expect(corner.find((o) => o.next === 0)?.p).toBeCloseTo(0.9, 12);
  });

  it("sampleStep follows the transition probabilities", () => {
    const w = parseWorld(["...", ".S.", "..."]);
    const m = buildMdp(w, { slip: 0.2, stepReward: 0, mudReward: 0, goalReward: 1, lavaReward: -1 });
    const r = mulberry32(1);
    let hit = 0;
    for (let i = 0; i < 20000; i++) if (sampleStep(m, 4, 0, r).s2 === 1) hit++;
    expect(hit / 20000).toBeCloseTo(0.8, 1);
  });

  it("goal distance and the ghost field", () => {
    const w = parseWorld(["S..G"]);
    expect(Array.from(goalDistance(w))).toEqual([3, 2, 1, 0]);
    const g = ghostValues(w);
    expect(g[3]).toBeGreaterThan(g[0]);
  });

  it("policy helpers", () => {
    expect(Array.from(oneHot([1, -1], 2))).toEqual([0, 1, 0.5, 0.5]);
    expect(Array.from(uniformPolicy(1, 4))).toEqual([0.25, 0.25, 0.25, 0.25]);
    expect(Array.from(maxPerState([1, 3, -1, -2], 2))).toEqual([3, -1]);
    expect(supDist([1, 2], [1.5, 0])).toBe(2);
  });
});

import { describe, expect, it } from "vitest";
import { epsilonGreedy } from "../explore";
import { seeded } from "./fixtures";

function freq(q: number[], eps: number, n = 40000, seed = 1) {
  const r = seeded(seed);
  const c = new Array(q.length).fill(0);
  for (let i = 0; i < n; i++) c[epsilonGreedy(q, eps, r)]++;
  return c.map((x) => x / n);
}

describe("epsilonGreedy", () => {
  it("ε = 0 always picks the argmax", () => {
    const r = seeded(2);
    for (let i = 0; i < 200; i++) expect(epsilonGreedy([0.1, -3, 0.7, 0.2], 0, r)).toBe(2);
  });

  it("ε = 0 splits ties uniformly at random, and never picks a non-max", () => {
    const f = freq([1, 5, 0, 5], 0);
    expect(f[0]).toBe(0);
    expect(f[2]).toBe(0);
    expect(f[1]).toBeCloseTo(0.5, 1);
    expect(f[3]).toBeCloseTo(0.5, 1);
  });

  it("ε = 1 is uniform over all actions", () => {
    freq([9, 0, 0, 0], 1).forEach((p) => expect(Math.abs(p - 0.25)).toBeLessThan(0.015));
  });

  it("P(greedy) = 1 − ε + ε/nA", () => {
    const eps = 0.2;
    const f = freq([0, 0, 1, 0], eps);
    expect(Math.abs(f[2] - (1 - eps + eps / 4))).toBeLessThan(0.01);
    [0, 1, 3].forEach((a) => expect(Math.abs(f[a] - eps / 4)).toBeLessThan(0.01));
  });

  it("is reproducible from the rand it is given", () => {
    const a = seeded(9), b = seeded(9);
    for (let i = 0; i < 100; i++) expect(epsilonGreedy([0, 0, 0, 0], 0.3, a)).toBe(epsilonGreedy([0, 0, 0, 0], 0.3, b));
  });
});

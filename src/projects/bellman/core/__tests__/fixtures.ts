import type { MDP } from "../types";
import { buildMdp, parseWorld, type WorldParams } from "../../lib/grid";

/*
 * Small MDPs with answers you can check by hand (or that are in the textbooks).
 * Shared by the core tests. Not a test file itself.
 */

const NO_COST: WorldParams = { slip: 0, stepReward: 0, mudReward: 0, goalReward: 1, lavaReward: -1 };

/** A deterministic 1×n corridor with the goal at the right end: "......G". State i is column i. */
export function corridor(n = 7): MDP {
  return buildMdp(parseWorld([".".repeat(n - 1) + "G"]), NO_COST);
}

/**
 * Russell & Norvig's 4×3 world (AIMA ch. 17): slip 0.2, step reward −0.04, +1 goal, −1 pit, γ = 1.
 *
 *   row 0:  . . . G        states 0  1  2  3
 *   row 1:  . # . ~               4  5  6  7
 *   row 2:  S . . .               8  9 10 11
 *
 * Here reward is paid on ARRIVAL, so V(s) = U_AIMA(s) + 0.04 for every non-terminal s.
 */
export function aima(): MDP {
  return buildMdp(parseWorld(["...G", ".#.~", "S..."]), { slip: 0.2, stepReward: -0.04, mudReward: -0.04, goalReward: 1, lavaReward: -1 });
}

/** AIMA's published utilities U(s) for the 4×3 world, by state index (book's (x,y) → our row-major). */
export const AIMA_U: Record<number, number> = {
  0: 0.812, 1: 0.868, 2: 0.918,
  4: 0.762, 6: 0.660,
  8: 0.705, 9: 0.655, 10: 0.611, 11: 0.388,
};

/** AIMA's optimal policy (0 up, 1 right, 2 down, 3 left). */
export const AIMA_PI: Record<number, number> = { 0: 1, 1: 1, 2: 1, 4: 0, 6: 0, 8: 0, 9: 3, 10: 3, 11: 3 };

/**
 * A two-state, two-action MDP with no terminal states, made up for hand calculation.
 *
 *   s0, a0:  ½ → s0 (r = 1),  ½ → s1 (r = 0)
 *   s0, a1:  1 → s1 (r = 2)
 *   s1, a0:  1 → s0 (r = 0)
 *   s1, a1:  0.3 → s1 (r = −1),  0.7 → s0 (r = 3)
 */
export function twoState(): MDP {
  return {
    nS: 2,
    nA: 2,
    outcomes: [
      [{ p: 0.5, next: 0, reward: 1 }, { p: 0.5, next: 1, reward: 0 }],
      [{ p: 1, next: 1, reward: 2 }],
      [{ p: 1, next: 0, reward: 0 }],
      [{ p: 0.3, next: 1, reward: -1 }, { p: 0.7, next: 0, reward: 3 }],
    ],
    terminal: new Uint8Array(2),
  };
}

/** Seeded uniform [0, 1) for tests. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function maxAbsDiff(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
}

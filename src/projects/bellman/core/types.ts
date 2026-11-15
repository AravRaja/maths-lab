/**
 * The shapes every Bellman core works with. Plain arrays and typed arrays only, so an MDP can be
 * built inside a Web Worker and nothing needs to cross the thread boundary but numbers.
 */

/** One possible result of taking action a in state s. */
export interface Outcome {
  /** P(s' | s, a). The outcomes of one (s, a) sum to 1. */
  p: number;
  /** s', the next state index. */
  next: number;
  /** r(s, a, s'), the reward for this transition. */
  reward: number;
}

/**
 * A finite MDP in sparse tabular form.
 *
 *   nS states 0..nS-1, nA actions 0..nA-1.
 *   outcomes[s * nA + a] lists every s' with P(s' | s, a) > 0.
 *
 * Terminal states (goals, lava) and walls are absorbing: every action loops back with p = 1 and
 * reward 0. So with V initialised to 0 their value stays 0 under any backup and you never need a
 * special case for them. `terminal[s] = 1` is there for the sampling code (an episode ends there).
 */
export interface MDP {
  nS: number;
  nA: number;
  outcomes: Outcome[][];
  terminal: Uint8Array;
}

/** Actions in the gridworld: 0 up, 1 right, 2 down, 3 left (clockwise from north). */
export const ACTIONS = ["up", "right", "down", "left"] as const;
export const N_ACTIONS = 4;

/**
 * A vector of numbers: V (length nS) or a Q-table (length nS·nA, laid out Q[s * nA + a]).
 * It is `Float64Array<ArrayBuffer>` so `let V = new Float64Array(n)` can later be reassigned to a
 * backup's result without a TypeScript complaint.
 */
export type Vec = Float64Array<ArrayBuffer>;

/** One action per state. */
export type ActionMap = Int32Array<ArrayBuffer>;

/**
 * A stochastic policy as a flat table: pi[s * nA + a] = π(a | s). Each row sums to 1.
 * A deterministic policy is the same table with a single 1 per row (see lib/policy.ts `oneHot`).
 */
export type PolicyTable = Vec;

import type { PolicyTable } from "../core/types";

/** π(a|s) = 1/nA everywhere: the random walker. */
export function uniformPolicy(nS: number, nA: number): PolicyTable {
  return new Float64Array(nS * nA).fill(1 / nA);
}

/** Deterministic policy (one action per state, or -1 for "uniform here") as a probability table. */
export function oneHot(actions: ArrayLike<number>, nA: number): PolicyTable {
  const pi = new Float64Array(actions.length * nA);
  for (let s = 0; s < actions.length; s++) {
    const a = actions[s];
    if (a < 0) for (let b = 0; b < nA; b++) pi[s * nA + b] = 1 / nA;
    else pi[s * nA + a] = 1;
  }
  return pi;
}

/** max_a Q(s, a) per state. Plumbing for drawing a Q-table as a value field (not a core). */
export function maxPerState(Q: ArrayLike<number>, nA: number): Float64Array {
  const nS = Q.length / nA;
  const V = new Float64Array(nS);
  for (let s = 0; s < nS; s++) {
    let m = -Infinity;
    for (let a = 0; a < nA; a++) m = Math.max(m, Q[s * nA + a]);
    V[s] = m;
  }
  return V;
}

/** Sup-norm distance ‖x − y‖∞. */
export function supDist(x: ArrayLike<number>, y: ArrayLike<number>): number {
  let m = 0;
  for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i] - y[i]));
  return m;
}

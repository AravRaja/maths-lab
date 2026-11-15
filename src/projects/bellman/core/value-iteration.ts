import { notYoursYet } from "@/kit/not-yours-yet";
import type { MDP, Vec } from "./types";

const FILE = "src/projects/bellman/core/value-iteration.ts";

export interface ValueIterationResult {
  /** The final values V_K. */
  V: Vec;
  /** Every iterate, V_0 (all zeros) through V_K. The page replays these as the ripple. */
  sweeps: Vec[];
  /** deltas[k] = ‖V_{k+1} − V_k‖∞, so deltas.length === sweeps.length − 1. */
  deltas: number[];
}

/**
 * Value iteration: apply the optimality backup until the values stop moving.
 *
 * Maths:   V_0 = 0,   V_{k+1} = T* V_k,   stop once ‖V_{k+1} − V_k‖∞ < tol (or after maxSweeps).
 *
 * Signature: valueIteration(mdp: MDP, gamma: number, opts?: { tol?: number; maxSweeps?: number }) => ValueIterationResult
 *   - Defaults: tol = 1e-6, maxSweeps = 1000.
 *   - Use your bellmanOptimalityBackup from ./backups.
 *
 * On paper first:
 *  - From the contraction property: ‖V_k − V*‖∞ ≤ γ^k ‖V_0 − V*‖∞. Roughly how many sweeps for
 *    γ = 0.9 to cut the error by 10⁶? For γ = 0.99?
 *  - If ‖V_{k+1} − V_k‖∞ < ε, bound ‖V_{k+1} − V*‖∞. (Answer has γ/(1 − γ) in it.)
 */
export function valueIteration(mdp: MDP, gamma: number, opts: { tol?: number; maxSweeps?: number } = {}): ValueIterationResult {
  void mdp; void gamma; void opts;
  throw notYoursYet({ file: FILE, fn: "valueIteration", milestone: "m3-value-iteration", summary: "Sweep T* to a fixed point and keep every frame for the replay." });
}

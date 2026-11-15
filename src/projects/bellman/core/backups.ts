import { notYoursYet } from "@/kit/not-yours-yet";
import type { MDP, PolicyTable, Vec } from "./types";

const FILE = "src/projects/bellman/core/backups.ts";

/**
 * One synchronous sweep of the Bellman EXPECTATION operator T^π.
 *
 * Maths:   (T^π V)(s) = Σ_a π(a | s) Σ_{s'} P(s' | s, a) · [ r(s, a, s') + γ · V(s') ]
 *
 * Signature: bellmanExpectationBackup(mdp: MDP, V: ArrayLike<number>, pi: PolicyTable, gamma: number) => Vec
 *   - pi[s * nA + a] = π(a | s); each row sums to 1.
 *   - Synchronous: every new value uses the OLD V. Return a new array; don't mutate V.
 *
 * On paper first:
 *  - Write T^π in matrix form: T^π V = r_π + γ P_π V. What are r_π (a vector) and P_π (a matrix)?
 *  - Show ‖T^π V − T^π W‖∞ ≤ γ ‖V − W‖∞. Why does that make repeated sweeps converge, and to what?
 *  - Solve V^π = r_π + γ P_π V^π for V^π in closed form. Why do we iterate instead of inverting?
 */
export function bellmanExpectationBackup(mdp: MDP, V: ArrayLike<number>, pi: PolicyTable, gamma: number): Vec {
  void mdp; void V; void pi; void gamma;
  throw notYoursYet({ file: FILE, fn: "bellmanExpectationBackup", milestone: "m2-evaluation", summary: "One sweep of T^π: values for the policy you drew." });
}

/**
 * One synchronous sweep of the Bellman OPTIMALITY operator T*.
 *
 * Maths:   (T* V)(s) = max_a Σ_{s'} P(s' | s, a) · [ r(s, a, s') + γ · V(s') ]
 *
 * Signature: bellmanOptimalityBackup(mdp: MDP, V: ArrayLike<number>, gamma: number) => Vec
 *   - Synchronous, new array, don't mutate V.
 *
 * On paper first:
 *  - Show |max_a f(a) − max_a g(a)| ≤ max_a |f(a) − g(a)|. Use it to prove T* is a γ-contraction.
 *  - Monotone: if V ≤ W everywhere, is T* V ≤ T* W? Why does that need P ≥ 0?
 *  - Starting from V = 0 on a deterministic corridor, after k sweeps how far from the goal has
 *    "news of the goal" travelled?
 */
export function bellmanOptimalityBackup(mdp: MDP, V: ArrayLike<number>, gamma: number): Vec {
  void mdp; void V; void gamma;
  throw notYoursYet({ file: FILE, fn: "bellmanOptimalityBackup", milestone: "m3-value-iteration", summary: "One sweep of T*: the wave moves one cell further." });
}

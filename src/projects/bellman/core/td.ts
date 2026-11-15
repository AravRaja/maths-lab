import { notYoursYet } from "@/kit/not-yours-yet";

const FILE = "src/projects/bellman/core/td.ts";

/**
 * TD(0) update for state values, IN PLACE.
 *
 * Maths:   target = r                    if the episode ended at s' (done)
 *                 = r + γ · V(s')        otherwise
 *          δ = target − V(s)
 *          V(s) ← V(s) + α · δ
 *
 * Signature: td0Update(V: Float64Array, s: number, r: number, s2: number, done: boolean, alpha: number, gamma: number) => number
 *   - Mutates V[s] only. Returns δ (the TD error, before the update).
 *
 * On paper first:
 *  - Compare with the expectation backup: which sum has TD replaced with a single sample?
 *  - If you froze V(s') and fed the same transition forever, what does V(s) converge to? How fast,
 *    in terms of α?
 *  - Why is target = r (not r + γV(s')) on termination, even though V(terminal) should be 0 anyway?
 */
export function td0Update(V: Float64Array, s: number, r: number, s2: number, done: boolean, alpha: number, gamma: number): number {
  void V; void s; void r; void s2; void done; void alpha; void gamma;
  throw notYoursYet({ file: FILE, fn: "td0Update", milestone: "m5-td", summary: "Nudge V(s) toward r + γV(s′): learning values from one step." });
}

/**
 * Q-learning update, IN PLACE.
 *
 * Maths:   target = r                                   if done
 *                 = r + γ · max_{a'} Q(s', a')          otherwise
 *          δ = target − Q(s, a)
 *          Q(s, a) ← Q(s, a) + α · δ
 *
 * Signature: qLearningUpdate(Q: Float64Array, nA: number, s: number, a: number, r: number, s2: number,
 *                            done: boolean, alpha: number, gamma: number) => number
 *   - Q is laid out Q[s * nA + a]. Mutates Q[s * nA + a] only. Returns δ.
 *
 * On paper first:
 *  - This is a sampled bellmanOptimalityBackup on Q. Write the optimality equation for Q* and spot
 *    which expectation the sample replaces.
 *  - Why is it "off-policy"? The agent acts ε-greedily but the target uses max. What would the
 *    target be for SARSA, and which path would SARSA learn on the cliff?
 */
export function qLearningUpdate(
  Q: Float64Array, nA: number, s: number, a: number, r: number, s2: number, done: boolean, alpha: number, gamma: number,
): number {
  void Q; void nA; void s; void a; void r; void s2; void done; void alpha; void gamma;
  throw notYoursYet({ file: FILE, fn: "qLearningUpdate", milestone: "m6-q-learning", summary: "Q(s,a) toward r + γ max Q(s′,·): learning by trial and error." });
}

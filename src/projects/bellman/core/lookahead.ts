import { notYoursYet } from "@/kit/not-yours-yet";
import type { ActionMap, MDP, Vec } from "./types";

const FILE = "src/projects/bellman/core/lookahead.ts";
const M = "m1-lookahead";

/**
 * One-step lookahead: the action values you get by trusting V one step ahead.
 *
 * Maths:   Q(s, a) = Σ_{s'} P(s' | s, a) · [ r(s, a, s') + γ · V(s') ]
 *
 * Signature: lookahead(mdp: MDP, V: ArrayLike<number>, gamma: number) => Vec   (a Float64Array)
 *   - V has length mdp.nS. The result has length nS · nA, laid out Q[s * nA + a].
 *   - P and r come from mdp.outcomes[s * nA + a]  (a list of { p, next, reward }).
 *   - Don't mutate V.
 *
 * On paper first:
 *  - A cell next to the goal (reward +1 for stepping in, value 0 once there), no slip, γ = 0.9,
 *    V = 0 everywhere. What is Q for the action that steps into the goal? For one that bumps a wall?
 *  - Now slip = 0.2 (0.1 each side). Write Q(s, a) for the same cell as a sum of three terms.
 *  - Why does every backup in this project reduce to "a lookahead, then a sum or a max over a"?
 */
export function lookahead(mdp: MDP, V: ArrayLike<number>, gamma: number): Vec {
  void mdp; void V; void gamma;
  throw notYoursYet({ file: FILE, fn: "lookahead", milestone: M, summary: "Q(s,a) from V one step ahead: the four numbers on the compass." });
}

/**
 * Greedy policy from a Q-table.
 *
 * Maths:   π(s) = argmax_a Q(s, a)
 *
 * Signature: greedyPolicy(Q: ArrayLike<number>, nA: number) => ActionMap   (an Int32Array, length Q.length / nA)
 *   - Ties go to the LOWEST action index. That matters: policy iteration stops when the policy
 *     stops changing, and a random tie-break could make it flip between equal actions forever.
 *
 * On paper first:
 *  - Given V*, why is the greedy policy w.r.t. lookahead(V*) optimal? (Hint: what does V* satisfy?)
 *  - Given a V that is NOT V*, is greedy w.r.t. it still at least as good as the policy V came from?
 */
export function greedyPolicy(Q: ArrayLike<number>, nA: number): ActionMap {
  void Q; void nA;
  throw notYoursYet({ file: FILE, fn: "greedyPolicy", milestone: M, summary: "argmax over actions per state: the arrows." });
}

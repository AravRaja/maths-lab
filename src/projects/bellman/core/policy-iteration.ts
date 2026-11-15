import { notYoursYet } from "@/kit/not-yours-yet";
import type { ActionMap, MDP, Vec } from "./types";

const FILE = "src/projects/bellman/core/policy-iteration.ts";

export interface PolicyIterationRound {
  /** The policy that was evaluated this round (one action per state). */
  policy: ActionMap;
  /** Its value V^π (to evalTol). */
  V: Vec;
  /** How many expectation sweeps the evaluation took. */
  evalSweeps: number;
}

export interface PolicyIterationResult {
  /** The final, stable policy. */
  policy: ActionMap;
  /** Its value. */
  V: Vec;
  /** One entry per evaluate-then-improve round, in order. rounds[0].policy is the starting policy. */
  rounds: PolicyIterationRound[];
}

/**
 * Policy iteration: evaluate the current policy, act greedily on that value, repeat until the
 * policy stops changing.
 *
 * Maths:   π_0(s) = 0 (always "up")
 *          evaluate:  V^{π_k} = fixed point of T^{π_k}   (iterate the expectation backup until ‖ΔV‖∞ < evalTol)
 *          improve:   π_{k+1}(s) = argmax_a Q^{π_k}(s, a)  with Q from a one-step lookahead on V^{π_k}
 *          stop when π_{k+1} = π_k.
 *
 * Signature: policyIteration(mdp: MDP, gamma: number, opts?: { evalTol?: number; maxEvalSweeps?: number; maxRounds?: number })
 *              => PolicyIterationResult
 *   - Defaults: evalTol = 1e-8, maxEvalSweeps = 10000, maxRounds = 100.
 *   - Build it from your own cores: bellmanExpectationBackup, lookahead, greedyPolicy.
 *     (lib/policy.ts `oneHot` turns an action array into the PolicyTable the backup wants.)
 *   - You may warm-start each evaluation from the previous round's V; it only changes evalSweeps.
 *
 * On paper first:
 *  - Policy improvement theorem: if π' is greedy w.r.t. V^π then V^{π'} ≥ V^π everywhere. Prove it
 *    by unrolling T^{π'} V^π ≥ V^π.
 *  - Why must it terminate in finitely many rounds? (Count the deterministic policies.)
 *  - Why does the lowest-index tie-break in greedyPolicy matter for the stopping test?
 */
export function policyIteration(
  mdp: MDP,
  gamma: number,
  opts: { evalTol?: number; maxEvalSweeps?: number; maxRounds?: number } = {},
): PolicyIterationResult {
  void mdp; void gamma; void opts;
  throw notYoursYet({ file: FILE, fn: "policyIteration", milestone: "m4-policy-iteration", summary: "Evaluate, improve, repeat: the arrows snap round by round." });
}

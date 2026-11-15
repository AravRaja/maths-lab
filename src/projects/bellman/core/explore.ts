import { notYoursYet } from "@/kit/not-yours-yet";

const FILE = "src/projects/bellman/core/explore.ts";

/**
 * ε-greedy action selection.
 *
 * Maths:   with probability ε pick an action uniformly at random (all nA of them, greedy included);
 *          otherwise pick argmax_a Q(s, a), breaking ties UNIFORMLY AT RANDOM.
 *          So P(the unique greedy action) = 1 − ε + ε / nA.
 *
 * Signature: epsilonGreedy(qRow: ArrayLike<number>, epsilon: number, rand: () => number) => number
 *   - qRow is Q(s, ·) for one state, length nA. Return an action index in [0, nA).
 *   - Use only `rand` for randomness (uniform in [0, 1)) so runs are reproducible from a seed.
 *
 * On paper first:
 *  - Why random tie-breaking here when greedyPolicy uses lowest-index? Think about a Q-table that
 *    starts as all zeros.
 *  - Derive P(greedy) = 1 − ε + ε/nA. For nA = 4, what ε makes every action equally likely?
 */
export function epsilonGreedy(qRow: ArrayLike<number>, epsilon: number, rand: () => number): number {
  void qRow; void epsilon; void rand;
  throw notYoursYet({ file: FILE, fn: "epsilonGreedy", milestone: "m5-td", summary: "Mostly greedy, sometimes curious: how the agent explores." });
}

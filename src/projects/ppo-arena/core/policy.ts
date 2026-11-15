import { notYoursYet } from "@/kit/not-yours-yet";

const FILE = "src/projects/ppo-arena/core/policy.ts";

/**
 * Log-probability of an action under a categorical (softmax) policy.
 *
 * Maths:   π(a | s) = exp(z_a) / Σ_b exp(z_b)       z = logits from the policy network
 *          log π(a | s) = z_a − log Σ_b exp(z_b)
 *
 * Signature: logProb(logits: number[], action: number) => number
 *   logits has length K ≥ 1 (K = 2 here: push left, push right). 0 ≤ action < K.
 *   Must be numerically stable: logits like [1000, 999] must give a finite answer.
 *   Always ≤ 0. The page gets probabilities as exp(logProb(...)), so this core also drives sampling.
 *
 * On paper first:
 *  - Show softmax is unchanged if you add the same constant c to every logit. Which c saves you from overflow?
 *  - Derive ∂ log π(a) / ∂ z_b. (You won't code it here, but it's what the network trains on.)
 *  - Two actions: write π(right) as a function of z_right − z_left alone. Which familiar function is it?
 */
export function logProb(logits: number[], action: number): number {
  void logits;
  void action;
  throw notYoursYet({
    file: FILE,
    fn: "logProb",
    milestone: "m3-policy",
    summary: "log π(a|s) from the network's logits. Every action the agent takes is sampled through it.",
  });
}

/**
 * Entropy of the categorical policy: how undecided the agent is.
 *
 * Maths:   H(π) = − Σ_a π(a) log π(a)
 *
 * Signature: entropy(logits: number[]) => number
 *   logits has length K. Returns H in nats, 0 ≤ H ≤ log K. Must be stable for huge logits
 *   (a near one-hot policy has entropy ≈ 0, not NaN).
 *
 * On paper first:
 *  - Which policy maximises H, and what is the maximum? Which minimise it?
 *  - Why do we add +c·H to the objective? What happens to exploration if c = 0 and the
 *    policy collapses early?
 *  - 0 · log 0 appears for a one-hot policy. What value should it take, and how does
 *    writing H in terms of logits (not probabilities) sidestep it?
 */
export function entropy(logits: number[]): number {
  void logits;
  throw notYoursYet({
    file: FILE,
    fn: "entropy",
    milestone: "m3-policy",
    summary: "How undecided the policy is, in nats. The entropy bonus keeps it exploring.",
  });
}

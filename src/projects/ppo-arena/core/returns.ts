import { notYoursYet } from "@/kit/not-yours-yet";

const FILE = "src/projects/ppo-arena/core/returns.ts";

/**
 * Discounted returns (return-to-go) over a rollout that may hold several episodes.
 *
 * Maths:   G_t = r_t + γ r_{t+1} + γ² r_{t+2} + …   summed only up to the end of t's episode.
 *          If the rollout stops mid-episode, the tail past the last step is estimated by
 *          `lastValue` ≈ V(s_T), so the final unfinished episode is bootstrapped.
 *
 * Signature: discountedReturns(rewards: number[], dones: boolean[], gamma: number, lastValue?: number) => number[]
 *   rewards[t]  reward received after the action at step t           length T
 *   dones[t]    true if the episode ENDED at step t (s_{t+1} is terminal, nothing to bootstrap)
 *   gamma       0 ≤ γ ≤ 1
 *   lastValue   V(s_T) for the state after the final step (default 0). Ignored if dones[T-1].
 *   Returns G as a new array of length T. Empty in, empty out.
 *
 * On paper first:
 *  - Write G_t in terms of G_{t+1}. Which way should the loop run, and what is "G_T"?
 *  - How does dones[t] change that recursion? Write it with a (1 − done) factor.
 *  - Constant reward 1 for T steps then terminal: closed form for G_0. What does it tend to as T → ∞?
 *  - In CartPole the reward is 1 every step. Why is 1/(1 − γ) called the "effective horizon"?
 */
export function discountedReturns(rewards: number[], dones: boolean[], gamma: number, lastValue = 0): number[] {
  void rewards;
  void dones;
  void gamma;
  void lastValue;
  throw notYoursYet({
    file: FILE,
    fn: "discountedReturns",
    milestone: "m1-returns",
    summary: "Turns a reward trace into return-to-go, resetting at every episode end.",
  });
}

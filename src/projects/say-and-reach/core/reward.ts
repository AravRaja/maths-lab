import { notYoursYet } from "@/kit/not-yours-yet";

const FILE = "src/projects/say-and-reach/core/reward.ts";

/**
 * Discounted return of a reward trace.
 *
 * Maths:   G = Σ_{t=0}^{T−1} γ^t r_t
 *
 * Signature: discountedReturn(rewards: number[], gamma: number) => number
 *   0 ≤ gamma ≤ 1. The empty trace has return 0.
 *
 * On paper first:
 *  - Write G_t in terms of G_{t+1}. Which direction should a loop run?
 *  - Constant reward r for T steps: find the closed form. What is it when γ = 1?
 */
export function discountedReturn(rewards: number[], gamma: number): number {
  void rewards;
  void gamma;
  throw notYoursYet({
    file: FILE,
    fn: "discountedReturn",
    milestone: "m5-reward-shaping",
    summary: "Adds up a reward trace with discounting. Scores every rollout.",
  });
}

/**
 * Potential-based reward shaping (Ng, Harada and Russell, 1999).
 *
 * Success is sparse: r_t = 1 only on the step the cube arrives. A potential Φ(s) (here, minus
 * the distance still to go) adds a dense signal without changing which policy is best:
 *
 * Maths:   r'_t = r_t + γ Φ(s_{t+1}) − Φ(s_t)
 *
 * Signature: shapedRewards(rewards: number[], potentials: number[], gamma: number) => number[]
 *   rewards has length T, potentials has length T + 1 (Φ(s_0) … Φ(s_T)). Returns length T.
 *
 * On paper first:
 *  - Sum γ^t r'_t over the episode. Show the Φ terms telescope, leaving
 *    G' = G + γ^T Φ(s_T) − Φ(s_0).
 *  - Why does that mean the shaped and unshaped problems have the same optimal policy?
 *  - What goes wrong if you shape with F = Φ(s_{t+1}) (no difference)?
 */
export function shapedRewards(rewards: number[], potentials: number[], gamma: number): number[] {
  void rewards;
  void potentials;
  void gamma;
  throw notYoursYet({
    file: FILE,
    fn: "shapedRewards",
    milestone: "m5-reward-shaping",
    summary: "Dense, policy-invariant reward from a potential. Powers the scoreboard.",
  });
}

import { notYoursYet } from "@/kit/not-yours-yet";

const FILE = "src/projects/ppo-arena/core/gae.ts";

/**
 * Generalised Advantage Estimation (Schulman et al., 2016).
 *
 * Maths:   δ_t   = r_t + γ (1 − d_t) V(s_{t+1}) − V(s_t)                 (TD residual)
 *          Â_t   = Σ_{l≥0} (γλ)^l δ_{t+l}                                  (stopping at the episode end)
 *          where V(s_{t+1}) is values[t+1], or lastValue at the final step, and d_t = dones[t].
 *
 * Signature: gae(rewards: number[], values: number[], dones: boolean[], gamma: number, lambda: number, lastValue?: number) => number[]
 *   rewards, values, dones all have length T. values[t] = V(s_t) from the critic.
 *   lastValue = V(s_T) for the state after the final step (default 0).
 *   Returns the advantages Â, length T. (The value target is then Â_t + V(s_t); the plumbing does that.)
 *
 * On paper first:
 *  - Write Â_t in terms of δ_t and Â_{t+1}. Where does (1 − d_t) have to appear, and why twice?
 *  - Set λ = 0. What is Â_t? Set λ = 1: show Â_t + V(s_t) is the discounted return from M1.
 *  - Which end of the λ dial has more bias and which more variance? Where does the bias come from?
 *  - If the critic were perfect (V = V^π), what is E[δ_t]?
 */
export function gae(
  rewards: number[],
  values: number[],
  dones: boolean[],
  gamma: number,
  lambda: number,
  lastValue = 0,
): number[] {
  void rewards;
  void values;
  void dones;
  void gamma;
  void lambda;
  void lastValue;
  throw notYoursYet({
    file: FILE,
    fn: "gae",
    milestone: "m2-gae",
    summary: "Blends TD residuals with (γλ)^l into low-variance advantages for every step.",
  });
}

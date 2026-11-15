import { notYoursYet } from "@/kit/not-yours-yet";

const FILE = "src/projects/ppo-arena/core/value-loss.ts";

/**
 * Critic loss for one sample, with optional PPO-style value clipping. This is MINIMISED.
 *
 * Maths:   unclipped:  L^V = ½ (V − R)²
 *          clipped:    V_c = V_old + clip(V − V_old, −c, +c)
 *                      L^V = ½ max( (V − R)², (V_c − R)² )
 *          V = the critic's current prediction, R = the value target (Â + V_old from GAE),
 *          V_old = the prediction when the rollout was collected.
 *
 * Signature: valueLoss(value: number, target: number, oldValue: number, clip: number | null) => number
 *   clip = null (or ≤ 0) means no clipping: just ½ (V − R)². Always ≥ 0.
 *
 * On paper first:
 *  - ∂L^V/∂V for the unclipped loss. Why the ½?
 *  - With clipping: when is the gradient zero? Draw L^V against V with V_old and R marked, for R > V_old + c.
 *  - Why max (pessimistic) here when the policy term used min? (One is minimised, one maximised.)
 */
export function valueLoss(value: number, target: number, oldValue: number, clip: number | null): number {
  void value;
  void target;
  void oldValue;
  void clip;
  throw notYoursYet({
    file: FILE,
    fn: "valueLoss",
    milestone: "m5-train",
    summary: "Squared error for the critic, clipped like the policy. Trains V(s).",
  });
}

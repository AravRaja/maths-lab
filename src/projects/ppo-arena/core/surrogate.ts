import { notYoursYet } from "@/kit/not-yours-yet";

const FILE = "src/projects/ppo-arena/core/surrogate.ts";

/**
 * PPO's clipped surrogate objective for one sample (Schulman et al., 2017). This is MAXIMISED.
 *
 * Maths:   r      = π_θ(a | s) / π_θ_old(a | s)          (the probability ratio; r = 1 before any update)
 *          L^CLIP = min( r Â,  clip(r, 1 − ε, 1 + ε) Â )
 *
 * Signature: clippedSurrogate(ratio: number, advantage: number, epsilon: number) => number
 *   ratio > 0, advantage any real, 0 < ε < 1 (0.2 is the classic value).
 *
 * On paper first:
 *  - Sketch L^CLIP against r for Â > 0, then for Â < 0. Mark 1 − ε and 1 + ε. Where is it flat?
 *  - Where is the gradient with respect to r zero? Say in words why that stops a big update.
 *  - Why the min and not just the clipped term? (Hint: which side is pessimistic when Â < 0 and r < 1 − ε?)
 *  - At r = 1 what are the value and the slope? Compare with the vanilla policy-gradient objective.
 */
export function clippedSurrogate(ratio: number, advantage: number, epsilon: number): number {
  void ratio;
  void advantage;
  void epsilon;
  throw notYoursYet({
    file: FILE,
    fn: "clippedSurrogate",
    milestone: "m4-clip",
    summary: "min(rÂ, clip(r)Â): the trust region that keeps each update small.",
  });
}

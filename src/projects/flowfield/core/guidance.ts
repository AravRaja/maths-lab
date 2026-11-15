import { notYoursYet } from "@/kit/not-yours-yet";

const FILE = "src/projects/flowfield/core/guidance.ts";

/**
 * Classifier-free guidance for a flow: blend the conditional and unconditional velocities.
 *
 * One network learns both v(x, t | c) (told which glyph or which robot context) and v(x, t | ∅)
 * (told nothing). At sampling time you push away from the unconditional field:
 *
 *   Maths:   ṽ = v(x, t | ∅) + w · ( v(x, t | c) − v(x, t | ∅) )
 *
 * Signature: guidedVelocity(vCond: number[], vUncond: number[], w: number) => number[]   (length d)
 *
 * On paper first:
 *  - What do w = 0 and w = 1 give? What happens for w > 1, geometrically, with two arrows drawn
 *    from the same point?
 *  - For a diffusion model the velocity is an affine function of the score ∇ log p_t. Assuming that,
 *    show the guided field corresponds to sampling from something ∝ p_t(x | c)^w · p_t(x)^(1 − w).
 *    Use Bayes to rewrite it with p_t(c | x): why is it called "classifier-free"?
 *  - Predict: as w grows past 1, do samples get more varied or less?
 */
export function guidedVelocity(vCond: number[], vUncond: number[], w: number): number[] {
  void vCond;
  void vUncond;
  void w;
  throw notYoursYet({
    file: FILE,
    fn: "guidedVelocity",
    milestone: "m5-condition",
    summary: "Blends conditional and unconditional velocities with guidance weight w.",
  });
}

/**
 * Context dropout: the training-time half of classifier-free guidance. With probability pDrop the
 * network is shown no label, so the same weights also learn v(x, t | ∅).
 *
 * Signature: dropLabel(label: number, pDrop: number, u: number) => number
 *   u is one uniform draw in [0, 1) supplied by the training loop. Return `label`, or `nullLabel`
 *   (−1 by default) to mean "no context". Over many u, the drop rate must be pDrop.
 *
 * On paper first:
 *  - If pDrop = 0, what does guidedVelocity end up mixing in at sampling time? If pDrop = 1?
 *  - Why is it fine for one network to learn both fields instead of training two networks?
 */
export function dropLabel(label: number, pDrop: number, u: number, nullLabel = -1): number {
  void label;
  void pDrop;
  void u;
  void nullLabel;
  throw notYoursYet({
    file: FILE,
    fn: "dropLabel",
    milestone: "m5-condition",
    summary: "Hides the label with probability pDrop so the net also learns the unconditional field.",
  });
}

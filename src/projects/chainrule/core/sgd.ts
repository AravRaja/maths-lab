import { notYoursYet } from "@/kit/not-yours-yet";

const FILE = "src/projects/chainrule/core/sgd.ts";
const M = "m4-sgd";

export interface SgdOptions {
  /** Learning rate η > 0. */
  lr: number;
  /** Momentum μ in [0, 1). 0 = plain SGD. */
  momentum?: number;
  /** L2 weight decay λ ≥ 0, added to the gradient as λθ. */
  weightDecay?: number;
}

/**
 * One step of SGD with (heavy-ball) momentum and weight decay, PyTorch's convention.
 *
 * Maths:   d = g + λθ
 *          v ← μ·v + d
 *          θ ← θ − η·v
 * Signature: sgdStep(params: number[], grads: number[], velocity: number[], opts: SgdOptions)
 *              => { params: number[]; velocity: number[] }      (new arrays, all the same length)
 *   - don't mutate the inputs; velocity starts as all zeros.
 *
 * On paper first:
 *  - Plain SGD (μ = 0) on f(θ) = ½aθ²: write θₜ₊₁ in terms of θₜ. For which η does it converge?
 *    What happens exactly at η = 1/a? Just above 2/a?
 *  - With momentum and a constant gradient g, v settles at what value? So what is the
 *    "effective" learning rate?
 *  - Show weight decay is the gradient of (λ/2)‖θ‖².
 */
export function sgdStep(
  params: number[],
  grads: number[],
  velocity: number[],
  opts: SgdOptions,
): { params: number[]; velocity: number[] } {
  void params; void grads; void velocity; void opts;
  throw notYoursYet({ file: FILE, fn: "sgdStep", milestone: M, summary: "Moves the parameters downhill: θ ← θ − η·v with momentum." });
}

import { notYoursYet } from "@/kit/not-yours-yet";

const FILE = "src/projects/daydream/core/reparam.ts";
const M = "m1-reparam";

/**
 * The reparameterisation trick: draw z ~ N(μ, diag σ²) as a deterministic function of (μ, log σ²)
 * and outside noise ε ~ N(0, I), so gradients can flow back into μ and log σ².
 *
 * Maths:   σ_i = exp(½ · logvar_i)
 *          z_i = μ_i + σ_i · ε_i
 * Signature: reparameterise(mu: ArrayLike<number>, logvar: ArrayLike<number>, eps: ArrayLike<number>) => number[]
 *   - all three have length d (the latent size, 2 on this page); return a new array of length d.
 *   - the encoder outputs log σ², not σ: it can be any real number, which keeps σ > 0 for free.
 *
 * On paper first:
 *  - Show that z defined this way really has mean μ_i and variance exp(logvar_i).
 *  - Why can't you backpropagate through "sample z from N(μ, σ²)" directly, but you can through this?
 *  - What does z equal when ε = 0? When logvar_i → −∞?
 */
export function reparameterise(mu: ArrayLike<number>, logvar: ArrayLike<number>, eps: ArrayLike<number>): number[] {
  void mu; void logvar; void eps;
  throw notYoursYet({ file: FILE, fn: "reparameterise", milestone: M, summary: "Turns (μ, log σ², noise ε) into a latent sample z that gradients can flow through." });
}

/**
 * Backward pass of reparameterise: given dL/dz, return dL/dμ and dL/dlogvar (ε is held fixed).
 *
 * Maths:   chain rule through z_i = μ_i + exp(½ · logvar_i) · ε_i, one coordinate at a time.
 * Signature: reparameteriseBackward(logvar: ArrayLike<number>, eps: ArrayLike<number>, dz: ArrayLike<number>)
 *              => { dmu: number[]; dlogvar: number[] }      (each length d)
 *
 * On paper first:
 *  - Write ∂z_i/∂μ_i and ∂z_i/∂logvar_i. Why are all the cross terms (i ≠ j) zero?
 *  - Express ∂z_i/∂logvar_i using σ_i and ε_i, then using (z_i − μ_i). Same thing?
 *  - If dz is the same for every sample, what is the *average* dlogvar over many ε? Why?
 */
export function reparameteriseBackward(
  logvar: ArrayLike<number>,
  eps: ArrayLike<number>,
  dz: ArrayLike<number>,
): { dmu: number[]; dlogvar: number[] } {
  void logvar; void eps; void dz;
  throw notYoursYet({ file: FILE, fn: "reparameteriseBackward", milestone: M, summary: "Sends dL/dz back to dL/dμ and dL/dlog σ²: the pathwise gradient." });
}

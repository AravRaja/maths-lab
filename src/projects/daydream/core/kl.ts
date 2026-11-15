import { notYoursYet } from "@/kit/not-yours-yet";

const FILE = "src/projects/daydream/core/kl.ts";
const M = "m2-kl";

/**
 * KL divergence from the encoder's Gaussian to the standard-normal prior, in closed form.
 *
 * Maths:   KL( N(μ, diag e^{logvar}) ‖ N(0, I) ) = ∫ q(z) log( q(z) / p(z) ) dz
 *          It factorises over dimensions, so derive the 1-D case and sum.
 * Signature: gaussianKL(mu: ArrayLike<number>, logvar: ArrayLike<number>) => number   (in nats, ≥ 0)
 *
 * On paper first:
 *  - Write log q(z) − log p(z) for one dimension. Take its expectation under q using
 *    E_q[z] = μ and E_q[z²] = μ² + σ². Every term should collapse to μ, σ² and log σ².
 *  - Check your formula is 0 exactly when μ = 0, logvar = 0, and positive otherwise.
 *  - Which costs more: being off by μ = 1, or having σ² = e (logvar = 1)?
 */
export function gaussianKL(mu: ArrayLike<number>, logvar: ArrayLike<number>): number {
  void mu; void logvar;
  throw notYoursYet({ file: FILE, fn: "gaussianKL", milestone: M, summary: "How far the encoder's Gaussian is from the N(0, I) prior, in nats." });
}

/**
 * Gradient of gaussianKL with respect to μ and logvar.
 *
 * Signature: gaussianKLGrad(mu: ArrayLike<number>, logvar: ArrayLike<number>) => { dmu: number[]; dlogvar: number[] }
 *
 * On paper first:
 *  - Differentiate your closed form. Where is dKL/dlogvar zero? Is that a minimum?
 *  - Read the two gradients as forces: what is the prior "pulling" μ and σ² towards?
 */
export function gaussianKLGrad(mu: ArrayLike<number>, logvar: ArrayLike<number>): { dmu: number[]; dlogvar: number[] } {
  void mu; void logvar;
  throw notYoursYet({ file: FILE, fn: "gaussianKLGrad", milestone: M, summary: "The prior's pull on μ and log σ²: the gradient of the KL term." });
}

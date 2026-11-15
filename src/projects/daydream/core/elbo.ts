import { notYoursYet } from "@/kit/not-yours-yet";

const FILE = "src/projects/daydream/core/elbo.ts";
const M = "m3-elbo";

/**
 * Log-likelihood of a frame under the decoder's independent-Bernoulli pixels, given logits.
 *
 * Maths:   p_i = σ(ℓ_i) = 1 / (1 + e^{−ℓ_i})
 *          log p(x | z) = Σ_i [ x_i log p_i + (1 − x_i) log(1 − p_i) ]
 *          Pixels here are greys in [0, 1], not just 0/1; the same formula is used (it's a cross-entropy).
 * Signature: bernoulliLogLik(x: ArrayLike<number>, logits: ArrayLike<number>) => number   (≤ 0)
 *
 * On paper first:
 *  - Rewrite log σ(ℓ) and log(1 − σ(ℓ)) in terms of ℓ and log(1 + e^{±ℓ}). Which form never
 *    overflows for ℓ = ±100? (The tests feed it ±100 and expect finite, accurate answers.)
 *  - Why does the decoder output logits rather than probabilities?
 */
export function bernoulliLogLik(x: ArrayLike<number>, logits: ArrayLike<number>): number {
  void x; void logits;
  throw notYoursYet({ file: FILE, fn: "bernoulliLogLik", milestone: M, summary: "How well the decoded frame explains the real one: log p(x | z)." });
}

/**
 * Gradient of bernoulliLogLik with respect to the logits.
 *
 * Signature: bernoulliLogLikGrad(x: ArrayLike<number>, logits: ArrayLike<number>) => number[]   (length = pixels)
 *
 * On paper first:
 *  - Use σ'(ℓ) = σ(ℓ)(1 − σ(ℓ)). The answer for one pixel is famously short. What is it?
 *  - What sign does it have for a pixel that is too dark in the reconstruction?
 */
export function bernoulliLogLikGrad(x: ArrayLike<number>, logits: ArrayLike<number>): number[] {
  void x; void logits;
  throw notYoursYet({ file: FILE, fn: "bernoulliLogLikGrad", milestone: M, summary: "Per-pixel gradient of log p(x | z): the signal that teaches the decoder." });
}

export interface ElboParts {
  /** The (β-weighted) evidence lower bound for this frame, in nats. */
  elbo: number;
  /** log p(x | z) for the single sample of z that produced `logits`. */
  recon: number;
  /** KL(q(z | x) ‖ p(z)). */
  kl: number;
}

/**
 * The single-sample, β-weighted evidence lower bound for one frame.
 *
 * Maths:   log p(x) ≥ E_{q(z|x)}[ log p(x | z) ] − KL( q(z | x) ‖ p(z) )
 *          one-sample estimate with z = reparameterise(μ, logvar, ε) already decoded to `logits`;
 *          β scales the KL term (β = 1 is the true bound, the β-VAE uses others).
 * Signature: elbo(x, logits, mu, logvar, beta: number) => ElboParts
 *   - x, logits: length = pixels; mu, logvar: length = latent size.
 *   - use your bernoulliLogLik and gaussianKL.
 *
 * On paper first:
 *  - Derive the bound from log p(x) = log ∫ p(x|z) p(z) dz with Jensen's inequality, or from
 *    log p(x) = ELBO + KL(q(z|x) ‖ p(z|x)). What is the gap, exactly?
 *  - The trainer *maximises* this. Which term wants σ small, and which wants it near 1?
 */
export function elbo(
  x: ArrayLike<number>,
  logits: ArrayLike<number>,
  mu: ArrayLike<number>,
  logvar: ArrayLike<number>,
  beta: number,
): ElboParts {
  void x; void logits; void mu; void logvar; void beta;
  throw notYoursYet({ file: FILE, fn: "elbo", milestone: M, summary: "Reconstruction minus β·KL: the number the VAE climbs." });
}

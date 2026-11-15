import { notYoursYet } from "@/kit/not-yours-yet";

const FILE = "src/projects/daydream/core/surprise.ts";
const M = "m5-surprise";

/**
 * KL divergence between two diagonal Gaussians: how far what the eyes see (the encoder's
 * posterior q) is from what the model expected to see (the dynamics prediction p).
 *
 * Maths:   KL( N(μ_q, diag e^{lv_q}) ‖ N(μ_p, diag e^{lv_p}) )
 *          Generalise your m2 derivation: the prior is no longer N(0, 1).
 * Signature: diagGaussianKL(muQ, logvarQ, muP, logvarP) => number   (all length d; nats, ≥ 0)
 *
 * On paper first:
 *  - Redo the 1-D expectation E_q[log q − log p] with p = N(μ_p, σ_p²).
 *    You'll need E_q[(z − μ_p)²]; write it in terms of μ_q − μ_p and σ_q².
 *  - Check it reduces to gaussianKL when μ_p = 0, lv_p = 0.
 *  - Is KL(q‖p) = KL(p‖q)? Find a 1-D example where they differ by a lot.
 */
export function diagGaussianKL(
  muQ: ArrayLike<number>,
  logvarQ: ArrayLike<number>,
  muP: ArrayLike<number>,
  logvarP: ArrayLike<number>,
): number {
  void muQ; void logvarQ; void muP; void logvarP;
  throw notYoursYet({ file: FILE, fn: "diagGaussianKL", milestone: M, summary: "Surprise: KL from what the eyes see to what the dream predicted." });
}

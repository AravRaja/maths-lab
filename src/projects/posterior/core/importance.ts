import { notYoursYet } from "@/kit/not-yours-yet";

const FILE = "src/projects/posterior/core/importance.ts";

/**
 * Self-normalised importance weights, computed in log space.
 *
 * Maths:   want E_p[f] but can only sample x_i ~ q.
 *          E_p[f] = E_q[ f(X) p(X)/q(X) ]
 *          raw weight  w_i = p(x_i) / q(x_i)
 *          normalised  w̃_i = w_i / Σ_j w_j     (so Σ w̃ = 1, and E_p[f] ≈ Σ w̃_i f(x_i))
 *
 * Signature: importanceWeights(logp: ArrayLike<number>, logq: ArrayLike<number>) => Float64Array
 *   logp[i] = log p(x_i) up to an unknown additive constant (p may be unnormalised),
 *   logq[i] = log q(x_i). Same length n. Returns n normalised weights, each in [0, 1], summing to 1.
 *
 * On paper first:
 *  - Prove the identity E_p[f] = E_q[f p/q]. What must be true of q where p > 0?
 *  - Show that adding a constant c to every logp leaves w̃ unchanged. Why does that mean you never
 *    need p's normalising constant here?
 *  - log weights like −1000 make exp() return 0 for every sample, then 0/0. Use the same constant
 *    trick to make it stable ("log-sum-exp"). Which constant is the safe choice?
 */
export function importanceWeights(logp: ArrayLike<number>, logq: ArrayLike<number>): Float64Array {
  void logp; void logq;
  throw notYoursYet({ file: FILE, fn: "importanceWeights", milestone: "m5-importance", summary: "Reweights samples from the wrong distribution so they average like the right one." });
}

/**
 * Effective sample size of a set of importance weights (Kish's ESS).
 *
 * Maths:   ESS = (Σ w_i)² / Σ w_i²
 *
 * Signature: effectiveSampleSize(weights: ArrayLike<number>) => number    // in [1, n]
 *   Weights are ≥ 0 and need not be normalised.
 *
 * On paper first:
 *  - Show the formula doesn't change if every weight is scaled by the same c > 0.
 *  - What is ESS when all weights are equal? When one weight holds everything?
 *  - Where does it come from: compare Var of a weighted mean of n i.i.d. values with Var of a plain
 *    mean of m values. Which m makes them equal?
 */
export function effectiveSampleSize(weights: ArrayLike<number>): number {
  void weights;
  throw notYoursYet({ file: FILE, fn: "effectiveSampleSize", milestone: "m5-importance", summary: "How many samples your weighted pile is really worth. The gauge under the weight comb." });
}

import { notYoursYet } from "@/kit/not-yours-yet";
import type { Gauss2, Mat2, Normal } from "./types";

const FILE = "src/projects/posterior/core/gaussian2d.ts";

/**
 * Cholesky factor of a 2x2 covariance: the "square root" used to sample.
 *
 * Maths:   find lower-triangular L with positive diagonal such that L Lᵀ = Σ.
 *          Then if z ~ N(0, I), x = μ + L z has covariance Σ.
 *
 * Signature: cholesky2(cov: Mat2) => Mat2    // [[l00, 0], [l10, l11]]
 *   `cov` is symmetric positive definite. Return 0 in the upper-right entry.
 *
 * On paper first:
 *  - Write L = [[p, 0], [q, r]], multiply out L Lᵀ and match entries. Solve for p, then q, then r.
 *  - Prove Cov(μ + Lz) = L Lᵀ.
 *  - What goes wrong (inside a square root) when the correlation hits ±1?
 */
export function cholesky2(cov: Mat2): Mat2 {
  void cov;
  throw notYoursYet({ file: FILE, fn: "cholesky2", milestone: "m3-gaussian", summary: "Factor Σ = L Lᵀ so the page can draw samples x = μ + L z." });
}

/**
 * Marginal of a 2D Gaussian along one axis.
 *
 * Maths:   p(x) = ∫ p(x, y) dy   (axis 0)   or   p(y) = ∫ p(x, y) dx   (axis 1)
 *
 * Signature: marginal(g: Gauss2, axis: 0 | 1) => Normal   // { mean, variance }
 *
 * On paper first:
 *  - You could do the integral by completing the square. Or: x = [1 0]·(x, y) is a linear map of a
 *    Gaussian. What is the mean and variance of A·X when X ~ N(μ, Σ)?
 *  - Does the correlation affect the marginal at all?
 */
export function marginal(g: Gauss2, axis: 0 | 1): Normal {
  void g; void axis;
  throw notYoursYet({ file: FILE, fn: "marginal", milestone: "m3-gaussian", summary: "The shadow the 2D Gaussian casts on one axis." });
}

/**
 * Condition a 2D Gaussian on one coordinate: observe it, get the distribution of the other.
 *
 * Maths:   observedAxis = 0 :  p(y | x = value) ∝ p(x = value, y)
 *          observedAxis = 1 :  p(x | y = value) ∝ p(x, y = value)
 *          The answer is a 1D Gaussian.
 *
 * Signature: condition(g: Gauss2, observedAxis: 0 | 1, value: number) => Normal
 *   Returns the distribution of the OTHER axis.
 *
 * On paper first:
 *  - Fix x, write log p(x, y) as a quadratic in y and complete the square. Read off mean and variance.
 *    (Using the precision matrix Λ = Σ⁻¹ makes this cleaner. Then convert back to Σ entries.)
 *  - The conditional mean is a straight line in `value`. What is its slope? Where have you seen it before?
 *  - The conditional variance does not depend on `value`. Is it ever bigger than the marginal variance?
 *  - Sanity: what happens at correlation 0? At correlation → ±1?
 */
export function condition(g: Gauss2, observedAxis: 0 | 1, value: number): Normal {
  void g; void observedAxis; void value;
  throw notYoursYet({ file: FILE, fn: "condition", milestone: "m3-gaussian", summary: "Observe one coordinate and get the Gaussian over the other: the slice through the cloud." });
}

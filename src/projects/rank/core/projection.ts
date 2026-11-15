import { notYoursYet } from "@/kit/not-yours-yet";

const FILE = "src/projects/rank/core/projection.ts";

/**
 * Gram–Schmidt: turn a list of vectors into an orthonormal basis for their span.
 *
 * Maths:
 *   Given a_1 … a_p in ℝⁿ, produce q_1 … q_r (r ≤ p) with
 *     q_i · q_j = δ_ij           (orthonormal)
 *     span(q_1 … q_j) = span(a_1 … a_j's that survived)
 *   Each a_j has its components along the q's found so far removed; what is left, normalised,
 *   is the next q. If what is left is tiny compared with a_j itself, a_j was (numerically) in the
 *   span already: drop it.
 *
 * Signature:
 *   gramSchmidt(vectors: Float64Array[], tol = 1e-10) => Float64Array[]
 *   - every input has the same length n; inputs must not be mutated
 *   - output vectors have length n and unit norm; order follows the input order
 *   - q_1 is a positive multiple of the first non-zero input
 *   - drop a_j when ‖what is left of a_j‖ ≤ tol · ‖a_j‖ (and drop zero vectors)
 *
 * On paper first:
 *   - Do a_1 = (3, 4, 0), a_2 = (1, 1, 1) by hand. Check q_1 · q_2 = 0.
 *   - There are two ways to remove the components: subtract all the projections of the
 *     *original* a_j at once ("classical"), or subtract them one at a time from the
 *     *running remainder* ("modified"). In exact arithmetic they agree. Try both on
 *     a_1 = (1, ε, 0, 0), a_2 = (1, 0, ε, 0), a_3 = (1, 0, 0, ε) with ε small, keeping only
 *     terms a computer would keep (1 + ε² = 1). Which one keeps q_2 · q_3 near 0?
 *     The tests check this.
 *   - Why does the tolerance have to be relative to ‖a_j‖ rather than absolute?
 */
export function gramSchmidt(vectors: Float64Array[], tol = 1e-10): Float64Array[] {
  void vectors;
  void tol;
  throw notYoursYet({ file: FILE, fn: "gramSchmidt", milestone: "m1-projection", summary: "Turns any set of vectors into an orthonormal basis for their span." });
}

/**
 * Orthogonal projection of x onto the subspace spanned by an orthonormal basis.
 *
 * Maths:
 *   With Q = [q_1 … q_k] (n × k, QᵀQ = I), the projection is P x = Q Qᵀ x.
 *   It is the closest point to x in span(Q): ‖x − P x‖ ≤ ‖x − y‖ for every y in the span.
 *
 * Signature:
 *   projectOnto(basis: Float64Array[], x: Float64Array) => Float64Array
 *   - basis: k orthonormal vectors of length n (k may be 0: the subspace {0})
 *   - x: length n, not mutated; returns a new vector of length n
 *
 * On paper first:
 *   - Show P² = P and Pᵀ = P. What do those two facts say geometrically?
 *   - Show the residual r = x − P x is orthogonal to every q_i. Then prove Pythagoras:
 *     ‖x‖² = ‖P x‖² + ‖r‖².
 *   - Why does Q Qᵀ x need QᵀQ = I? What is the right formula if the basis A is merely
 *     independent, not orthonormal? (Normal equations: you'll meet them again in least squares.)
 *   - Cost: how many multiplications for k basis vectors of length n? Compare with forming
 *     the n × n matrix Q Qᵀ first.
 */
export function projectOnto(basis: Float64Array[], x: Float64Array): Float64Array {
  void basis;
  void x;
  throw notYoursYet({ file: FILE, fn: "projectOnto", milestone: "m1-projection", summary: "Drops a vector onto a subspace: the closest point in the span of an orthonormal basis." });
}

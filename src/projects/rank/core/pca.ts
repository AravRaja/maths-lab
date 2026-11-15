import { notYoursYet } from "@/kit/not-yours-yet";
import type { Matrix, PCA } from "./types";

const FILE = "src/projects/rank/core/pca.ts";

/**
 * Subtract the mean sample from every sample.
 *
 * Signature:
 *   meanCenter(X: Matrix) => { mean: Float64Array; centered: Matrix }
 *   - X is n × d, one sample per row; mean has length d; centered is a new n × d Matrix
 *   - X is not mutated
 *
 * On paper first:
 *   - Show the columns of `centered` each sum to 0.
 *   - Why does PCA without centring mostly rediscover the mean? (Look at the first layer of a
 *     photo in the compressor: what does it look like?)
 */
export function meanCenter(X: Matrix): { mean: Float64Array; centered: Matrix } {
  void X;
  throw notYoursYet({ file: FILE, fn: "meanCenter", milestone: "m5-eigenfaces", summary: "Subtracts the average face from every face." });
}

/**
 * Principal component analysis via the SVD of the centred data.
 *
 * Maths:
 *   With X̃ the centred data (n × d), the sample covariance is C = X̃ᵀX̃ / (n − 1).
 *   The principal components are the top eigenvectors of C; the variance along each is its
 *   eigenvalue. Relate both to the SVD X̃ = U Σ Vᵀ.
 *
 * Signature:
 *   pca(X: Matrix, k: number) => PCA        (see core/types.ts)
 *   - X: n × d raw data, rows are samples (centre it yourself)
 *   - components: k unit vectors of length d, orthonormal, largest variance first
 *   - variances: k numbers, using the (n − 1) convention
 *   - use the library SVD: import { svd } from "../lib/svd"
 *
 * On paper first:
 *   - Substitute X̃ = U Σ Vᵀ into C. Which matrix holds the eigenvectors, and what are the
 *     eigenvalues in terms of σ_i and n?
 *   - Faces here are 28 × 32 = 896 pixels and there are a few hundred of them. Which is
 *     cheaper: eigendecomposing the 896 × 896 matrix C, or an SVD of X̃? How many non-zero
 *     variances can there be at most?
 *   - Why is SVD numerically kinder than forming C at all?
 */
export function pca(X: Matrix, k: number): PCA {
  void X;
  void k;
  throw notYoursYet({ file: FILE, fn: "pca", milestone: "m5-eigenfaces", summary: "Finds the eigenfaces: the directions faces vary along most." });
}

/**
 * Coordinates of a sample in face space.
 *
 * Maths:
 *   c_j = q_jᵀ (x − μ),  j = 1 … k, with q_j the components and μ the mean.
 *
 * Signature:
 *   encode(x: ArrayLike<number>, p: PCA, k = p.components.length) => Float64Array   (length k)
 *
 * On paper first:
 *   - This is a projection onto span(q_1 … q_k), done in coordinates. Which M1 function is it
 *     secretly, and what is different?
 */
export function encode(x: ArrayLike<number>, p: PCA, k?: number): Float64Array {
  void x;
  void p;
  void k;
  throw notYoursYet({ file: FILE, fn: "encode", milestone: "m5-eigenfaces", summary: "Turns a face into a handful of eigenface weights." });
}

/**
 * Rebuild a sample from its first coefficients.
 *
 * Maths:
 *   x̂ = μ + Σ_{j < c.length} c_j q_j
 *
 * Signature:
 *   decode(c: ArrayLike<number>, p: PCA) => Float64Array    (length d)
 *   - c may be shorter than p.components (use only that many components)
 *
 * On paper first:
 *   - decode(encode(x, p, k), p) is the best approximation of x by mean + k components. In what
 *     sense is it best, and why does the error never increase as k grows?
 *   - What face do you get for c = 0? For c = (3·sqrt(variance_1), 0, 0, …)?
 */
export function decode(c: ArrayLike<number>, p: PCA): Float64Array {
  void c;
  void p;
  throw notYoursYet({ file: FILE, fn: "decode", milestone: "m5-eigenfaces", summary: "Paints a face from eigenface weights." });
}

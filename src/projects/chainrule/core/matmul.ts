import { notYoursYet } from "@/kit/not-yours-yet";

const FILE = "src/projects/chainrule/core/matmul.ts";
const M = "m5-matmul";

/** Row-major matrix as nested arrays: M[i][j], rows × cols. */
export type Matrix = number[][];

/**
 * Backward rule for a matrix product: the op that makes real networks fast.
 *
 * Forward:  C = A·B,   A is m×k, B is k×n, C is m×n,   Cᵢⱼ = Σₚ Aᵢₚ Bₚⱼ
 * Given:    G = ∂L/∂C  (m×n)
 * Return:   { dA: ∂L/∂A (m×k), dB: ∂L/∂B (k×n) }
 * Signature: matmulBackward(A: Matrix, B: Matrix, G: Matrix) => { dA: Matrix; dB: Matrix }
 *
 * On paper first:
 *  - Write ∂L/∂Aᵢₚ = Σᵢ'ⱼ (∂L/∂Cᵢ'ⱼ)(∂Cᵢ'ⱼ/∂Aᵢₚ). Which terms survive? Recognise the sum as a
 *    matrix product of G with something transposed.
 *  - Shape check only: dA must be m×k. Out of G (m×n), A (m×k) and B (k×n), which product
 *    (with which transposes) has that shape? Same for dB.
 *  - Sanity check with k = 1 (an outer product) and with m = n = 1 (a dot product).
 */
export function matmulBackward(A: Matrix, B: Matrix, G: Matrix): { dA: Matrix; dB: Matrix } {
  void A; void B; void G;
  throw notYoursYet({ file: FILE, fn: "matmulBackward", milestone: M, summary: "Backward rule for C = A·B: two matrix products with a transpose each." });
}

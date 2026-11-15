import { notYoursYet } from "@/kit/not-yours-yet";
import type { Matrix, SVD } from "./types";

const FILE = "src/projects/rank/core/lowrank.ts";

/**
 * The rank-k approximation of A from its SVD.
 *
 * Maths:
 *   A = U Σ Vᵀ = Σ_{i=1..r} σ_i u_i v_iᵀ   (a sum of r rank-one "layers")
 *   A_k keeps the k layers with the largest σ_i.
 *
 * Signature:
 *   rankK(s: SVD, k: number) => Matrix
 *   - s is the library SVD of an m × n matrix (see core/types.ts for the layout of U, S, V;
 *     columns are already sorted by σ, largest first)
 *   - returns a new m × n Matrix; must not mutate s
 *   - k = 0 gives the zero matrix; k ≥ r gives A back (clamp k to [0, r])
 *
 * On paper first:
 *   - Write A_k as a product of three matrices built from U, Σ, V. What are their shapes?
 *   - Show that u_i v_iᵀ really has rank one: what is its column space?
 *   - Entry (a, b) of A_k as a sum over i. Which loop order touches memory in order for
 *     row-major U and V?
 *   - For a 2 × 2 example, A = [[3, 0], [0, 1]], what is A_1?
 */
export function rankK(s: SVD, k: number): Matrix {
  void s;
  void k;
  throw notYoursYet({ file: FILE, fn: "rankK", milestone: "m2-rank-k", summary: "Rebuilds the image from its k strongest rank-one layers." });
}

/**
 * How many numbers you must store to rebuild A_k exactly.
 *
 * Signature:
 *   storageCost(m: number, n: number, k: number) => number
 *   - A is m × n; k is clamped to [0, min(m, n)]
 *   - count every number in the truncated factors you would need to keep
 *
 * On paper first:
 *   - Which pieces of U, Σ, V does A_k use? Count them.
 *   - For a 160 × 160 image, at what k does storing the factors stop beating storing the pixels?
 *   - (Optional) Σ can be folded into U or V. How many numbers does that save, and why might
 *     you keep it separate anyway?
 */
export function storageCost(m: number, n: number, k: number): number {
  void m;
  void n;
  void k;
  throw notYoursYet({ file: FILE, fn: "storageCost", milestone: "m2-rank-k", summary: "Counts the numbers needed to store the rank-k factors." });
}

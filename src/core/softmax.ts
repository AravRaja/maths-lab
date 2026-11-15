import { notYoursYet } from "@/lib/kit/not-yours-yet";

/*
 * EXAMPLE CORE (delete or replace when you create a project from this template).
 * It shows the shape every core follows: a JSDoc spec, a typed signature, and a stub
 * that throws NotYoursYet until you write the maths.
 */

const FILE = "src/core/softmax.ts";

/**
 * Log-sum-exp, computed stably.
 *
 * Maths:   LSE(z) = log Σ_i exp(z_i)
 * Signature: logSumExp(z: number[]) => number      (z has length n ≥ 1)
 *
 * On paper first:
 *  - Show LSE(z) = c + LSE(z - c) for any constant c. Which c stops exp() overflowing?
 *  - What is ∂LSE/∂z_i? (You will meet this function again in softmax.)
 *  - What are the bounds max(z) ≤ LSE(z) ≤ max(z) + log n telling you?
 */
export function logSumExp(z: number[]): number {
  void z;
  throw notYoursYet({ file: FILE, fn: "logSumExp", milestone: "m1-softmax", summary: "Stable log Σ exp(z): the normaliser behind every softmax policy." });
}

/**
 * Softmax with temperature.
 *
 * Maths:   softmax(z / τ)_i = exp(z_i / τ) / Σ_j exp(z_j / τ)
 * Signature: softmax(z: number[], temperature = 1) => number[]   (same length as z, entries in (0,1), sum 1)
 *
 * On paper first:
 *  - Write softmax in terms of logSumExp so it never overflows.
 *  - What happens as τ → 0⁺? As τ → ∞?
 *  - Why is softmax(z + c) = softmax(z)?
 */
export function softmax(z: number[], temperature = 1): number[] {
  void z;
  void temperature;
  throw notYoursYet({ file: FILE, fn: "softmax", milestone: "m1-softmax", summary: "Turns logits into a probability distribution, sharpened or flattened by τ." });
}

import { notYoursYet } from "@/kit/not-yours-yet";

const FILE = "src/projects/chainrule/core/gradcheck.ts";
const M = "m3-gradcheck";

/**
 * Numerical gradient by central finite differences.
 *
 * Maths:   ∂f/∂xᵢ ≈ ( f(x + h·eᵢ) − f(x − h·eᵢ) ) / 2h
 * Signature: numericalGrad(f: (x: number[]) => number, x: number[], h = 1e-5) => number[]   (same length as x)
 *   - must not change the caller's x (hand f a copy, or put xᵢ back exactly afterwards).
 *
 * On paper first:
 *  - Taylor-expand f(x ± h·eᵢ) to third order. Show the central difference has error O(h²)
 *    while the one-sided (f(x+h) − f(x))/h has error O(h).
 *  - Floating point: f is only known to about ε ≈ 1e-16 relative accuracy. Roughly how big is the
 *    round-off error in the quotient? Balance it against the O(h²) term: which h minimises the total?
 */
export function numericalGrad(f: (x: number[]) => number, x: number[], h = 1e-5): number[] {
  void f; void x; void h;
  throw notYoursYet({ file: FILE, fn: "numericalGrad", milestone: M, summary: "Central-difference gradient: the slow, obviously-correct answer to check backprop against." });
}

/**
 * Relative error between two gradient vectors.
 *
 * Maths:   relError(a, b) = maxᵢ |aᵢ − bᵢ| / max(|aᵢ| + |bᵢ|, 1e-12)
 * Signature: relError(a: number[], b: number[]) => number     (a.length === b.length; 0 for empty)
 *
 * On paper first:
 *  - Why not plain |a − b|? Think of a gradient entry of 1e6 versus one of 1e-6.
 *  - Why the 1e-12 floor? What does your formula give when both entries are exactly 0?
 *  - What range does it take? What does a value of 1 mean?
 */
export function relError(a: number[], b: number[]): number {
  void a; void b;
  throw notYoursYet({ file: FILE, fn: "relError", milestone: M, summary: "Scale-free distance between analytic and numeric gradients." });
}

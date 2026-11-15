import { notYoursYet } from "@/kit/not-yours-yet";

/*
 * Local derivatives: the backward rule of every op the engine knows.
 *
 * Each rule gets the op's inputs (and output, where that saves work) plus the upstream
 * gradient g = ∂L/∂out, and returns ∂L/∂input for each input. That's the chain rule
 * applied once: ∂L/∂a = g · ∂out/∂a. The engine calls these; backprop.ts strings them together.
 *
 * Subtraction, division and negation are not separate ops: a − b = a + (−1)·b and
 * a / b = a · b^(−1). Get add, mul and pow right and they come for free.
 */

const FILE = "src/projects/chainrule/core/ops.ts";
const M = "m1-local-derivatives";

/**
 * out = a + b
 *
 * Signature: addBackward(a: number, b: number, g: number) => [dLda, dLdb]
 *
 * On paper first:
 *  - What are ∂out/∂a and ∂out/∂b? Why do people say "+ routes the gradient"?
 *  - Do you even need a and b?
 */
export function addBackward(a: number, b: number, g: number): [number, number] {
  void a; void b; void g;
  throw notYoursYet({ file: FILE, fn: "addBackward", milestone: M, summary: "Backward rule for a + b: how the upstream gradient reaches both inputs." });
}

/**
 * out = a · b
 *
 * Signature: mulBackward(a: number, b: number, g: number) => [dLda, dLdb]
 *
 * On paper first:
 *  - ∂out/∂a and ∂out/∂b. Why does each input's gradient depend on the *other* input?
 *  - If a = b = x (the graph for x·x), the engine calls this once with parents [x, x].
 *    What should x end up with, and whose job is the adding up: this rule's or backprop's?
 */
export function mulBackward(a: number, b: number, g: number): [number, number] {
  void a; void b; void g;
  throw notYoursYet({ file: FILE, fn: "mulBackward", milestone: M, summary: "Backward rule for a · b: each input's gradient is scaled by the other." });
}

/**
 * out = a^k, with k a constant real number (k is not a node; it gets no gradient).
 *
 * Signature: powBackward(a: number, k: number, g: number) => dLda
 *
 * On paper first:
 *  - The power rule. Check it for k = 2, k = 1, k = 0, k = −1 (that last one is how division works).
 *  - Where is the derivative undefined or infinite? (a = 0 with k < 1, negative a with fractional k.)
 *    The tests stay away from those points.
 */
export function powBackward(a: number, k: number, g: number): number {
  void a; void k; void g;
  throw notYoursYet({ file: FILE, fn: "powBackward", milestone: M, summary: "Backward rule for a^k (k constant): the power rule, times g." });
}

/**
 * out = e^a
 *
 * Signature: expBackward(a: number, out: number, g: number) => dLda     (out = Math.exp(a), already computed)
 *
 * On paper first:
 *  - d/da e^a. Why is the forward output all you need here?
 */
export function expBackward(a: number, out: number, g: number): number {
  void a; void out; void g;
  throw notYoursYet({ file: FILE, fn: "expBackward", milestone: M, summary: "Backward rule for e^a. The output is its own derivative." });
}

/**
 * out = ln a   (a > 0)
 *
 * Signature: logBackward(a: number, g: number) => dLda
 *
 * On paper first:
 *  - d/da ln a. What happens to the gradient as a → 0⁺, and why does that make log-losses blow up
 *    on confident wrong answers?
 */
export function logBackward(a: number, g: number): number {
  void a; void g;
  throw notYoursYet({ file: FILE, fn: "logBackward", milestone: M, summary: "Backward rule for ln a." });
}

/**
 * out = tanh a
 *
 * Signature: tanhBackward(a: number, out: number, g: number) => dLda    (out = Math.tanh(a))
 *
 * On paper first:
 *  - Write tanh a = (e^a − e^−a)/(e^a + e^−a) and differentiate with the quotient rule.
 *  - Then rewrite the answer using only `out`. Where is it largest? What happens for |a| > 3,
 *    and what does that do to a deep net's gradients ("saturation")?
 */
export function tanhBackward(a: number, out: number, g: number): number {
  void a; void out; void g;
  throw notYoursYet({ file: FILE, fn: "tanhBackward", milestone: M, summary: "Backward rule for tanh a, best written in terms of its output." });
}

/**
 * out = relu a = max(0, a)
 *
 * Signature: reluBackward(a: number, g: number) => dLda
 *
 * Convention: at a = 0 exactly, use the subgradient 0 (the same as PyTorch).
 *
 * On paper first:
 *  - Sketch relu and its derivative. Why is relu "not differentiable" at 0, and why does nobody care?
 *  - A unit whose input is always negative gets what gradient? (That's a "dead ReLU".)
 */
export function reluBackward(a: number, g: number): number {
  void a; void g;
  throw notYoursYet({ file: FILE, fn: "reluBackward", milestone: M, summary: "Backward rule for max(0, a): a gate that is open or shut." });
}

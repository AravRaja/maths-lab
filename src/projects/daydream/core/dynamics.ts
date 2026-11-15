import { notYoursYet } from "@/kit/not-yours-yet";

const FILE = "src/projects/daydream/core/dynamics.ts";
const M = "m4-dynamics";

/**
 * Latent dynamics loss: the negative log-likelihood of the real next latent under the
 * dynamics model's predicted diagonal Gaussian.
 *
 * Maths:   the model predicts p(z_{t+1} | z_t, z_{t−1}, a_t) = N(m, diag e^{s}).
 *          loss = −log N(z_{t+1}; m, diag e^{s})   (include the constant, so it's a true NLL)
 * Signature: gaussianNLL(z: ArrayLike<number>, mean: ArrayLike<number>, logvar: ArrayLike<number>) => number
 *   - all length d; z is the target (the encoder's μ for the next frame).
 *
 * On paper first:
 *  - Write the 1-D Gaussian log-density and negate it. What constant is left at z = m, s = 0?
 *  - Fix the error e = z − m. Minimise the loss over s by hand. What does the model learn its
 *    variance should be? Why is that the "honest" answer?
 *  - With s fixed at 0, how does this loss relate to squared error?
 */
export function gaussianNLL(z: ArrayLike<number>, mean: ArrayLike<number>, logvar: ArrayLike<number>): number {
  void z; void mean; void logvar;
  throw notYoursYet({ file: FILE, fn: "gaussianNLL", milestone: M, summary: "How surprised the dynamics model is by the real next latent: −log N(z; m, e^s)." });
}

/**
 * Gradient of gaussianNLL with respect to the predicted mean and log-variance.
 *
 * Signature: gaussianNLLGrad(z, mean, logvar) => { dmean: number[]; dlogvar: number[] }
 *
 * On paper first:
 *  - Differentiate your expression for one dimension. Check dlogvar = 0 at the s you found above.
 *  - The mean gradient is squared-error's gradient scaled by something. By what, and what
 *    does that do to steps the model is unsure about?
 */
export function gaussianNLLGrad(
  z: ArrayLike<number>,
  mean: ArrayLike<number>,
  logvar: ArrayLike<number>,
): { dmean: number[]; dlogvar: number[] } {
  void z; void mean; void logvar;
  throw notYoursYet({ file: FILE, fn: "gaussianNLLGrad", milestone: M, summary: "Teaches the dynamics model where the next latent goes and how sure to be." });
}

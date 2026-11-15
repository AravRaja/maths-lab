import { notYoursYet } from "@/kit/not-yours-yet";
import type { McEstimate } from "./types";

const FILE = "src/projects/posterior/core/montecarlo.ts";

/**
 * Monte Carlo estimate of an expectation, with its standard error.
 *
 * Maths:   given values f_i = f(x_i) with x_i ~ p independent,
 *          estimate  μ̂ = (1/n) Σ f_i   of   μ = E_p[f(X)]
 *          and report the standard error: an estimate of the standard deviation of μ̂ itself.
 *          Use the unbiased sample variance (divide by n − 1).
 *
 * Signature: mcEstimate(values: ArrayLike<number>) => { mean, stdErr, n }
 *   `values` may be a plain array or a Float64Array (the worker passes typed-array views).
 *   n = values.length. For n < 2 the standard error is unknown: return stdErr = Infinity.
 *   For n = 0 also return mean = NaN.
 *
 * On paper first:
 *  - Show E[μ̂] = μ. Derive Var[μ̂] from Var[f(X)] (where does independence get used?).
 *  - So how many times more samples do you need to halve the error bar?
 *  - Why n − 1 and not n in the sample variance?
 *  - Numerics: Σf² − (Σf)²/n can lose all precision when the mean is huge compared with the spread.
 *    Can you compute the variance in a way that doesn't? (Look up Welford, or subtract the mean first.)
 */
export function mcEstimate(values: ArrayLike<number>): McEstimate {
  void values;
  throw notYoursYet({ file: FILE, fn: "mcEstimate", milestone: "m4-monte-carlo", summary: "Sample mean plus standard error: turns darts into π with an honest error bar." });
}

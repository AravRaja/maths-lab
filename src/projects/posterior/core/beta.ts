import { notYoursYet } from "@/kit/not-yours-yet";
import type { BetaParams } from "./types";

const FILE = "src/projects/posterior/core/beta.ts";

/**
 * Beta-Binomial Bayes update: the belief about a coin after seeing some flips.
 *
 * Maths:
 *   prior       p(θ) = Beta(θ; a, b) ∝ θ^(a−1) (1−θ)^(b−1)
 *   likelihood  p(D | θ) = θ^h (1−θ)^t        (one particular sequence with h heads, t tails)
 *   posterior   p(θ | D) ∝ p(D | θ) p(θ)
 *
 * Signature: betaUpdate(prior: BetaParams, heads: number, tails: number) => BetaParams
 *   Returns a NEW object; do not mutate `prior`. heads, tails ≥ 0 (they can be 0).
 *
 * On paper first:
 *  - Multiply the two kernels. Why is the result still a Beta, and what are its parameters?
 *    (This is what "conjugate prior" means.)
 *  - Show that updating flip by flip gives the same answer as updating on all the counts at once.
 *    Does the ORDER of the flips matter? Why not?
 *  - What do a and b "mean" as pseudo-counts? What prior is Beta(1, 1)?
 */
export function betaUpdate(prior: BetaParams, heads: number, tails: number): BetaParams {
  void prior; void heads; void tails;
  throw notYoursYet({ file: FILE, fn: "betaUpdate", milestone: "m1-coin", summary: "Turns a prior and a run of coin flips into the posterior over the coin's bias." });
}

/**
 * Mean and variance of θ ~ Beta(a, b).
 *
 * Maths:   E[θ] = ∫ θ Beta(θ; a, b) dθ,   Var[θ] = E[θ²] − E[θ]²
 *          with B(a, b) = ∫₀¹ θ^(a−1)(1−θ)^(b−1) dθ = Γ(a)Γ(b)/Γ(a+b)
 *
 * Signature: betaMoments(p: BetaParams) => { mean: number; variance: number }
 *
 * On paper first:
 *  - Write E[θ] as a ratio of two Beta functions, then use Γ(x+1) = xΓ(x) to simplify it.
 *  - Do the same for E[θ²]. Then the variance.
 *  - After n flips with a fixed prior, how does the posterior standard deviation shrink with n?
 */
export function betaMoments(p: BetaParams): { mean: number; variance: number } {
  void p;
  throw notYoursYet({ file: FILE, fn: "betaMoments", milestone: "m1-coin", summary: "The posterior's mean (your best guess) and variance (how unsure you still are)." });
}

/**
 * Log evidence (marginal likelihood) of a flip sequence under a Beta prior.
 *
 * Maths:   p(D) = ∫₀¹ p(D | θ) p(θ) dθ        (θ integrated out)
 *          D is one particular sequence with h heads and t tails (no binomial coefficient).
 *
 * Signature: logEvidence(prior: BetaParams, heads: number, tails: number) => number   (natural log)
 *   You may import `lbeta` (log of the Beta function) from "../lib/special". Work in logs:
 *   with 500 flips the evidence underflows a float.
 *
 * On paper first:
 *  - Do the integral. It is a ratio of two Beta functions; which two?
 *  - Check your formula on a = b = 1, h = 1, t = 0. What should p(D) be?
 *  - The page compares this to a fair coin, p(D | θ = ½). Write down log p(D | fair).
 *    The difference is the log Bayes factor. Why can a Bayes factor favour "fair" even when
 *    the posterior mean is not exactly ½? (Think about what the prior spreads its mass over.)
 */
export function logEvidence(prior: BetaParams, heads: number, tails: number): number {
  void prior; void heads; void tails;
  throw notYoursYet({ file: FILE, fn: "logEvidence", milestone: "m2-evidence", summary: "How probable the flips were under this prior, with θ integrated out. Powers the rigged-or-fair verdict." });
}

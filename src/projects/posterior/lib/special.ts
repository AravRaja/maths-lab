/**
 * Special functions and densities. Plumbing the page uses to draw curves; none of these are the
 * milestones. You may import `lgamma` / `lbeta` into your cores (logEvidence needs one of them).
 */

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

/** log Γ(x) for x > 0 (Lanczos, g = 7). About 15 significant digits. */
export function lgamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  const z = x - 1;
  let a = LANCZOS[0];
  const t = z + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

/** log B(a, b) = log Γ(a) + log Γ(b) − log Γ(a + b). */
export function lbeta(a: number, b: number): number {
  return lgamma(a) + lgamma(b) - lgamma(a + b);
}

/** Beta(a, b) density at θ ∈ (0, 1). Clamped away from the edges so a < 1 doesn't return Infinity. */
export function betaPdf(theta: number, a: number, b: number): number {
  const t = Math.min(1 - 1e-9, Math.max(1e-9, theta));
  return Math.exp((a - 1) * Math.log(t) + (b - 1) * Math.log(1 - t) - lbeta(a, b));
}

/** log N(x; mean, variance). */
export function normalLogPdf(x: number, mean: number, variance: number): number {
  const d = x - mean;
  return -0.5 * (Math.log(2 * Math.PI * variance) + (d * d) / variance);
}

export function normalPdf(x: number, mean: number, variance: number): number {
  return Math.exp(normalLogPdf(x, mean, variance));
}

/** Density of a 2D Gaussian with mean m and covariance [[sxx, sxy], [sxy, syy]]. For drawing the field. */
export function gauss2Pdf(x: number, y: number, mx: number, my: number, sxx: number, sxy: number, syy: number): number {
  const det = sxx * syy - sxy * sxy;
  if (!(det > 0)) return 0;
  const dx = x - mx;
  const dy = y - my;
  const q = (syy * dx * dx - 2 * sxy * dx * dy + sxx * dy * dy) / det;
  return Math.exp(-0.5 * q) / (2 * Math.PI * Math.sqrt(det));
}

/** Complementary error function (Numerical Recipes erfcc, relative error < 1.2e-7). */
export function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}

/** P(X > x) for X ~ N(0, 1). */
export function normalTail(x: number): number {
  return 0.5 * erfc(x / Math.SQRT2);
}

/** A 1D Gaussian mixture: weights sum to 1. */
export interface Mixture {
  weights: number[];
  means: number[];
  variances: number[];
}

/** log of a mixture density, computed stably. */
export function mixtureLogPdf(x: number, m: Mixture): number {
  let hi = -Infinity;
  const parts = m.weights.map((w, i) => {
    const v = Math.log(w) + normalLogPdf(x, m.means[i], m.variances[i]);
    if (v > hi) hi = v;
    return v;
  });
  let s = 0;
  for (const v of parts) s += Math.exp(v - hi);
  return hi + Math.log(s);
}

/** Draw from a mixture given a uniform u (component pick) and a standard normal z. */
export function mixtureSample(m: Mixture, u: number, z: number): number {
  let acc = 0;
  for (let i = 0; i < m.weights.length; i++) {
    acc += m.weights[i];
    if (u < acc || i === m.weights.length - 1) return m.means[i] + Math.sqrt(m.variances[i]) * z;
  }
  return m.means[0];
}

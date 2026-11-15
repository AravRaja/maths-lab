/** Shapes shared by the cores and the page. */

/** Beta(a, b) belief about a coin's heads probability θ. a, b > 0. */
export interface BetaParams {
  a: number;
  b: number;
}

/** A 1D Gaussian, by mean and variance (not standard deviation). */
export interface Normal {
  mean: number;
  variance: number;
}

/** 2x2 matrix as rows: [[m00, m01], [m10, m11]]. */
export type Mat2 = [[number, number], [number, number]];

/** A 2D Gaussian over (x, y). `cov` is symmetric positive definite: [[σx², c], [c, σy²]]. */
export interface Gauss2 {
  mean: [number, number];
  cov: Mat2;
}

/** A Monte Carlo estimate of E[f]: the sample mean and its standard error. */
export interface McEstimate {
  mean: number;
  stdErr: number;
  n: number;
}

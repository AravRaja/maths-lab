import { notYoursYet } from "@/kit/not-yours-yet";
import type { Mat, Vec } from "./types";

const FILE = "src/projects/jacobian/core/kalman.ts";

/*
 * The linear Kalman filter.
 *
 * Model:   x_k = F x_{k−1} + w,   w ~ N(0, Q)        (process: how the target moves)
 *          z_k = H x_k + v,       v ~ N(0, R)        (measurement: what the noisy camera sees)
 *
 * The belief about x is Gaussian, N(x̂, P). Predict pushes it through the motion model; update
 * conditions it on a measurement.
 */

/**
 * Kalman predict (time update).
 *
 * Signature: kalmanPredict(x: number[n], P: number[n][n], F: number[n][n], Q: number[n][n])
 *              => { x: number[n], P: number[n][n] }
 *
 * On paper first:
 *  - If x ~ N(μ, Σ), what are the mean and covariance of F x? Of F x + w with w independent?
 *  - Predict with no measurements for a long time on a constant-velocity model. What does P do?
 */
export function kalmanPredict(x: Vec, P: Mat, F: Mat, Q: Mat): { x: Vec; P: Mat } {
  void x;
  void P;
  void F;
  void Q;
  throw notYoursYet({
    file: FILE,
    fn: "kalmanPredict",
    milestone: "m6-kalman",
    summary: "Moves the belief forward in time with the motion model. The uncertainty grows.",
  });
}

/**
 * Kalman update (measurement update).
 *
 * Signature: kalmanUpdate(x, P, z: number[m], H: number[m][n], R: number[m][m])
 *              => { x: number[n], P: number[n][n], K: number[n][m], y: number[m], S: number[m][m] }
 *   y is the innovation (what the measurement says minus what you expected), S its covariance, K the gain.
 *
 * On paper first:
 *  - Scalar first: prior N(μ, p), measurement z = x + v with v ~ N(0, r). Multiply the two Gaussians.
 *    Write the new mean as μ + k(z − μ). What is k? What is the new variance?
 *  - Generalise: what are the covariance of y and the gain K? Check the limits R → 0 and R → ∞.
 *  - The textbook (I − KH)P can lose symmetry and positive-definiteness to rounding. Derive the
 *    "Joseph form" of the covariance update and say why it is safer.
 *
 * You may use `solveMat`, `transpose` and friends from lib/linalg. Avoid an explicit inverse of S if you can.
 */
export function kalmanUpdate(
  x: Vec,
  P: Mat,
  z: Vec,
  H: Mat,
  R: Mat,
): { x: Vec; P: Mat; K: Mat; y: Vec; S: Mat } {
  void x;
  void P;
  void z;
  void H;
  void R;
  throw notYoursYet({
    file: FILE,
    fn: "kalmanUpdate",
    milestone: "m6-kalman",
    summary: "Blends the prediction with a noisy measurement, weighted by how much each is trusted.",
  });
}

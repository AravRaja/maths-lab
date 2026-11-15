import { forwardKinematics } from "../core/kinematics";
import { geometricJacobian, manipulability } from "../core/jacobian";
import { dlsStep } from "../core/ik";
import { so3Log } from "../core/se3";
import { ARM, clampToLimits } from "./arm";
import { matMul, norm, posOf, rotOf, sub, transpose, type Mat, type Vec } from "./linalg";

/*
 * The IK outer loop (plumbing round the user's cores): error vector, step clamp, joint limits.
 * One call = one damped-least-squares iteration.
 */

export interface IkTarget {
  p: Vec;
  /** Optional goal orientation of the tool. With it the task is 6-D and so3Log is used. */
  R?: Mat;
}

export interface IkResult {
  q: number[];
  frames: Mat[];
  J: Mat;
  /** Task-space error norm before the step. */
  err: number;
  /** ‖δq‖ actually taken (after clamping). */
  speed: number;
  /** Position manipulability √det(Jv Jvᵀ) at the current pose. */
  w: number;
}

export function ikIterate(
  q: number[],
  target: IkTarget,
  { lambda = 0.05, maxStep = 0.12, oriWeight = 0.4, maxJoint = 0.6 }: { lambda?: number; maxStep?: number; oriWeight?: number; maxJoint?: number } = {},
): IkResult {
  const frames = forwardKinematics(q, ARM);
  const T = frames[ARM.joints.length];
  const J = geometricJacobian(frames, ARM);
  const ep = sub(target.p, posOf(T));
  let e: Vec;
  let Jt: Mat;
  if (target.R) {
    const eo = so3Log(matMul(target.R, transpose(rotOf(T))));
    e = [...ep, ...eo.map((v) => v * oriWeight)];
    Jt = [...J.slice(0, 3), ...J.slice(3).map((r) => r.map((v) => v * oriWeight))];
  } else {
    e = ep;
    Jt = J.slice(0, 3);
  }
  const err = norm(e);
  const s = err > maxStep ? maxStep / err : 1;
  let dq = dlsStep(Jt, e.map((v) => v * s), lambda);
  // A huge step means an undamped solve hit a singularity. Clip it so the arm flails visibly but stays on screen.
  const dn = norm(dq);
  if (!Number.isFinite(dn)) dq = dq.map(() => 0);
  else if (dn > maxJoint) dq = dq.map((v) => (v * maxJoint) / dn);
  const qn = clampToLimits(q.map((v, i) => v + dq[i]));
  return { q: qn, frames, J, err, speed: Number.isFinite(dn) ? dn : maxJoint * 10, w: safeManipulability(J.slice(0, 3)) };
}

/** manipulability, or NaN while it is still a stub (so IK works even if M3 is half done). */
export function safeManipulability(J: Mat): number {
  try {
    return manipulability(J);
  } catch {
    return NaN;
  }
}

/** Tool position of q (convenience). */
export const toolOf = (q: number[]): Vec => posOf(forwardKinematics(q, ARM)[ARM.joints.length]);

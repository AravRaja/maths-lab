import type { CoreSpec } from "@/kit/cores";
import { rodrigues, so3Log, invertSE3 } from "./se3";
import { forwardKinematics } from "./kinematics";
import { geometricJacobian, manipulability } from "./jacobian";
import { dlsStep } from "./ik";
import { riccatiStep, dlqr } from "./lqr";
import { kalmanPredict, kalmanUpdate } from "./kalman";
import type { ArmSpec } from "./types";

const I4 = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
];
const TINY_ARM: ArmSpec = { joints: [{ name: "j", offset: [0, 0, 0.1], axis: [0, 0, 1], limits: [-1, 1] }], tool: [0.1, 0, 0] };
const P = "src/projects/jacobian/core/";

/**
 * Every maths core in the project, in milestone order, for <CoreStatus>. `probe` calls it with a tiny
 * input: NotYoursYet = still a stub, a return value = written, any other throw = broken.
 */
export const CORES: CoreSpec[] = [
  { file: P + "se3.ts", fn: "rodrigues", milestone: "m1-frames", summary: "Axis–angle to rotation matrix.", probe: () => rodrigues([0, 0, 1], 0.3) },
  { file: P + "se3.ts", fn: "invertSE3", milestone: "m1-frames", summary: "Closed-form inverse of a rigid transform.", probe: () => invertSE3(I4) },
  { file: P + "kinematics.ts", fn: "forwardKinematics", milestone: "m2-forward-kinematics", summary: "Joint angles to the pose of every link.", probe: () => forwardKinematics([0.2], TINY_ARM) },
  { file: P + "jacobian.ts", fn: "geometricJacobian", milestone: "m3-jacobian", summary: "Joint speeds to tool velocity, 6 × n.", probe: () => geometricJacobian([I4, I4], TINY_ARM) },
  { file: P + "jacobian.ts", fn: "manipulability", milestone: "m3-jacobian", summary: "√det(J Jᵀ): zero at a singularity.", probe: () => manipulability([[1, 0], [0, 1]]) },
  { file: P + "se3.ts", fn: "so3Log", milestone: "m4-ik", summary: "Rotation matrix back to axis × angle.", probe: () => so3Log([[1, 0, 0], [0, 1, 0], [0, 0, 1]]) },
  { file: P + "ik.ts", fn: "dlsStep", milestone: "m4-ik", summary: "One damped-least-squares IK step.", probe: () => dlsStep([[1, 0], [0, 1]], [0.1, 0], 0.1) },
  { file: P + "lqr.ts", fn: "riccatiStep", milestone: "m5-lqr", summary: "One backward Riccati step: gain and cost-to-go.", probe: () => riccatiStep([[1]], [[1]], [[1]], [[1]], [[1]]) },
  { file: P + "lqr.ts", fn: "dlqr", milestone: "m5-lqr", summary: "Riccati to convergence: the balancing gain.", probe: () => dlqr([[1]], [[1]], [[1]], [[1]], { maxIter: 5 }) },
  { file: P + "kalman.ts", fn: "kalmanPredict", milestone: "m6-kalman", summary: "Push the belief through the motion model.", probe: () => kalmanPredict([0], [[1]], [[1]], [[0.1]]) },
  { file: P + "kalman.ts", fn: "kalmanUpdate", milestone: "m6-kalman", summary: "Fuse a noisy measurement into the belief.", probe: () => kalmanUpdate([0], [[1]], [1], [[1]], [[1]]) },
];

import type { CoreSpec } from "@/kit/cores";
import { forwardKinematics, jacobian } from "./kinematics";
import { dlsStep } from "./ik";
import { gaussianNll } from "./policy-head";
import { eulerSample, flowPair } from "./flow";
import { discountedReturn, shapedRewards } from "./reward";

/**
 * Every maths core in the project, for <CoreStatus>. `probe` calls it with a tiny input:
 * NotYoursYet = still a stub, a return value = written, any other throw = broken.
 */
export const CORES: CoreSpec[] = [
  { file: "src/projects/say-and-reach/core/kinematics.ts", fn: "forwardKinematics", milestone: "m1-forward-kinematics", probe: () => forwardKinematics([0.3, 0.2], [1, 1]) },
  { file: "src/projects/say-and-reach/core/kinematics.ts", fn: "jacobian", milestone: "m2-jacobian-ik", probe: () => jacobian([0.3, 0.2], [1, 1]) },
  { file: "src/projects/say-and-reach/core/ik.ts", fn: "dlsStep", milestone: "m2-jacobian-ik", probe: () => dlsStep([[1, 0], [0, 1]], [0.1, 0], 0.1) },
  { file: "src/projects/say-and-reach/core/policy-head.ts", fn: "gaussianNll", milestone: "m3-behaviour-cloning", probe: () => gaussianNll([0], [0], [0.5]) },
  { file: "src/projects/say-and-reach/core/flow.ts", fn: "flowPair", milestone: "m4-flow-matching", probe: () => flowPair([0], [1], 0.5) },
  { file: "src/projects/say-and-reach/core/flow.ts", fn: "eulerSample", milestone: "m4-flow-matching", probe: () => eulerSample((x) => x, [1], 2) },
  { file: "src/projects/say-and-reach/core/reward.ts", fn: "discountedReturn", milestone: "m5-reward-shaping", probe: () => discountedReturn([1], 0.9) },
  { file: "src/projects/say-and-reach/core/reward.ts", fn: "shapedRewards", milestone: "m5-reward-shaping", probe: () => shapedRewards([0], [0, 1], 0.9) },
];

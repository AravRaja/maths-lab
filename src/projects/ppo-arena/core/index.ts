import type { CoreSpec } from "@/kit/cores";
import { discountedReturns } from "./returns";
import { gae } from "./gae";
import { entropy, logProb } from "./policy";
import { clippedSurrogate } from "./surrogate";
import { valueLoss } from "./value-loss";

export { discountedReturns, gae, logProb, entropy, clippedSurrogate, valueLoss };

/**
 * Every maths core in the project, for <CoreStatus>. `probe` calls it with a tiny input:
 * NotYoursYet = still a stub, a return value = written, any other throw = broken.
 */
export const CORES: CoreSpec[] = [
  { file: "src/projects/ppo-arena/core/returns.ts", fn: "discountedReturns", milestone: "m1-returns", summary: "Return-to-go with episode resets.", probe: () => discountedReturns([1, 1], [false, true], 0.9) },
  { file: "src/projects/ppo-arena/core/gae.ts", fn: "gae", milestone: "m2-gae", summary: "Generalised advantage estimates.", probe: () => gae([1, 1], [0.5, 0.5], [false, true], 0.9, 0.95) },
  { file: "src/projects/ppo-arena/core/policy.ts", fn: "logProb", milestone: "m3-policy", summary: "log π(a|s) from logits.", probe: () => logProb([0.1, -0.2], 1) },
  { file: "src/projects/ppo-arena/core/policy.ts", fn: "entropy", milestone: "m3-policy", summary: "Policy entropy in nats.", probe: () => entropy([0.1, -0.2]) },
  { file: "src/projects/ppo-arena/core/surrogate.ts", fn: "clippedSurrogate", milestone: "m4-clip", summary: "The clipped PPO objective.", probe: () => clippedSurrogate(1.1, 1, 0.2) },
  { file: "src/projects/ppo-arena/core/value-loss.ts", fn: "valueLoss", milestone: "m5-train", summary: "Clipped critic loss.", probe: () => valueLoss(0.5, 1, 0.4, 0.2) },
];

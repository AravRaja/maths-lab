import type { CoreSpec } from "@/kit/cores";
import { conditionalPath, conditionalVelocity } from "./path";
import { marginalVelocity } from "./marginal";
import { eulerStep, sampleODE } from "./euler";
import { cfmLoss, cfmLossGrad } from "./loss";
import { dropLabel, guidedVelocity } from "./guidance";
import { temporalEnsemble } from "./chunks";

export * from "./types";
export { conditionalPath, conditionalVelocity, marginalVelocity, eulerStep, sampleODE, cfmLoss, cfmLossGrad, guidedVelocity, dropLabel, temporalEnsemble };

const F = {
  path: "src/projects/flowfield/core/path.ts",
  marginal: "src/projects/flowfield/core/marginal.ts",
  euler: "src/projects/flowfield/core/euler.ts",
  loss: "src/projects/flowfield/core/loss.ts",
  guidance: "src/projects/flowfield/core/guidance.ts",
  chunks: "src/projects/flowfield/core/chunks.ts",
};

/**
 * Every maths core in flowfield, for <CoreStatus>. Each probe calls it with a tiny input:
 * NotYoursYet = stub, a return value = written, any other throw = broken.
 */
export const CORES: CoreSpec[] = [
  { file: F.path, fn: "conditionalPath", milestone: "m1-straight-lines", probe: () => conditionalPath([0, 0], [1, 1], 0.5, 0.02) },
  { file: F.path, fn: "conditionalVelocity", milestone: "m1-straight-lines", probe: () => conditionalVelocity([0, 0], [1, 1], 0.02) },
  { file: F.marginal, fn: "marginalVelocity", milestone: "m2-marginal-field", probe: () => marginalVelocity([0, 0], 0.5, [[1, 1]], 0.02) },
  { file: F.euler, fn: "eulerStep", milestone: "m3-integrate", probe: () => eulerStep((x) => x, [1], 0, 0.1) },
  { file: F.euler, fn: "sampleODE", milestone: "m3-integrate", probe: () => sampleODE((x) => x, [1], 2) },
  { file: F.loss, fn: "cfmLoss", milestone: "m4-train", probe: () => cfmLoss([[1]], [[0]]) },
  { file: F.loss, fn: "cfmLossGrad", milestone: "m4-train", probe: () => cfmLossGrad([[1]], [[0]]) },
  { file: F.guidance, fn: "guidedVelocity", milestone: "m5-condition", probe: () => guidedVelocity([1], [0], 2) },
  { file: F.guidance, fn: "dropLabel", milestone: "m5-condition", probe: () => dropLabel(1, 0.1, 0.5) },
  { file: F.chunks, fn: "temporalEnsemble", milestone: "m6-action-chunks", probe: () => temporalEnsemble([{ start: 0, actions: [[1]] }], 0, 0.1) },
];

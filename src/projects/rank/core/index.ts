import type { CoreSpec } from "@/kit/cores";
import type { Matrix, SVD } from "./types";
import { gramSchmidt, projectOnto } from "./projection";
import { rankK, storageCost } from "./lowrank";
import { energyCaptured, frobeniusError, tailEnergy } from "./error";
import { deflate, powerIteration } from "./power";
import { decode, encode, meanCenter, pca } from "./pca";

export * from "./types";

const F = {
  proj: "src/projects/rank/core/projection.ts",
  low: "src/projects/rank/core/lowrank.ts",
  err: "src/projects/rank/core/error.ts",
  pow: "src/projects/rank/core/power.ts",
  pca: "src/projects/rank/core/pca.ts",
};

const m1: Matrix = { rows: 1, cols: 1, data: new Float64Array([2]) };
const s1: SVD = { U: { rows: 1, cols: 1, data: new Float64Array([1]) }, S: new Float64Array([2]), V: { rows: 1, cols: 1, data: new Float64Array([1]) } };
const X2: Matrix = { rows: 2, cols: 1, data: new Float64Array([1, 3]) };
const p1 = { mean: new Float64Array([2]), components: [new Float64Array([1])], variances: [2] };

/**
 * Every maths core, for <CoreStatus>. Each probe calls the core on a tiny input:
 * NotYoursYet = still a stub, a return value = written, any other throw = broken.
 */
export const CORES: CoreSpec[] = [
  { file: F.proj, fn: "gramSchmidt", milestone: "m1-projection", probe: () => gramSchmidt([new Float64Array([1, 0])]) },
  { file: F.proj, fn: "projectOnto", milestone: "m1-projection", probe: () => projectOnto([new Float64Array([1, 0])], new Float64Array([1, 1])) },
  { file: F.low, fn: "rankK", milestone: "m2-rank-k", probe: () => rankK(s1, 1) },
  { file: F.low, fn: "storageCost", milestone: "m2-rank-k", probe: () => storageCost(4, 3, 1) },
  { file: F.err, fn: "frobeniusError", milestone: "m3-eckart-young", probe: () => frobeniusError(m1, m1) },
  { file: F.err, fn: "tailEnergy", milestone: "m3-eckart-young", probe: () => tailEnergy([2, 1], 1) },
  { file: F.err, fn: "energyCaptured", milestone: "m3-eckart-young", probe: () => energyCaptured([2, 1], 1) },
  { file: F.pow, fn: "powerIteration", milestone: "m4-power", probe: () => powerIteration(m1, { iters: 2 }) },
  { file: F.pow, fn: "deflate", milestone: "m4-power", probe: () => deflate(m1, 2, new Float64Array([1]), new Float64Array([1])) },
  { file: F.pca, fn: "meanCenter", milestone: "m5-eigenfaces", probe: () => meanCenter(X2) },
  { file: F.pca, fn: "pca", milestone: "m5-eigenfaces", probe: () => pca(X2, 1) },
  { file: F.pca, fn: "encode", milestone: "m5-eigenfaces", probe: () => encode([1], p1) },
  { file: F.pca, fn: "decode", milestone: "m5-eigenfaces", probe: () => decode([1], p1) },
];

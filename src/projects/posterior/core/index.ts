import type { CoreSpec } from "@/kit/cores";
import { betaMoments, betaUpdate, logEvidence } from "./beta";
import { cholesky2, condition, marginal } from "./gaussian2d";
import { mcEstimate } from "./montecarlo";
import { effectiveSampleSize, importanceWeights } from "./importance";
import { klNormal } from "./kl";
import type { Gauss2 } from "./types";

export * from "./types";

const F = {
  beta: "src/projects/posterior/core/beta.ts",
  g2: "src/projects/posterior/core/gaussian2d.ts",
  mc: "src/projects/posterior/core/montecarlo.ts",
  is: "src/projects/posterior/core/importance.ts",
  kl: "src/projects/posterior/core/kl.ts",
};

const G: Gauss2 = { mean: [0, 0], cov: [[1, 0.5], [0.5, 2]] };

/**
 * Every maths core in the project, for <CoreStatus>. `probe` calls it with a tiny input:
 * NotYoursYet = still a stub, a return value = written, any other throw = broken.
 */
export const CORES: CoreSpec[] = [
  { file: F.beta, fn: "betaUpdate", milestone: "m1-coin", probe: () => betaUpdate({ a: 1, b: 1 }, 1, 0) },
  { file: F.beta, fn: "betaMoments", milestone: "m1-coin", probe: () => betaMoments({ a: 2, b: 2 }) },
  { file: F.beta, fn: "logEvidence", milestone: "m2-evidence", probe: () => logEvidence({ a: 1, b: 1 }, 1, 1) },
  { file: F.g2, fn: "cholesky2", milestone: "m3-gaussian", probe: () => cholesky2(G.cov) },
  { file: F.g2, fn: "marginal", milestone: "m3-gaussian", probe: () => marginal(G, 0) },
  { file: F.g2, fn: "condition", milestone: "m3-gaussian", probe: () => condition(G, 0, 1) },
  { file: F.mc, fn: "mcEstimate", milestone: "m4-monte-carlo", probe: () => mcEstimate([1, 2, 3]) },
  { file: F.is, fn: "importanceWeights", milestone: "m5-importance", probe: () => importanceWeights([0, 0], [0, 0]) },
  { file: F.is, fn: "effectiveSampleSize", milestone: "m5-importance", probe: () => effectiveSampleSize([1, 1]) },
  { file: F.kl, fn: "klNormal", milestone: "m6-kl", probe: () => klNormal({ mean: 0, variance: 1 }, { mean: 0, variance: 1 }) },
];

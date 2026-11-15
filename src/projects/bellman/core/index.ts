import type { CoreSpec } from "@/kit/cores";
import type { MDP } from "./types";
import { greedyPolicy, lookahead } from "./lookahead";
import { bellmanExpectationBackup, bellmanOptimalityBackup } from "./backups";
import { valueIteration } from "./value-iteration";
import { policyIteration } from "./policy-iteration";
import { epsilonGreedy } from "./explore";
import { qLearningUpdate, td0Update } from "./td";

/** A one-state, one-action MDP that loops on itself with reward 1. Tiny enough for any probe. */
function probeMdp(): MDP {
  return { nS: 1, nA: 1, outcomes: [[{ p: 1, next: 0, reward: 1 }]], terminal: new Uint8Array(1) };
}

const F = {
  la: "src/projects/bellman/core/lookahead.ts",
  bu: "src/projects/bellman/core/backups.ts",
  vi: "src/projects/bellman/core/value-iteration.ts",
  pi: "src/projects/bellman/core/policy-iteration.ts",
  ex: "src/projects/bellman/core/explore.ts",
  td: "src/projects/bellman/core/td.ts",
};

/**
 * Every maths core in the project, in milestone order, for <CoreStatus>.
 * `probe` calls it with a tiny input: NotYoursYet = still a stub, a return value = written.
 */
export const CORES: CoreSpec[] = [
  { file: F.la, fn: "lookahead", milestone: "m1-lookahead", probe: () => lookahead(probeMdp(), [0], 0.5) },
  { file: F.la, fn: "greedyPolicy", milestone: "m1-lookahead", probe: () => greedyPolicy([0, 1], 2) },
  { file: F.bu, fn: "bellmanExpectationBackup", milestone: "m2-evaluation", probe: () => bellmanExpectationBackup(probeMdp(), [0], new Float64Array([1]), 0.5) },
  { file: F.bu, fn: "bellmanOptimalityBackup", milestone: "m3-value-iteration", probe: () => bellmanOptimalityBackup(probeMdp(), [0], 0.5) },
  { file: F.vi, fn: "valueIteration", milestone: "m3-value-iteration", probe: () => valueIteration(probeMdp(), 0.5, { maxSweeps: 3 }) },
  { file: F.pi, fn: "policyIteration", milestone: "m4-policy-iteration", probe: () => policyIteration(probeMdp(), 0.5, { maxRounds: 2, maxEvalSweeps: 5 }) },
  { file: F.ex, fn: "epsilonGreedy", milestone: "m5-td", probe: () => epsilonGreedy([0, 1], 0.1, () => 0.5) },
  { file: F.td, fn: "td0Update", milestone: "m5-td", probe: () => td0Update(new Float64Array(1), 0, 1, 0, true, 0.5, 0.9) },
  { file: F.td, fn: "qLearningUpdate", milestone: "m6-q-learning", probe: () => qLearningUpdate(new Float64Array(1), 1, 0, 0, 1, 0, true, 0.5, 0.9) },
];

export * from "./types";
export { lookahead, greedyPolicy, bellmanExpectationBackup, bellmanOptimalityBackup, valueIteration, policyIteration, epsilonGreedy, td0Update, qLearningUpdate };
export type { ValueIterationResult } from "./value-iteration";
export type { PolicyIterationResult, PolicyIterationRound } from "./policy-iteration";

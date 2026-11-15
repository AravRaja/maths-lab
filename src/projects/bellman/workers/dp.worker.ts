/// <reference lib="webworker" />
import { exposeWorker } from "@/kit/worker";
import { valueIteration } from "../core/value-iteration";
import { policyIteration } from "../core/policy-iteration";
import { buildMdp, type World, type WorldParams } from "../lib/grid";

/*
 * Dynamic programming off the main thread. Both handlers just call the user's cores on an MDP
 * built from the painted grid; a NotYoursYet from a stub is rebuilt on the page.
 */

export interface DpArgs {
  world: World;
  params: WorldParams;
  gamma: number;
}

export const handlers = {
  vi(a: DpArgs) {
    const mdp = buildMdp(a.world, a.params);
    const r = valueIteration(mdp, a.gamma, { tol: 1e-6, maxSweeps: 600 });
    return { V: r.V, sweeps: r.sweeps, deltas: r.deltas };
  },
  pi(a: DpArgs) {
    const mdp = buildMdp(a.world, a.params);
    const r = policyIteration(mdp, a.gamma, { evalTol: 1e-6, maxEvalSweeps: 2000, maxRounds: 60 });
    return { policy: r.policy, V: r.V, rounds: r.rounds };
  },
};

exposeWorker(handlers);

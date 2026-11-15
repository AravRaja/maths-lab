import { exposeWorker } from "@/kit/worker";
import { evaluate } from "@/projects/say-and-reach/lib/arm/evaluate";
import { generateDemos, trainFlow, trainGaussian, type Demos } from "@/projects/say-and-reach/lib/arm/train";
import type { PolicyNet } from "@/projects/say-and-reach/lib/nn/policy-net";
import { EPISODE_STEPS } from "@/projects/say-and-reach/lib/arm/config";
import { OBS_DIM } from "@/projects/say-and-reach/lib/arm/world";

/*
 * The training worker. Demos stay here between calls (no point copying 50k rows back and
 * forth); the page gets summaries, live progress, weight snapshots and final weights.
 * Any NotYoursYet thrown by a core comes back to the page intact.
 */

let demos: Demos | null = null;

export const handlers = {
  /** Record expert demonstrations. Returns fingertip traces of a few episodes for the page to draw. */
  demos(args: { episodes: number; seed: number; twoWay: boolean }, progress: (v: unknown) => void) {
    demos = generateDemos(args.episodes, args.seed, { twoWay: args.twoWay, onProgress: (f) => progress(f) });
    const traces: [number, number][][] = [];
    const show = Math.min(48, args.episodes);
    for (let e = 0; e < show; e++) {
      const tr: [number, number][] = [];
      for (let t = 0; t < EPISODE_STEPS; t += 2) {
        const i = (e * EPISODE_STEPS + t) * OBS_DIM;
        // observe() stores the fingertip y shifted by −0.7.
        tr.push([demos.obs[i], demos.obs[i + 1] + 0.7]);
      }
      traces.push(tr);
    }
    return { n: demos.n, episodes: demos.episodes, traces };
  },

  train(args: { head: "gaussian" | "flow"; steps: number; lr?: number; seed?: number }, progress: (v: unknown) => void): PolicyNet {
    if (!demos) throw new Error("Record demos first.");
    const opts = { steps: args.steps, lr: args.lr, seed: args.seed, snapshotEvery: 250, onProgress: progress };
    return args.head === "gaussian" ? trainGaussian(demos, opts) : trainFlow(demos, opts);
  },

  evaluate(args: { gaussian?: PolicyNet; flow?: PolicyNet; episodes: number; seed: number }, progress: (v: unknown) => void) {
    return evaluate({ gaussian: args.gaussian, flow: args.flow }, args.episodes, args.seed, (f) => progress(f));
  },
};

exposeWorker(handlers);

/// <reference lib="webworker" />
import { exposeWorker } from "@/kit/worker";
import { isNotYoursYet } from "@/kit/not-yours-yet";
import { sgdStep } from "@/projects/chainrule/core/sgd";
import { relError } from "@/projects/chainrule/core/gradcheck";
import { makeDataset, type DatasetName } from "@/projects/chainrule/lib/engine/data";
import { accuracy, initParams, lossGradMatmul, lossGradScalar, scoreGrid } from "@/projects/chainrule/lib/engine/mlp";

/*
 * Training loop, off the main thread. The loop is scaffolding; the gradient (scalar graph or
 * matmul-lite) and the update (sgdStep) are the user's cores. Frames stream back as progress.
 */

export type Engine = "scalar" | "matmul";

export interface TrainArgs {
  dataset: DatasetName;
  seed: number;
  sizes: number[];
  lr: number;
  momentum: number;
  alpha: number;
  engine: Engine;
  steps: number;
  grid: number;
  params?: number[];
  velocity?: number[];
  startStep?: number;
}

export interface Frame {
  step: number;
  loss: number;
  acc: number;
  params: number[];
  velocity: number[];
  grads: number[];
  grid: Float32Array;
  stepsPerSec: number;
  nodes?: number;
}

const sleep = () => new Promise((r) => setTimeout(r, 0));

export const handlers = {
  async train(a: TrainArgs, progress: (v: unknown) => void) {
    const data = makeDataset(a.dataset, 120, a.seed);
    let params = a.params ?? initParams(a.sizes, a.seed);
    let velocity = a.velocity ?? new Array<number>(params.length).fill(0);
    let last = performance.now();
    let since = 0;
    let frame: Frame | null = null;
    for (let s = 1; s <= a.steps; s++) {
      const lg = a.engine === "matmul" ? lossGradMatmul(params, a.sizes, data, a.alpha) : lossGradScalar(params, a.sizes, data, a.alpha);
      const next = sgdStep(params, lg.grads, velocity, { lr: a.lr, momentum: a.momentum });
      params = next.params;
      velocity = next.velocity;
      since++;
      const now = performance.now();
      if (now - last > 70 || s === a.steps || s === 1) {
        frame = {
          step: (a.startStep ?? 0) + s,
          loss: lg.loss,
          acc: accuracy(params, a.sizes, data),
          params,
          velocity,
          grads: lg.grads,
          grid: scoreGrid(params, a.sizes, a.grid),
          stepsPerSec: (since * 1000) / Math.max(1, now - last),
          nodes: lg.nodes,
        };
        progress(frame);
        last = now;
        since = 0;
        await sleep();
      }
    }
    return frame;
  },

  /** One-batch timing of both engines and how closely their gradients agree. */
  bench(a: { dataset: DatasetName; seed: number; sizes: number[]; alpha: number; params?: number[] }) {
    const data = makeDataset(a.dataset, 120, a.seed);
    const params = a.params ?? initParams(a.sizes, a.seed);
    const time = (f: () => { grads: number[] }) => {
      const t0 = performance.now();
      let out = f();
      let n = 1;
      while (performance.now() - t0 < 350) { out = f(); n++; }
      return { ms: (performance.now() - t0) / n, grads: out.grads };
    };
    const s = time(() => lossGradScalar(params, a.sizes, data, a.alpha));
    const m = time(() => lossGradMatmul(params, a.sizes, data, a.alpha));
    let err: number | null = null;
    try {
      err = relError(s.grads, m.grads);
    } catch (e) {
      if (!isNotYoursYet(e)) throw e;
    }
    return { scalarMs: s.ms, matmulMs: m.ms, relErr: err };
  },
};

exposeWorker(handlers);

/**
 * Reacher policies: a flow-matching chunk policy and an L2-regression baseline, plus the rollout
 * loop. Plumbing around the user's cores (sampleODE, cfmLoss/cfmLossGrad via cfmStep, temporalEnsemble).
 */

import { sampleODE } from "../core/euler";
import { cfmLoss, cfmLossGrad } from "../core/loss";
import { temporalEnsemble } from "../core/chunks";
import type { ChunkPrediction } from "../core/types";
import { SIGMA_MIN } from "./config";
import { cfmStep, makeAdam, makeFlowNet, predict, type FlowNet } from "./model";
import { Adam, backward, forward, initMLP, type MLP } from "./mlp";
import { gaussVec, mulberry32, randInt, type Rng } from "./rng";
import {
  ADIM, CHUNK, CTX, EPISODE, H, chunkActions, clampStep, context, demoDataset, fk, hitsPost, ik, randomScene, ribbon,
  type Demo, type P2, type Q,
} from "./reacher";

export interface ReachModel {
  flow: FlowNet;
  flowOpt: Adam;
  reg: MLP;
  regOpt: Adam;
  ctx: number[][];
  chunks: number[][];
  rng: Rng;
  step: number;
}

export function makeReachModel(demos: number, seed: number): { model: ReachModel; demos: Demo[] } {
  const ds = demoDataset(demos, seed);
  const flow = makeFlowNet(CHUNK, CTX, [96, 96, 96], seed + 3);
  const reg = initMLP([CTX, 96, 96, CHUNK], mulberry32(seed + 4));
  return {
    model: { flow, flowOpt: makeAdam(flow, 2e-3), reg, regOpt: new Adam(reg.params.length, 2e-3), ctx: ds.ctx, chunks: ds.chunks, rng: mulberry32(seed + 5), step: 0 },
    demos: ds.demos,
  };
}

export function trainReach(r: ReachModel, steps: number, batch: number) {
  const flowLoss: number[] = [];
  const regLoss: number[] = [];
  for (let k = 0; k < steps; k++) {
    const idx = Array.from({ length: batch }, () => randInt(r.rng, r.ctx.length));
    const x1 = idx.map((i) => r.chunks[i]);
    const ctx = idx.map((i) => r.ctx[i]);
    flowLoss.push(cfmStep(r.flow, r.flowOpt, { x1, ctx }, r.rng, SIGMA_MIN));
    // Baseline: plain regression ctx → chunk with the same squared-error loss (your cfmLoss).
    const X = new Float32Array(batch * CTX);
    ctx.forEach((c, b) => c.forEach((v, i) => (X[b * CTX + i] = v)));
    const { out, cache } = forward(r.reg, X, batch);
    const pred = Array.from({ length: batch }, (_, b) => Array.from(out.subarray(b * CHUNK, (b + 1) * CHUNK)));
    regLoss.push(cfmLoss(pred, x1));
    const g = cfmLossGrad(pred, x1);
    r.regOpt.step(r.reg.params, backward(r.reg, cache, Float32Array.from(g.flat())));
    r.step++;
  }
  return { step: r.step, flowLoss, regLoss };
}

export function regPredict(net: MLP, ctxs: number[][]): number[][] {
  const B = ctxs.length;
  const X = new Float32Array(B * CTX);
  ctxs.forEach((c, b) => c.forEach((v, i) => (X[b * CTX + i] = v)));
  const { out } = forward(net, X, B);
  return Array.from({ length: B }, (_, b) => Array.from(out.subarray(b * CHUNK, (b + 1) * CHUNK)));
}

/** One flow-sampled chunk: the whole flow-time path, noise first, chunk last. */
export function flowChunk(r: ReachModel, ctx: number[], rng: Rng, steps: number): number[][] {
  const v = (x: number[], t: number) => predict(r.flow, [x], [t], [ctx])[0];
  return sampleODE(v, gaussVec(rng, CHUNK), steps);
}

export interface RolloutArgs {
  seed: number;
  policy: "flow" | "regression";
  /** Replan every step and blend overlapping chunks with temporalEnsemble; otherwise play each chunk open-loop. */
  ensemble: boolean;
  m: number;
  /** Extra flow samples per replan, drawn as preview ribbons. */
  previews: number;
  odeSteps: number;
}

export interface ReachRollout {
  start: P2;
  target: P2;
  tips: P2[];
  arm: Q[];
  /** Replans: the step and the sampled chunk ribbons (fingertip previews). */
  plans: { step: number; ribbons: P2[][] }[];
  /** Flow-time snapshots of the first chunk's ribbon, noise to action (flow policy only). */
  denoise: P2[][];
  success: boolean;
  collided: boolean;
}

export function rolloutReach(r: ReachModel, a: RolloutArgs): ReachRollout {
  const rng = mulberry32(a.seed);
  const scene = randomScene(mulberry32(a.seed * 7 + 1));
  let q: Q = ik(scene.start);
  const tips: P2[] = [fk(q).tip];
  const arm: Q[] = [q];
  const plans: ReachRollout["plans"] = [];
  let denoise: P2[][] = [];
  const preds: ChunkPrediction[] = [];
  let collided = false;
  let current: number[][] = [];
  let k0 = 0;
  const maxSteps = EPISODE + 14;
  for (let step = 0; step < maxSteps; step++) {
    if (a.ensemble || step - k0 >= H || current.length === 0) {
      const ctx = context(q, scene.target);
      let chosen: number[][];
      const ribbons: P2[][] = [];
      if (a.policy === "flow") {
        const n = Math.max(1, a.previews);
        let first: number[][] | null = null;
        for (let s = 0; s < n; s++) {
          const path = flowChunk(r, ctx, rng, a.odeSteps);
          const acts = chunkActions(path[path.length - 1]);
          if (!first) {
            first = acts;
            if (plans.length === 0) denoise = path.map((x) => ribbon(q, chunkActions(x)));
          }
          ribbons.push(ribbon(q, acts));
        }
        chosen = first!;
      } else {
        chosen = chunkActions(regPredict(r.reg, [ctx])[0]);
        ribbons.push(ribbon(q, chosen));
      }
      if (!a.ensemble || step % 3 === 0) plans.push({ step, ribbons });
      current = chosen;
      k0 = step;
      preds.push({ start: step, actions: chosen });
    }
    const act = a.ensemble ? temporalEnsemble(preds, step, a.m) ?? [0, 0] : current[step - k0] ?? [0, 0];
    const d = clampStep(act.slice(0, ADIM));
    q = [q[0] + d[0], q[1] + d[1]];
    const tip = fk(q).tip;
    const prev = tips[tips.length - 1];
    for (let f = 0.25; f <= 1; f += 0.25) if (hitsPost([prev[0] + f * (tip[0] - prev[0]), prev[1] + f * (tip[1] - prev[1])])) collided = true;
    tips.push(tip);
    arm.push(q);
    if (collided) break;
    if (step > H && Math.hypot(tip[0] - scene.target[0], tip[1] - scene.target[1]) < 0.05) break;
  }
  const end = tips[tips.length - 1];
  const success = !collided && Math.hypot(end[0] - scene.target[0], end[1] - scene.target[1]) < 0.15;
  return { start: scene.start, target: scene.target, tips, arm, plans, denoise, success, collided };
}

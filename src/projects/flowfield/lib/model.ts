/**
 * The velocity network v_θ(x, t, c) and its training step. The step is plumbing around the user's
 * cores: conditionalPath + conditionalVelocity build each (x_t, u_t) pair, cfmLoss + cfmLossGrad
 * score the prediction, and the MLP backpropagates the gradient into the weights.
 */

import { conditionalPath, conditionalVelocity } from "../core/path";
import { cfmLoss, cfmLossGrad } from "../core/loss";
import { eulerStep } from "../core/euler";
import { guidedVelocity } from "../core/guidance";
import { TIME_FEATURES, writeInput } from "./features";
import { Adam, backward, forward, initMLP, type MLP } from "./mlp";
import { gaussVec, mulberry32, type Rng } from "./rng";

export interface FlowNet {
  net: MLP;
  dim: number;
  ctxDim: number;
  inDim: number;
}

export function makeFlowNet(dim: number, ctxDim: number, hidden: number[], seed: number): FlowNet {
  const inDim = dim + TIME_FEATURES + ctxDim;
  return { net: initMLP([inDim, ...hidden, dim], mulberry32(seed)), dim, ctxDim, inDim };
}

/** Batched prediction. xs: B × dim, ts: B, ctxs: B × ctxDim (or null rows). */
export function predict(m: FlowNet, xs: ArrayLike<number>[], ts: number[], ctxs: (ArrayLike<number> | null)[] | null): number[][] {
  const B = xs.length;
  const X = new Float32Array(B * m.inDim);
  for (let b = 0; b < B; b++) writeInput(X, b, m.inDim, xs[b], ts[b], ctxs ? ctxs[b] : null);
  const { out } = forward(m.net, X, B);
  const res: number[][] = new Array(B);
  for (let b = 0; b < B; b++) res[b] = Array.from(out.subarray(b * m.dim, (b + 1) * m.dim));
  return res;
}

export interface TrainBatch {
  /** B data points (or action chunks), each length dim. */
  x1: ArrayLike<number>[];
  /** B context vectors, or null for an unconditional model. */
  ctx: (ArrayLike<number> | null)[] | null;
}

/** One CFM step with the user's cores. Returns the batch loss. */
export function cfmStep(m: FlowNet, opt: Adam, batch: TrainBatch, rng: Rng, sigmaMin: number): number {
  const B = batch.x1.length;
  const X = new Float32Array(B * m.inDim);
  const targets: number[][] = new Array(B);
  for (let b = 0; b < B; b++) {
    const x1 = Array.from(batch.x1[b]);
    const x0 = gaussVec(rng, m.dim);
    const t = rng();
    const xt = conditionalPath(x0, x1, t, sigmaMin);
    targets[b] = conditionalVelocity(x0, x1, sigmaMin);
    writeInput(X, b, m.inDim, xt, t, batch.ctx ? batch.ctx[b] : null);
  }
  const { out, cache } = forward(m.net, X, B);
  const pred: number[][] = new Array(B);
  for (let b = 0; b < B; b++) pred[b] = Array.from(out.subarray(b * m.dim, (b + 1) * m.dim));
  const loss = cfmLoss(pred, targets);
  const g = cfmLossGrad(pred, targets);
  const dOut = new Float32Array(B * m.dim);
  for (let b = 0; b < B; b++) for (let i = 0; i < m.dim; i++) dOut[b * m.dim + i] = g[b][i];
  opt.step(m.net.params, backward(m.net, cache, dOut));
  return loss;
}

/**
 * Integrate many particles at once: the network is evaluated as one batch per time step, then the
 * user's eulerStep moves each particle. With `guide`, the conditional and unconditional fields are
 * blended by the user's guidedVelocity. Returns paths as a flat Float32Array (P × (steps+1) × dim).
 */
export function samplePaths(
  m: FlowNet,
  x0s: number[][],
  steps: number,
  ctx: ArrayLike<number> | null,
  guide?: { uncond: ArrayLike<number>; w: number },
): Float32Array {
  const P = x0s.length;
  const d = m.dim;
  const out = new Float32Array(P * (steps + 1) * d);
  let xs = x0s.map((x) => [...x]);
  const put = (k: number) => {
    for (let p = 0; p < P; p++) for (let i = 0; i < d; i++) out[(p * (steps + 1) + k) * d + i] = xs[p][i];
  };
  put(0);
  const dt = 1 / steps;
  for (let k = 0; k < steps; k++) {
    const t = k * dt;
    const ts = new Array<number>(P).fill(t);
    const vc = predict(m, xs, ts, ctx ? new Array(P).fill(ctx) : null);
    const v = guide ? (() => { const vu = predict(m, xs, ts, new Array(P).fill(guide.uncond)); return vc.map((c, p) => guidedVelocity(c, vu[p], guide.w)); })() : vc;
    xs = xs.map((x, p) => eulerStep(() => v[p], x, t, dt));
    put(k + 1);
  }
  return out;
}

export { Adam };
export function makeAdam(m: FlowNet, lr: number): Adam {
  return new Adam(m.net.params.length, lr);
}

/** Standard-normal starting points. */
export function noise(n: number, d: number, seed: number): number[][] {
  const rng = mulberry32(seed);
  return Array.from({ length: n }, () => gaussVec(rng, d));
}

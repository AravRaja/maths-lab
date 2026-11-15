import { gaussianNll } from "@/projects/say-and-reach/core/policy-head";
import { flowPair } from "@/projects/say-and-reach/core/flow";
import { cloneNet, NetAdam, netBackward, netForward, type PolicyNet } from "@/projects/say-and-reach/lib/nn/policy-net";
import { EPISODE_STEPS } from "./config";
import { expertAction } from "./expert";
import { EMBED_DIM, embed, OBJECTS, sampleCommand } from "./language";
import { FLOW_EXTRA, flowState, initFlowNet, initGaussianNet } from "./policy";
import { gauss, makeRng } from "./rng";
import { OBS_DIM, observe, randomScene, STATE_DIM, step } from "./world";

/*
 * Data and training loops. Pure functions: they run in the training Web Worker, and in tests.
 * The losses and their gradients come from the user's cores (gaussianNll, flowPair).
 */

export interface Demos {
  obs: Float32Array; // N × OBS_DIM
  act: Float32Array; // N × 2 (the expert's clean action)
  /** Index (into OBJECTS) of the object each command is about: the grounding label. */
  obj: Uint8Array;
  n: number;
  episodes: number;
}

/**
 * Roll the expert out on random scenes and commands. With `noise`, the arm executes a jittered
 * action but the label stays the expert's clean one (DART), so the data covers the small
 * mistakes a learned policy will make and shows how to recover from them. With `twoWay`, the
 * expert flips a coin each episode for which way round the object it walks.
 */
export function generateDemos(
  episodes: number,
  seed: number,
  opts: { noise?: number; twoWay?: boolean; onProgress?: (frac: number) => void } = {},
): Demos {
  const rng = makeRng(seed);
  const noise = opts.noise ?? 0.2;
  const N = episodes * EPISODE_STEPS;
  const obs = new Float32Array(N * OBS_DIM);
  const act = new Float32Array(N * 2);
  const obj = new Uint8Array(N);
  let n = 0;
  const row = new Float32Array(OBS_DIM);
  for (let e = 0; e < episodes; e++) {
    const scene = randomScene(rng);
    const { text, task } = sampleCommand(rng, "train");
    const tv = embed(text);
    const side = opts.twoWay && rng() < 0.5 ? -1 : 1;
    for (let t = 0; t < EPISODE_STEPS; t++) {
      const a = expertAction(scene, task, side);
      observe(scene, tv, row);
      obs.set(row, n * OBS_DIM);
      act[n * 2] = a[0];
      act[n * 2 + 1] = a[1];
      obj[n] = OBJECTS.indexOf(task.object);
      n++;
      step(scene, [a[0] + noise * gauss(rng), a[1] + noise * gauss(rng)]);
    }
    if (opts.onProgress && e % 10 === 0) opts.onProgress(e / episodes);
  }
  return { obs, act, obj, n, episodes };
}

export interface TrainProgress {
  step: number;
  loss: number;
  weights?: PolicyNet;
}

export interface TrainOptions {
  steps: number;
  batch?: number;
  lr?: number;
  seed?: number;
  /** Post a weights snapshot every this many steps, so the page can roll out the policy live. */
  snapshotEvery?: number;
  onProgress?: (p: TrainProgress) => void;
}

/** Cosine decay to 10% of the base rate. */
function lrAt(base: number, k: number, steps: number) {
  return base * (0.1 + 0.9 * 0.5 * (1 + Math.cos((Math.PI * k) / steps)));
}

function report(o: TrainOptions, k: number, loss: number, w: PolicyNet) {
  if (!o.onProgress) return;
  const last = k === o.steps - 1;
  const snap = (o.snapshotEvery && (k + 1) % o.snapshotEvery === 0) || last;
  if (k % 20 === 0 || snap) o.onProgress({ step: k + 1, loss, weights: snap ? cloneNet(w) : undefined });
}

export function trainGaussian(d: Demos, o: TrainOptions): PolicyNet {
  const rng = makeRng(o.seed ?? 1);
  const B = o.batch ?? 128;
  const base = o.lr ?? 5e-3;
  const w = initGaussianNet(rng);
  const opt = new NetAdam(w, base);
  const x = new Float32Array(B * STATE_DIM);
  const words = new Float32Array(B * EMBED_DIM);
  const tgt = new Float32Array(B * 2);
  const objT = new Uint8Array(B);
  const dOut = new Float32Array(B * 4);
  let ema = NaN;
  for (let k = 0; k < o.steps; k++) {
    for (let r = 0; r < B; r++) {
      const i = Math.floor(rng() * d.n);
      x.set(d.obs.subarray(i * OBS_DIM, i * OBS_DIM + STATE_DIM), r * STATE_DIM);
      words.set(d.obs.subarray(i * OBS_DIM + STATE_DIM, (i + 1) * OBS_DIM), r * EMBED_DIM);
      tgt[r * 2] = d.act[i * 2];
      tgt[r * 2 + 1] = d.act[i * 2 + 1];
      objT[r] = d.obj[i];
    }
    const f = netForward(w, x, words, B);
    let loss = 0;
    for (let r = 0; r < B; r++) {
      const out = f.out;
      const res = gaussianNll([out[r * 4], out[r * 4 + 1]], [out[r * 4 + 2], out[r * 4 + 3]], [tgt[r * 2], tgt[r * 2 + 1]]);
      loss += res.loss / B;
      dOut[r * 4] = res.dMu[0] / B;
      dOut[r * 4 + 1] = res.dMu[1] / B;
      dOut[r * 4 + 2] = res.dLogStd[0] / B;
      dOut[r * 4 + 3] = res.dLogStd[1] / B;
    }
    if (!Number.isFinite(loss)) throw new Error("The Gaussian NLL went non-finite. Check gaussianNll for overflowing exp() terms.");
    opt.lr = lrAt(base, k, o.steps);
    opt.step(netBackward(w, f, dOut, objT));
    ema = Number.isNaN(ema) ? loss : 0.95 * ema + 0.05 * loss;
    report(o, k, ema, w);
  }
  return w;
}

export function trainFlow(d: Demos, o: TrainOptions): PolicyNet {
  const rng = makeRng(o.seed ?? 2);
  const B = o.batch ?? 128;
  const base = o.lr ?? 5e-3;
  const S = STATE_DIM + FLOW_EXTRA;
  const w = initFlowNet(rng);
  const opt = new NetAdam(w, base);
  const x = new Float32Array(B * S);
  const words = new Float32Array(B * EMBED_DIM);
  const tgt = new Float32Array(B * 2);
  const row = new Float32Array(S);
  const objT = new Uint8Array(B);
  const dOut = new Float32Array(B * 2);
  let ema = NaN;
  for (let k = 0; k < o.steps; k++) {
    for (let r = 0; r < B; r++) {
      const i = Math.floor(rng() * d.n);
      const t = rng();
      const pair = flowPair([gauss(rng), gauss(rng)], [d.act[i * 2], d.act[i * 2 + 1]], t);
      flowState(d.obs.subarray(i * OBS_DIM, i * OBS_DIM + STATE_DIM), pair.xt, t, row);
      x.set(row, r * S);
      words.set(d.obs.subarray(i * OBS_DIM + STATE_DIM, (i + 1) * OBS_DIM), r * EMBED_DIM);
      tgt[r * 2] = pair.target[0];
      tgt[r * 2 + 1] = pair.target[1];
      objT[r] = d.obj[i];
    }
    const f = netForward(w, x, words, B);
    let loss = 0;
    for (let j = 0; j < B * 2; j++) {
      const e = f.out[j] - tgt[j];
      loss += (e * e) / B;
      dOut[j] = (2 * e) / B;
    }
    if (!Number.isFinite(loss)) throw new Error("The flow loss went non-finite. Check flowPair.");
    opt.lr = lrAt(base, k, o.steps);
    opt.step(netBackward(w, f, dOut, objT));
    ema = Number.isNaN(ema) ? loss : 0.95 * ema + 0.05 * loss;
    report(o, k, ema, w);
  }
  return w;
}

import { discountedReturns } from "../core/returns";
import { gae } from "../core/gae";
import { entropy, logProb } from "../core/policy";
import { clippedSurrogate } from "../core/surrogate";
import { valueLoss } from "../core/value-loss";
import { act, createAgent } from "./agent";
import { TorchEnv } from "./env";
import { Adam, backward, clipGlobalNorm, forward, type Mlp, type MlpCache } from "./mlp";
import { numericGrad } from "./numeric-grad";
import { mulberry32, shuffle, type Rng } from "./rng";

/*
 * The PPO loop (plumbing). Per iteration:
 *   1. roll out nEnvs × nSteps with the current policy  (actions sampled via the user's logProb)
 *   2. advantages with the user's gae(); value targets R = Â + V_old
 *   3. `epochs` passes of shuffled minibatches. Per sample the loss is the user's maths:
 *        −clippedSurrogate(exp(logπ − logπ_old), Â, ε) + c_V · valueLoss(V, R, V_old, c) − c_H · entropy(z)
 *      Its gradient in the head outputs (two logits, one value) is taken by central differences,
 *      then backprop and Adam carry it through the networks.
 * The user's discountedReturns() gives the Monte Carlo returns the critic's predictions are compared against.
 */

export interface PpoConfig {
  seed: number;
  nEnvs: number;
  nSteps: number;
  epochs: number;
  minibatches: number;
  gamma: number;
  lambda: number;
  clip: number;
  /** null = no value clipping. */
  valueClip: number | null;
  vfCoef: number;
  entCoef: number;
  lr: number;
  maxGradNorm: number;
}

export const DEFAULT_CONFIG: PpoConfig = {
  seed: 1,
  nEnvs: 8,
  nSteps: 128,
  epochs: 4,
  minibatches: 4,
  gamma: 0.99,
  lambda: 0.95,
  clip: 0.2,
  valueClip: null,
  vfCoef: 0.5,
  entCoef: 0.01,
  lr: 2e-3,
  maxGradNorm: 0.5,
};

export interface IterStats {
  iter: number;
  envSteps: number;
  /** Mean return of episodes that finished this iteration (null if none did). */
  meanReturn: number | null;
  /** Rolling mean over the last 20 finished episodes. */
  recentReturn: number | null;
  episodes: number;
  policyLoss: number;
  valueLoss: number;
  entropy: number;
  approxKl: number;
  clipFrac: number;
  /** Mean Monte Carlo return G_t over the rollout, from the user's discountedReturns(). */
  mcMean: number;
  /** Mean critic prediction V(s_t) over the same states. */
  vMean: number;
  /** Up to 240 (ratio, advantage) pairs from the last epoch, flattened. */
  ratios: number[];
  /** Mean Â over the rollout before normalisation, and its spread. */
  advMean: number;
  advStd: number;
  ms: number;
}

const mean = (xs: ArrayLike<number>) => {
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += xs[i];
  return xs.length ? s / xs.length : 0;
};

export class PpoTrainer {
  cfg: PpoConfig;
  actor: Mlp;
  critic: Mlp;
  private envs: TorchEnv[];
  private rng: Rng;
  private optA: Adam;
  private optC: Adam;
  private recent: number[] = [];
  iter = 0;
  envSteps = 0;

  constructor(cfg: Partial<PpoConfig> = {}, init?: { actor: Float64Array; critic: Float64Array }) {
    this.cfg = { ...DEFAULT_CONFIG, ...cfg };
    this.rng = mulberry32(this.cfg.seed * 7919 + 13);
    const fresh = createAgent(this.cfg.seed);
    this.actor = init ? { sizes: fresh.actor.sizes, params: Float64Array.from(init.actor) } : fresh.actor;
    this.critic = init ? { sizes: fresh.critic.sizes, params: Float64Array.from(init.critic) } : fresh.critic;
    this.envs = Array.from({ length: this.cfg.nEnvs }, (_, i) => new TorchEnv(mulberry32(this.cfg.seed * 1000 + i)));
    for (const e of this.envs) e.reset();
    this.optA = new Adam(this.actor.params.length, this.cfg.lr);
    this.optC = new Adam(this.critic.params.length, this.cfg.lr);
  }

  /** Live-tweakable knobs (the rest need a reset). */
  tune(p: Partial<Pick<PpoConfig, "lr" | "clip" | "entCoef" | "lambda" | "valueClip">>) {
    Object.assign(this.cfg, p);
    this.optA.lr = this.optC.lr = this.cfg.lr;
  }

  weights() {
    return { actor: Float64Array.from(this.actor.params), critic: Float64Array.from(this.critic.params) };
  }

  iterate(): IterStats {
    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    const { nEnvs, nSteps, gamma, lambda } = this.cfg;
    const N = nEnvs * nSteps;
    const obs: number[][] = new Array(N);
    const acts = new Int8Array(N);
    const oldLp = new Float64Array(N);
    const vals = new Float64Array(N);
    const adv = new Float64Array(N);
    const ret = new Float64Array(N);
    const mc = new Float64Array(N);
    const per = Array.from({ length: nEnvs }, () => ({ r: [] as number[], v: [] as number[], d: [] as boolean[] }));
    const finished: number[] = [];

    // 1. Rollout, env-major storage: index = e * nSteps + t.
    for (let t = 0; t < nSteps; t++) {
      for (let e = 0; e < nEnvs; e++) {
        const env = this.envs[e];
        const o = env.obs();
        const { action, logits } = act(this.actor, o, this.rng);
        const v = forward(this.critic, o)[0];
        const i = e * nSteps + t;
        obs[i] = o;
        acts[i] = action;
        oldLp[i] = logProb(logits, action);
        vals[i] = v;
        const res = env.step(action);
        per[e].r.push(res.reward);
        per[e].v.push(v);
        per[e].d.push(res.done);
        if (res.done) {
          finished.push(env.episodeReturn);
          env.reset();
        }
      }
    }
    this.envSteps += N;

    // 2. Advantages (user's gae) and Monte Carlo returns (user's discountedReturns).
    for (let e = 0; e < nEnvs; e++) {
      const last = forward(this.critic, this.envs[e].obs())[0];
      const A = gae(per[e].r, per[e].v, per[e].d, gamma, lambda, last);
      const G = discountedReturns(per[e].r, per[e].d, gamma, last);
      for (let t = 0; t < nSteps; t++) {
        const i = e * nSteps + t;
        adv[i] = A[t];
        ret[i] = A[t] + vals[i];
        mc[i] = G[t];
      }
    }
    const advMean = mean(adv);
    const advStd = Math.sqrt(mean(Array.from(adv, (a) => (a - advMean) ** 2)));

    // 3. Optimise.
    const { epochs, minibatches, clip, valueClip, vfCoef, entCoef, maxGradNorm } = this.cfg;
    const mb = Math.floor(N / minibatches);
    const idx = Array.from({ length: N }, (_, i) => i);
    const gA = new Float64Array(this.actor.params.length);
    const gC = new Float64Array(this.critic.params.length);
    const cache: MlpCache = { acts: [] };
    let pl = 0, vl = 0, ent = 0, kl = 0, cf = 0, count = 0;
    const ratios: number[] = [];

    for (let ep = 0; ep < epochs; ep++) {
      shuffle(idx, this.rng);
      for (let b = 0; b < minibatches; b++) {
        gA.fill(0);
        gC.fill(0);
        const batch = idx.slice(b * mb, (b + 1) * mb);
        let am = 0, as = 0;
        for (const i of batch) am += adv[i];
        am /= batch.length;
        for (const i of batch) as += (adv[i] - am) ** 2;
        as = Math.sqrt(as / batch.length) + 1e-8;

        for (const i of batch) {
          const a = acts[i];
          const An = (adv[i] - am) / as;
          // Policy head.
          const z = Array.from(forward(this.actor, obs[i], cache));
          const policyTerm = (zz: number[]) =>
            -clippedSurrogate(Math.exp(logProb(zz, a) - oldLp[i]), An, clip) - entCoef * entropy(zz);
          const dz = numericGrad(policyTerm, z, 1e-5);
          backward(this.actor, cache, dz.map((g) => g / batch.length), gA);
          const lp = logProb(z, a);
          const r = Math.exp(lp - oldLp[i]);
          // Value head.
          const v = forward(this.critic, obs[i], cache)[0];
          const valueTerm = (vv: number[]) => vfCoef * valueLoss(vv[0], ret[i], vals[i], valueClip);
          const dv = numericGrad(valueTerm, [v], 1e-5);
          backward(this.critic, cache, [dv[0] / batch.length], gC);

          if (ep === epochs - 1) {
            pl += -clippedSurrogate(r, An, clip);
            vl += valueLoss(v, ret[i], vals[i], valueClip);
            ent += entropy(z);
            kl += r - 1 - (lp - oldLp[i]);
            cf += Math.abs(r - 1) > clip ? 1 : 0;
            count++;
            if (ratios.length < 480 && this.rng() < 480 / N) ratios.push(r, An);
          }
        }
        clipGlobalNorm([gA], maxGradNorm);
        clipGlobalNorm([gC], maxGradNorm);
        this.optA.step(this.actor.params, gA);
        this.optC.step(this.critic.params, gC);
      }
    }

    for (const f of finished) this.recent.push(f);
    if (this.recent.length > 20) this.recent.splice(0, this.recent.length - 20);
    this.iter++;
    const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
    return {
      iter: this.iter,
      envSteps: this.envSteps,
      meanReturn: finished.length ? mean(finished) : null,
      recentReturn: this.recent.length ? mean(this.recent) : null,
      episodes: finished.length,
      policyLoss: pl / count,
      valueLoss: vl / count,
      entropy: ent / count,
      approxKl: kl / count,
      clipFrac: cf / count,
      mcMean: mean(mc),
      vMean: mean(vals),
      ratios,
      advMean,
      advStd,
      ms: t1 - t0,
    };
  }
}

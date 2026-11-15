/// <reference lib="webworker" />
import { exposeWorker } from "@/kit/worker";
import { isNotYoursYet } from "@/kit/not-yours-yet";
import { epsilonGreedy } from "../core/explore";
import { qLearningUpdate, td0Update } from "../core/td";
import { bellmanExpectationBackup } from "../core/backups";
import { buildMdp, type World, type WorldParams } from "../lib/grid";
import { liveStates, sampleStep } from "../lib/env";
import { mulberry32, randInt } from "../lib/rng";
import { supDist, uniformPolicy } from "../lib/policy";

/*
 * The trial-and-error loops. The loop, the environment and the bookkeeping are scaffolding; every
 * update (td0Update, qLearningUpdate) and every action choice (epsilonGreedy) is the user's core.
 * Frames stream back as progress so the page can draw the agent learning live.
 */

const sleep = (ms = 0) => new Promise((r) => setTimeout(r, ms));

export interface QArgs {
  world: World;
  params: WorldParams;
  gamma: number;
  alpha: number;
  epsilon: number;
  /** Multiply ε by this after every episode (1 = constant). */
  decay: number;
  /** Episodes to run in this call. */
  episodes: number;
  /** Episodes per frame (1 = watchable, larger = fast). */
  perFrame: number;
  /** ms to wait between frames, so slow mode is watchable. */
  frameDelay: number;
  /** Extra ms per step of the last episode (lets the page replay it before the next one). */
  stepDelay: number;
  maxSteps: number;
  seed: number;
  /** Resume state. */
  Q?: Float64Array;
  visits?: Float64Array;
  episode0?: number;
}

export interface QFrame {
  episode: number;
  epsilon: number;
  Q: Float64Array;
  visits: Float64Array;
  /** Discounted return Σ γ^t r_t of every episode finished since the last frame. */
  returns: number[];
  /** States of the last episode, for the replay. */
  trail: number[];
  steps: number;
}

export interface TdArgs {
  world: World;
  params: WorldParams;
  gamma: number;
  alpha: number;
  episodes: number;
  perFrame: number;
  maxSteps: number;
  seed: number;
  V?: Float64Array;
  episode0?: number;
}

export interface TdFrame {
  episode: number;
  V: Float64Array;
  /** ‖V − V^π‖ (RMS over live states) against the DP answer, if bellmanExpectationBackup is written. */
  rms: number | null;
  truth: Float64Array | null;
  trail: number[];
}

export const handlers = {
  async qlearn(a: QArgs, progress: (v: unknown) => void) {
    const mdp = buildMdp(a.world, a.params);
    const { nA } = mdp;
    const rand = mulberry32(a.seed);
    const Q = a.Q ? Float64Array.from(a.Q) : new Float64Array(mdp.nS * nA);
    const visits = a.visits ? Float64Array.from(a.visits) : new Float64Array(mdp.nS);
    let eps = a.epsilon;
    let returns: number[] = [];
    let trail: number[] = [];
    let steps = 0;
    let frame: QFrame | null = null;
    for (let e = 1; e <= a.episodes; e++) {
      let s = a.world.start;
      const tr = [s];
      let G = 0;
      let disc = 1;
      for (let t = 0; t < a.maxSteps; t++) {
        const a0 = epsilonGreedy(Q.subarray(s * nA, s * nA + nA), eps, rand);
        const { s2, r, done } = sampleStep(mdp, s, a0, rand);
        qLearningUpdate(Q, nA, s, a0, r, s2, done, a.alpha, a.gamma);
        G += disc * r;
        disc *= a.gamma;
        visits[s2]++;
        steps++;
        tr.push(s2);
        s = s2;
        if (done) break;
      }
      returns.push(G);
      trail = tr;
      if (a.decay < 1) eps = Math.max(0.02, eps * a.decay); // decay, but never stop exploring entirely
      if (e % a.perFrame === 0 || e === a.episodes) {
        frame = { episode: (a.episode0 ?? 0) + e, epsilon: eps, Q: Q.slice(), visits: visits.slice(), returns, trail, steps };
        progress(frame);
        returns = [];
        steps = 0;
        await sleep(Math.min(2400, a.frameDelay + trail.length * a.stepDelay));
      }
    }
    return frame;
  },

  async td0(a: TdArgs, progress: (v: unknown) => void) {
    const mdp = buildMdp(a.world, a.params);
    const rand = mulberry32(a.seed);
    const V = a.V ? Float64Array.from(a.V) : new Float64Array(mdp.nS);
    const starts = liveStates(mdp);
    const pi = uniformPolicy(mdp.nS, mdp.nA);
    // The DP answer to compare against, from the user's expectation backup if it exists.
    let truth: Float64Array | null = null;
    try {
      let W: Float64Array = new Float64Array(mdp.nS);
      for (let k = 0; k < 3000; k++) {
        const N = bellmanExpectationBackup(mdp, W, pi, a.gamma);
        const d = supDist(N, W);
        W = N;
        if (d < 1e-7) break;
      }
      truth = W;
    } catch (e) {
      if (!isNotYoursYet(e)) throw e;
    }
    const rmsOf = () => {
      if (!truth) return null;
      let se = 0;
      for (const s of starts) se += (V[s] - truth[s]) ** 2;
      return Math.sqrt(se / Math.max(1, starts.length));
    };
    let frame: TdFrame | null = null;
    for (let e = 1; e <= a.episodes; e++) {
      // Exploring starts so every state gets visited.
      let s = starts[randInt(rand, starts.length)];
      const tr = [s];
      for (let t = 0; t < a.maxSteps; t++) {
        const act = randInt(rand, mdp.nA);
        const { s2, r, done } = sampleStep(mdp, s, act, rand);
        td0Update(V, s, r, s2, done, a.alpha, a.gamma);
        tr.push(s2);
        s = s2;
        if (done) break;
      }
      if (e % a.perFrame === 0 || e === a.episodes) {
        frame = { episode: (a.episode0 ?? 0) + e, V: V.slice(), rms: rmsOf(), truth: e === a.perFrame || e === a.episodes ? truth : null, trail: tr };
        progress(frame);
        await sleep(0);
      }
    }
    return frame;
  },
};

exposeWorker(handlers);

/// <reference lib="webworker" />
import { exposeWorker } from "@/kit/worker";
import { dropLabel } from "../core/guidance";
import { SIGMA_MIN, NULL_LABEL } from "../lib/config";
import { cfmStep, makeAdam, makeFlowNet, noise, samplePaths, type Adam, type FlowNet } from "../lib/model";
import { mulberry32, randInt, type Rng } from "../lib/rng";
import { makeReachModel, rolloutReach, trainReach, type ReachModel, type ReachRollout, type RolloutArgs } from "../lib/policy";
import type { Pt } from "../lib/shapes";

/*
 * All training and sampling runs here, off the main thread. Each section keeps a model in this
 * worker and calls it in short bursts (train N steps, sample, repeat), so the page can pause,
 * resume and draw while it learns. The maths inside every step is the user's cores.
 */

interface Model2D { m: FlowNet; opt: Adam; data: Pt[]; rng: Rng; step: number }
interface ModelCond { m: FlowNet; opt: Adam; sets: Pt[][]; rng: Rng; step: number; pDrop: number }

let s2d: Model2D | null = null;
let sCond: ModelCond | null = null;
let sReach: ReachModel | null = null;

const oneHot = (k: number, n: number) => Array.from({ length: n }, (_, i) => (i === k ? 1 : 0));

export type { ReachRollout };

export const handlers = {
  // ---------- M4: one shape, unconditional ----------
  init2d(a: { points: Pt[]; seed: number }) {
    const m = makeFlowNet(2, 0, [96, 96, 96], a.seed);
    s2d = { m, opt: makeAdam(m, 3e-3), data: a.points, rng: mulberry32(a.seed + 1), step: 0 };
    return { params: m.net.params.length };
  },

  train2d(a: { steps: number; batch: number }) {
    const s = s2d;
    if (!s) throw new Error("init2d first");
    const losses: number[] = [];
    const t0 = performance.now();
    for (let k = 0; k < a.steps; k++) {
      const x1 = Array.from({ length: a.batch }, () => s.data[randInt(s.rng, s.data.length)]);
      losses.push(cfmStep(s.m, s.opt, { x1, ctx: null }, s.rng, SIGMA_MIN));
      s.step++;
    }
    return { step: s.step, losses, ms: performance.now() - t0 };
  },

  sample2d(a: { n: number; steps: number; seed: number }) {
    if (!s2d) throw new Error("init2d first");
    return samplePaths(s2d.m, noise(a.n, 2, a.seed), a.steps, null);
  },

  // ---------- M5: several glyphs, one conditional net ----------
  initCond(a: { sets: Pt[][]; seed: number; pDrop: number }) {
    const m = makeFlowNet(2, a.sets.length, [128, 128, 128], a.seed);
    sCond = { m, opt: makeAdam(m, 3e-3), sets: a.sets, rng: mulberry32(a.seed + 7), step: 0, pDrop: a.pDrop };
    return { params: m.net.params.length };
  },

  trainCond(a: { steps: number; batch: number }) {
    const s = sCond;
    if (!s) throw new Error("initCond first");
    const K = s.sets.length;
    const losses: number[] = [];
    for (let k = 0; k < a.steps; k++) {
      const x1: Pt[] = [];
      const ctx: number[][] = [];
      for (let b = 0; b < a.batch; b++) {
        const label = randInt(s.rng, K);
        const set = s.sets[label];
        x1.push(set[randInt(s.rng, set.length)]);
        const shown = dropLabel(label, s.pDrop, s.rng(), NULL_LABEL);
        ctx.push(shown === NULL_LABEL ? new Array(K).fill(0) : oneHot(shown, K));
      }
      losses.push(cfmStep(s.m, s.opt, { x1, ctx }, s.rng, SIGMA_MIN));
      s.step++;
    }
    return { step: s.step, losses };
  },

  /** label −1 = unconditional. w = guidance weight (1 = plain conditional). */
  sampleCond(a: { label: number; w: number; n: number; steps: number; seed: number }) {
    const s = sCond;
    if (!s) throw new Error("initCond first");
    const K = s.sets.length;
    const uncond = new Array(K).fill(0);
    const ctx = a.label < 0 ? uncond : oneHot(a.label, K);
    return samplePaths(s.m, noise(a.n, 2, a.seed), a.steps, ctx, a.label < 0 || a.w === 1 ? undefined : { uncond, w: a.w });
  },

  // ---------- M6: action chunks for the reacher ----------
  initReacher(a: { demos: number; seed: number }) {
    const { model, demos } = makeReachModel(a.demos, a.seed);
    sReach = model;
    return { pairs: model.ctx.length, demoTips: demos.slice(0, 48).map((d) => d.tips), sides: demos.slice(0, 48).map((d) => d.side) };
  },

  trainReacher(a: { steps: number; batch: number }) {
    if (!sReach) throw new Error("initReacher first");
    return trainReach(sReach, a.steps, a.batch);
  },

  rollout(a: RolloutArgs): ReachRollout {
    if (!sReach) throw new Error("initReacher first");
    return rolloutReach(sReach, a);
  },

  evaluate(a: Omit<RolloutArgs, "previews"> & { n: number }, progress: (v: unknown) => void) {
    const r = sReach;
    if (!r) throw new Error("initReacher first");
    let ok = 0;
    let hit = 0;
    for (let i = 0; i < a.n; i++) {
      const out = rolloutReach(r, { ...a, seed: a.seed + i * 13, previews: 1 });
      if (out.success) ok++;
      if (out.collided) hit++;
      progress((i + 1) / a.n);
    }
    return { success: ok / a.n, collided: hit / a.n };
  },
};

exposeWorker(handlers);

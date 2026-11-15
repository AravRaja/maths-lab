/**
 * The heavy sampling for the page: streaming darts for π, importance-sampling runs and the
 * forward/reverse KL landscape. Every estimate goes through the user's cores; when one is still
 * a stub the worker keeps sampling (so the picture still moves) and reports which core is missing.
 */
import { exposeWorker } from "@/kit/worker";
import { isNotYoursYet, serializeNotYoursYet, type NotYoursYet } from "@/kit/not-yours-yet";
import { mcEstimate } from "../core/montecarlo";
import { effectiveSampleSize, importanceWeights } from "../core/importance";
import { mulberry32, normalSampler } from "../lib/rng";
import { mixtureLogPdf, mixtureSample, normalLogPdf, type Mixture } from "../lib/special";
import { IS_TARGETS, type IsTargetName } from "../lib/targets";

type Missing = ReturnType<typeof serializeNotYoursYet>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function asMissing(e: unknown): Missing {
  if (isNotYoursYet(e)) return serializeNotYoursYet(e as NotYoursYet);
  throw e;
}

export type Estimator = "darts" | "curve";

export interface DartsFrame {
  n: number;
  /** Newest run-0 samples to draw: (x, y) pairs in [0, 1]². For "curve", y is f(x)/4. */
  points: Float32Array;
  /** Checkpoints crossed in this batch: n, each run's running estimate, run 0's standard error. */
  checkpoints: { n: number; means: number[]; se: number }[];
  missing: Missing | null;
}

function checkpointsUpTo(maxN: number): number[] {
  const out: number[] = [];
  for (let v = 8; v < maxN; v *= 1.12) {
    const r = Math.round(v);
    if (r !== out[out.length - 1]) out.push(r);
  }
  out.push(maxN);
  return out;
}

export const handlers = {
  /** Throw darts (or evaluate a curve) in `runs` independent streams, streaming frames as n grows. */
  async darts(args: { seed: number; estimator: Estimator; runs: number; maxN: number }, progress: (v: unknown) => void) {
    const { seed, estimator, runs, maxN } = args;
    const rngs = Array.from({ length: runs }, (_, r) => mulberry32(seed * 7919 + r * 104729 + 1));
    const vals = Array.from({ length: runs }, () => new Float64Array(maxN));
    const cps = checkpointsUpTo(maxN);
    let next = 0;
    let n = 0;
    let missing: Missing | null = null;
    while (n < maxN) {
      const batch = Math.min(maxN - n, Math.max(6, Math.floor(n * 0.05)));
      const stride = Math.max(1, Math.ceil(batch / 2500));
      const pts: number[] = [];
      for (let r = 0; r < runs; r++) {
        const rng = rngs[r];
        const v = vals[r];
        for (let i = 0; i < batch; i++) {
          const x = rng();
          if (estimator === "darts") {
            const y = rng();
            v[n + i] = x * x + y * y <= 1 ? 4 : 0;
            if (r === 0 && i % stride === 0) pts.push(x, y);
          } else {
            const f = 4 / (1 + x * x);
            v[n + i] = f;
            if (r === 0 && i % stride === 0) pts.push(x, f / 4);
          }
        }
      }
      n += batch;
      const checkpoints: DartsFrame["checkpoints"] = [];
      while (next < cps.length && cps[next] <= n) {
        const k = cps[next++];
        if (missing) continue;
        try {
          const ests = vals.map((v) => mcEstimate(v.subarray(0, k)));
          checkpoints.push({ n: k, means: ests.map((e) => e.mean), se: ests[0].stdErr });
        } catch (e) {
          missing = asMissing(e);
        }
      }
      progress({ n, points: new Float32Array(pts), checkpoints, missing } satisfies DartsFrame);
      await sleep(n < 2000 ? 45 : 30);
    }
    return { n };
  },

  /** One importance-sampling run (drawn on the page) plus many repeated trials for the spread. */
  importance(args: { target: IsTargetName; muQ: number; sdQ: number; n: number; trials: number; trialN: number; seed: number }) {
    const T = IS_TARGETS[args.target];
    const rng = mulberry32(args.seed);
    const z = normalSampler(rng);
    const varQ = args.sdQ * args.sdQ;
    const drawQ = (k: number) => Float64Array.from({ length: k }, () => args.muQ + args.sdQ * z());
    const logpOf = (xs: Float64Array) => xs.map((x) => mixtureLogPdf(x, T.p));
    const logqOf = (xs: Float64Array) => xs.map((x) => normalLogPdf(x, args.muQ, varQ));

    const xs = drawQ(args.n);
    // Plain Monte Carlo spread: sample straight from p. Needs no core.
    const naive: number[] = [];
    for (let t = 0; t < args.trials; t++) {
      let s = 0;
      for (let i = 0; i < args.trialN; i++) s += T.f(mixtureSample(T.p, rng(), z()));
      naive.push(s / args.trialN);
    }
    try {
      // Self-normalised: Σ w̃ f. When p is normalised, ordinary IS is (1/n) Σ (p/q) f = Ẑ · Σ w̃ f,
      // with Ẑ = (1/n) Σ p/q (plumbing; the weights themselves come from your core).
      const estimate = (ys: Float64Array) => {
        const lp = logpOf(ys), lq = logqOf(ys);
        const wt = importanceWeights(lp, lq);
        let s = 0;
        for (let i = 0; i < ys.length; i++) s += wt[i] * T.f(ys[i]);
        if (!T.normalised) return { s, wt };
        let z = 0;
        for (let i = 0; i < ys.length; i++) z += Math.exp(lp[i] - lq[i]);
        return { s: (s * z) / ys.length, wt };
      };
      const first = estimate(xs);
      const w = first.wt;
      const ess = effectiveSampleSize(w);
      const est = first.s;
      const trials: number[] = [];
      for (let t = 0; t < args.trials; t++) trials.push(estimate(drawQ(args.trialN)).s);
      return { xs: Float32Array.from(xs), w: Float32Array.from(w), ess, est, naive, trials, missing: null };
    } catch (e) {
      return { xs: Float32Array.from(xs), w: null, ess: null, est: null, naive, trials: null, missing: asMissing(e) };
    }
  },

  /**
   * Fit a single Gaussian q to a mixture p by brute force: forward KL(p‖q) and reverse KL(q‖p) over a
   * (μ, log σ) grid, each a Monte Carlo estimate (through the user's mcEstimate) with common random numbers.
   */
  klLandscape(args: { p: Mixture; mus: [number, number]; logSds: [number, number]; grid: number; samples: number; seed: number }) {
    const { p, grid, samples } = args;
    const rng = mulberry32(args.seed);
    const z = normalSampler(rng);
    const zq = Float64Array.from({ length: samples }, () => z());
    const xp = Float64Array.from({ length: samples }, () => mixtureSample(p, rng(), z()));
    const logpAtXp = xp.map((x) => mixtureLogPdf(x, p));
    const forward = new Float32Array(grid * grid);
    const reverse = new Float32Array(grid * grid);
    const buf = new Float64Array(samples);
    try {
      for (let r = 0; r < grid; r++) {
        // row 0 = largest σ (top of the picture)
        const sd = Math.exp(args.logSds[1] - ((args.logSds[1] - args.logSds[0]) * r) / (grid - 1));
        const v = sd * sd;
        for (let c = 0; c < grid; c++) {
          const mu = args.mus[0] + ((args.mus[1] - args.mus[0]) * c) / (grid - 1);
          for (let i = 0; i < samples; i++) buf[i] = logpAtXp[i] - normalLogPdf(xp[i], mu, v);
          forward[r * grid + c] = mcEstimate(buf).mean;
          for (let i = 0; i < samples; i++) {
            const x = mu + sd * zq[i];
            buf[i] = normalLogPdf(x, mu, v) - mixtureLogPdf(x, p);
          }
          reverse[r * grid + c] = mcEstimate(buf).mean;
        }
      }
      return { forward, reverse, missing: null };
    } catch (e) {
      return { forward: null, reverse: null, missing: asMissing(e) };
    }
  },
};

exposeWorker(handlers);

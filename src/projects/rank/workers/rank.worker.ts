/// <reference lib="webworker" />
import { exposeWorker } from "@/kit/worker";
import type { Matrix, PCA } from "../core/types";
import { svd } from "../lib/svd";
import { powerIteration } from "../core/power";
import { encode, meanCenter, pca } from "../core/pca";
import { topKByPower } from "../lib/my-svd";
import { makeFaces } from "../lib/faces";

/*
 * Everything heavy, off the main thread. The library SVD is plumbing; powerIteration, deflate,
 * pca and encode are the user's cores and throw NotYoursYet until written (the page catches it).
 */

export interface PowerFrame {
  t: number;
  sigma: number;
  v: Float64Array;
  u: Float64Array;
}

export const handlers = {
  /** Library SVD with a progress tick per Jacobi sweep. */
  svd({ A }: { A: Matrix }, progress: (v: unknown) => void) {
    const t0 = performance.now();
    const s = svd(A, { onSweep: (sweep, off) => progress({ sweep, off }) });
    return { svd: s, ms: performance.now() - t0 };
  },

  /** Power iteration replayed for t = 1..steps from the same start vector, one frame per t. */
  powerTrace({ A, steps, v0 }: { A: Matrix; steps: number; v0: Float64Array }, progress: (v: unknown) => void) {
    const frames: PowerFrame[] = [];
    for (let t = 1; t <= steps; t++) {
      const r = powerIteration(A, { iters: t, tol: 0, v0 });
      const f = { t, sigma: r.sigma, v: r.v, u: r.u };
      frames.push(f);
      progress(f);
    }
    return frames;
  },

  /** Your top-k SVD (power iteration + deflation) against the library's, with timings. */
  race({ A, k }: { A: Matrix; k: number }, progress: (v: unknown) => void) {
    const t0 = performance.now();
    const lib = svd(A);
    const tLib = performance.now() - t0;
    const t1 = performance.now();
    const mine = topKByPower(A, k, (i, sigma, iters) => progress({ i, sigma, iters }));
    const tMine = performance.now() - t1;
    return { lib: lib.S.slice(0, k), mine, tLib, tMine };
  },

  /** The synthetic face crowd (plumbing). */
  faces({ n, seed }: { n: number; seed: number }) {
    const f = makeFaces(n, seed);
    return { X: f.X, w: f.w, h: f.h };
  },

  /** Your PCA on the crowd, plus every face's first coefficients for the face-space map. */
  eigenfaces({ X, k, keep }: { X: Matrix; k: number; keep: number }) {
    // Centring first, so the panel points at the earliest missing core.
    meanCenter({ rows: 2, cols: 1, data: new Float64Array([0, 1]) });
    const t0 = performance.now();
    const p: PCA = pca(X, k);
    const ms = performance.now() - t0;
    const d = X.cols;
    const coeffs = new Float64Array(X.rows * keep);
    for (let i = 0; i < X.rows; i++) coeffs.set(encode(X.data.subarray(i * d, (i + 1) * d), p, keep), i * keep);
    return { pca: p, coeffs, ms };
  },
};

exposeWorker(handlers);

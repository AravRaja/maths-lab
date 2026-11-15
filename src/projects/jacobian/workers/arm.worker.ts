import { exposeWorker } from "@/kit/worker";
import { isNotYoursYet } from "@/kit/not-yours-yet";
import { forwardKinematics } from "../core/kinematics";
import { geometricJacobian, manipulability } from "../core/jacobian";
import { ARM } from "../lib/arm";
import { rng } from "../lib/rng";

/*
 * Heavy sampling off the main thread, all on the user's cores:
 *  - workspace: tool positions for thousands of random joint vectors (plus their manipulability once M3 exists)
 *  - manipMap: position manipulability over a grid of (shoulder, elbow) with the other joints fixed
 */

export const handlers = {
  workspace(args: { n: number; seed: number }, progress: (v: unknown) => void) {
    const u = rng(args.seed);
    const pts = new Float32Array(args.n * 4);
    let haveW = true;
    const n = ARM.joints.length;
    for (let i = 0; i < args.n; i++) {
      const q = ARM.joints.map((j) => j.limits[0] + u() * (j.limits[1] - j.limits[0]));
      const F = forwardKinematics(q, ARM);
      const T = F[n];
      pts[i * 4] = T[0][3];
      pts[i * 4 + 1] = T[1][3];
      pts[i * 4 + 2] = T[2][3];
      let w = NaN;
      if (haveW) {
        try {
          w = manipulability(geometricJacobian(F, ARM).slice(0, 3));
        } catch (e) {
          if (!isNotYoursYet(e)) throw e;
          haveW = false;
        }
      }
      pts[i * 4 + 3] = w;
      if (i % 2000 === 0) progress(i / args.n);
    }
    return { pts, haveW };
  },

  manipMap(args: { q: number[]; res: number }) {
    const { res } = args;
    const [lo1, hi1] = ARM.joints[1].limits;
    const [lo2, hi2] = ARM.joints[2].limits;
    const values = new Float32Array(res * res);
    for (let r = 0; r < res; r++) {
      for (let c = 0; c < res; c++) {
        const q = args.q.slice();
        q[1] = lo1 + ((c + 0.5) / res) * (hi1 - lo1);
        q[2] = hi2 - ((r + 0.5) / res) * (hi2 - lo2);
        const F = forwardKinematics(q, ARM);
        values[r * res + c] = manipulability(geometricJacobian(F, ARM).slice(0, 3));
      }
    }
    return { values, res };
  },
};

exposeWorker(handlers);

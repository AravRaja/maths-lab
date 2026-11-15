import { exposeWorker } from "@/kit/worker";
import { kalmanPredict, kalmanUpdate } from "../core/kalman";
import { constantVelocity, firefly } from "../lib/tracker";
import { eye, matScale } from "../lib/linalg";
import { gaussian, rng } from "../lib/rng";

/*
 * Tuning curve: tracking error of the user's Kalman filter on the firefly, swept over the process
 * noise q, averaged over several noisy runs. Too small a q and the filter lags behind darts; too
 * big and it just follows the noise.
 */

export const handlers = {
  sweep(args: { sigma: number; qs: number[]; runs: number; steps: number; dt: number }, progress: (v: unknown) => void) {
    const { sigma, qs, runs, steps, dt } = args;
    const R = matScale(eye(3), sigma * sigma);
    const rmse: number[] = [];
    let raw = 0;
    qs.forEach((q, qi) => {
      const { F, Q, H } = constantVelocity(3, dt, q);
      let se = 0;
      let rawSe = 0;
      let n = 0;
      for (let r = 0; r < runs; r++) {
        const g = gaussian(rng(1000 + r));
        const t0 = r * 37.1;
        let s = { x: [...firefly(t0, r), 0, 0, 0], P: matScale(eye(6), 0.05) };
        for (let k = 0; k < steps; k++) {
          const truth = firefly(t0 + k * dt, r);
          const z = truth.map((v) => v + sigma * g());
          const p = kalmanPredict(s.x, s.P, F, Q);
          const u = kalmanUpdate(p.x, p.P, z, H, R);
          s = { x: u.x, P: u.P };
          if (k > 20) {
            se += (s.x[0] - truth[0]) ** 2 + (s.x[1] - truth[1]) ** 2 + (s.x[2] - truth[2]) ** 2;
            rawSe += (z[0] - truth[0]) ** 2 + (z[1] - truth[1]) ** 2 + (z[2] - truth[2]) ** 2;
            n++;
          }
        }
      }
      rmse.push(Math.sqrt(se / n));
      raw = Math.sqrt(rawSe / n);
      progress((qi + 1) / qs.length);
    });
    return { rmse, raw };
  },
};

exposeWorker(handlers);

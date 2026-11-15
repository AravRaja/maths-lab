import { exposeWorker } from "@/kit/worker";
import { CARTPOLE, cartPoleStep, clampForce, wrapAngle } from "../lib/cartpole";

/*
 * Region of attraction: from a grid of initial (angle, angular velocity), run the full nonlinear
 * cart-pole under u = −Kx with the motor's force limit and record how fast it settles (or that it fell).
 * K comes from the page (the user's dlqr), so this worker is pure simulation.
 */

export const handlers = {
  basin(args: { K: number[]; res: number; thMax: number; wMax: number; seconds: number }, progress: (v: unknown) => void) {
    const { K, res, thMax, wMax, seconds } = args;
    const dt = 0.02;
    const steps = Math.round(seconds / dt);
    const out = new Float32Array(res * res);
    for (let r = 0; r < res; r++) {
      const w0 = wMax - ((r + 0.5) / res) * 2 * wMax;
      for (let c = 0; c < res; c++) {
        const th0 = -thMax + ((c + 0.5) / res) * 2 * thMax;
        let x = [0, 0, th0, w0];
        let settled = -1;
        let fell = false;
        for (let k = 0; k < steps; k++) {
          const xs = [x[0], x[1], wrapAngle(x[2]), x[3]];
          const u = clampForce(CARTPOLE, -(K[0] * xs[0] + K[1] * xs[1] + K[2] * xs[2] + K[3] * xs[3]));
          x = cartPoleStep(CARTPOLE, cartPoleStep(CARTPOLE, x, u, dt / 2), u, dt / 2);
          if (Math.abs(x[0]) > CARTPOLE.rail * 2 || !x.every(Number.isFinite)) {
            fell = true;
            break;
          }
          const near = Math.abs(wrapAngle(x[2])) < 0.03 && Math.abs(x[3]) < 0.1;
          if (near && settled < 0) settled = k;
          if (!near) settled = -1;
        }
        out[r * res + c] = fell || settled < 0 ? 0 : 0.25 + 0.75 * (1 - settled / steps);
      }
      if (r % 4 === 0) progress({ row: r, partial: out.slice() });
    }
    return out;
  },
};

exposeWorker(handlers);

import { notYoursYet } from "@/kit/not-yours-yet";

const FILE = "src/projects/say-and-reach/core/flow.ts";

export interface FlowPair {
  /** The point on the path at time t. */
  xt: number[];
  /** The velocity the network should predict there. */
  target: number[];
}

/**
 * Flow matching on actions: a training pair on the straight-line (rectified flow) path.
 *
 * Draw noise x_0 ~ N(0, I) and take an expert action x_1 = a. Join them with a straight line
 * and ask the network v_θ(x_t, t | scene, words) to predict the line's velocity.
 *
 * Maths:   x_t = (1 − t) x_0 + t x_1,      u_t = d x_t / dt
 *          loss = ‖v_θ(x_t, t) − u_t‖²     (the training loop does this part)
 *
 * Signature: flowPair(noise: number[], action: number[], t: number) => { xt, target }
 *   noise and action have the same length d, 0 ≤ t ≤ 1.
 *
 * On paper first:
 *  - Differentiate x_t with respect to t. Does the target depend on t?
 *  - Check the endpoints: x_0 is pure noise, x_1 is the action.
 *  - Two demos for the same scene go opposite ways round the cube. A Gaussian head has to
 *    average them. Could a flow keep two separate streams? What would it need to learn?
 */
export function flowPair(noise: number[], action: number[], t: number): FlowPair {
  void noise;
  void action;
  void t;
  throw notYoursYet({
    file: FILE,
    fn: "flowPair",
    milestone: "m4-flow-matching",
    summary: "Builds the (x_t, velocity) pairs a flow-matching policy is trained on.",
  });
}

/**
 * Sample by integrating the learned velocity field from t = 0 to t = 1 with forward Euler.
 *
 * Maths:   Δ = 1 / N,   x_{k+1} = x_k + Δ · v(x_k, k Δ)    for k = 0 … N − 1
 *
 * Signature: eulerSample(velocity: (x: number[], t: number) => number[], x0: number[], steps: number) => number[][]
 *   Returns the whole path: steps + 1 points, x0 first and the sample last.
 *   The page draws every path, so you will see the noise cloud flow into actions.
 *
 * On paper first:
 *  - For v(x, t) = −x, solve the ODE exactly and write Euler's answer after N steps.
 *    How fast does the gap close as N grows?
 *  - If v were exactly the target from flowPair (no network error), how many Euler steps
 *    would you need, and why?
 */
export function eulerSample(velocity: (x: number[], t: number) => number[], x0: number[], steps: number): number[][] {
  void velocity;
  void x0;
  void steps;
  throw notYoursYet({
    file: FILE,
    fn: "eulerSample",
    milestone: "m4-flow-matching",
    summary: "Integrates the velocity field: noise in, an action out.",
  });
}

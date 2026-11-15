import { notYoursYet } from "@/kit/not-yours-yet";

const FILE = "src/projects/flowfield/core/loss.ts";

/**
 * The conditional flow-matching loss on a batch.
 *
 * The training loop draws x₁ from the data, x₀ ~ N(0, I) and t ~ U[0, 1], builds x_t and the target
 * u_t with your milestone-1 functions, and asks the network for pred = v_θ(x_t, t). Then:
 *
 *   Maths:   L = (1 / B) Σ_b ‖pred_b − target_b‖²       (sum over the d coordinates, mean over the batch)
 *
 * Signature: cfmLoss(pred: number[][], target: number[][]) => number
 *   pred and target are both B × d.
 *
 * On paper first (this is the key fact of flow matching):
 *  - Fix x and t. Over all pairs (x₀, x₁) whose line passes through x at time t, the network can only
 *    output one vector v. Which v minimises E‖v − u_t(x | x₁)‖²? (Differentiate with respect to v.)
 *  - Connect that to milestone 2: what does this loss's minimiser equal, as a function of (x, t)?
 *  - Even a perfect network does not reach L = 0 here. Why not? What is left over?
 */
export function cfmLoss(pred: number[][], target: number[][]): number {
  void pred;
  void target;
  throw notYoursYet({
    file: FILE,
    fn: "cfmLoss",
    milestone: "m4-train",
    summary: "Mean squared error between predicted and target velocities.",
  });
}

/**
 * Gradient of cfmLoss with respect to every entry of pred. The MLP plumbing backpropagates this into
 * the weights, and Adam takes the step.
 *
 *   Maths:   ∂L / ∂pred_{b,i}
 *
 * Signature: cfmLossGrad(pred: number[][], target: number[][]) => number[][]   (B × d, same shape as pred)
 *
 * On paper first:
 *  - Differentiate one term ‖pred_b − target_b‖² by pred_{b,i}. Where does the 1/B go?
 *  - If you doubled the batch size, would the gradient's size change?
 */
export function cfmLossGrad(pred: number[][], target: number[][]): number[][] {
  void pred;
  void target;
  throw notYoursYet({
    file: FILE,
    fn: "cfmLossGrad",
    milestone: "m4-train",
    summary: "dL/dpred, which the network backpropagates into its weights.",
  });
}

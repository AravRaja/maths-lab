import { notYoursYet } from "@/kit/not-yours-yet";

const FILE = "src/projects/flowfield/core/marginal.ts";

/**
 * The exact marginal velocity field for a finite dataset: the field a perfect network would learn.
 *
 * The data is N points x₁⁽ⁱ⁾ (your drawing), each equally likely. For each one, milestone 1 gives a
 * family of straight lines, and at time t they fill a Gaussian p_t(x | x₁⁽ⁱ⁾). Mix them and you get the
 * marginal density p_t(x) = (1/N) Σᵢ p_t(x | x₁⁽ⁱ⁾). The marginal field is the velocity that moves
 * p_t exactly like the mixture of lines does:
 *
 *   Maths:   u_t(x) = Σᵢ wᵢ(x, t) · u_t(x | x₁⁽ⁱ⁾),     wᵢ(x, t) = p_t(x | x₁⁽ⁱ⁾) / Σⱼ p_t(x | x₁⁽ʲ⁾)
 *
 *   where u_t(x | x₁) is the velocity of the line through x at time t that ends at x₁: it is
 *   milestone 1's velocity, but written as a function of the *position* x, not of x₀.
 *
 * Signature: marginalVelocity(x: number[], t: number, data: number[][], sigmaMin: number) => number[]   (length d)
 *   0 ≤ t < 1. data is N × d. Must stay finite even when x is far from every data point.
 *
 * On paper first:
 *  - From milestone 1, write p_t(x | x₁) as a Gaussian: mean and σ_t.
 *  - Given x and x₁, solve the path equation for x₀, then substitute into milestone 1's velocity to get
 *    u_t(x | x₁) as a function of x. Check it at x = the mean of p_t(x | x₁): which way does it point?
 *  - The weights wᵢ are a softmax. Of what? Which terms of the Gaussian cancel between top and bottom?
 *    How do you compute a softmax of very negative numbers without getting 0/0?
 *  - What does u_t(x) look like at t = 0 (one sentence)? And just before t = 1, near one data point?
 */
export function marginalVelocity(x: number[], t: number, data: number[][], sigmaMin: number): number[] {
  void x;
  void t;
  void data;
  void sigmaMin;
  throw notYoursYet({
    file: FILE,
    fn: "marginalVelocity",
    milestone: "m2-marginal-field",
    summary: "The closed-form velocity field that carries noise onto a finite dataset.",
  });
}

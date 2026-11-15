import { notYoursYet } from "@/kit/not-yours-yet";

const FILE = "src/projects/say-and-reach/core/policy-head.ts";

export interface GaussianNll {
  /** −log N(a; μ, diag σ²), summed over the action dimensions. */
  loss: number;
  /** ∂loss/∂μ, same length as μ. */
  dMu: number[];
  /** ∂loss/∂(log σ), same length as μ. */
  dLogStd: number[];
}

/**
 * Behaviour-cloning loss for a diagonal Gaussian policy head, with its gradient.
 *
 * The network reads (scene, words) and outputs a mean μ and a log standard deviation
 * s = log σ for each action dimension. Behaviour cloning maximises the likelihood of the
 * expert's action a, i.e. minimises the negative log-likelihood:
 *
 * Maths:   L(μ, s; a) = Σ_k [ (a_k − μ_k)² / (2 e^{2 s_k}) + s_k + ½ log 2π ]
 *
 * Signature: gaussianNll(mu: number[], logStd: number[], action: number[]) => { loss, dMu, dLogStd }
 *   All three inputs have the same length d (here d = 2: fingertip velocity x, y).
 *   The training loop averages these over a batch and backpropagates dMu and dLogStd.
 *
 * On paper first:
 *  - Start from the Gaussian pdf and take −log. Where does each term come from?
 *  - Differentiate with respect to μ_k and to s_k (not σ_k). Why learn log σ rather than σ?
 *  - For fixed μ, which σ minimises the loss? What does that tell you σ will learn to be?
 *  - The expert goes round obstacles both ways. What happens to μ if half the demos go left
 *    and half go right?
 */
export function gaussianNll(mu: number[], logStd: number[], action: number[]): GaussianNll {
  void mu;
  void logStd;
  void action;
  throw notYoursYet({
    file: FILE,
    fn: "gaussianNll",
    milestone: "m3-behaviour-cloning",
    summary: "The behaviour-cloning loss and its gradient. Trains the text-conditioned policy.",
  });
}

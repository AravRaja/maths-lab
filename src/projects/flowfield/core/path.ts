import { notYoursYet } from "@/kit/not-yours-yet";

const FILE = "src/projects/flowfield/core/path.ts";

/**
 * The conditional optimal-transport path (Lipman et al., 2023, "Flow Matching for Generative Modeling").
 *
 * Pick one noise sample x₀ ~ N(0, I) and one data point x₁. Join them with a straight line that
 * ends not exactly on x₁ but in a tiny Gaussian of width σ_min around it:
 *
 *   Maths:   x_t = (1 − (1 − σ_min) t) · x₀ + t · x₁,      t ∈ [0, 1]
 *
 * Signature: conditionalPath(x0: number[], x1: number[], t: number, sigmaMin: number) => number[]
 *   x0 and x1 have the same length d (2 for shapes, 16 for robot action chunks). Return a new
 *   array of length d. Do not mutate the inputs.
 *
 * On paper first:
 *  - Evaluate x_t at t = 0 and t = 1. Where does it start, where does it end?
 *  - Treat x₀ as random, N(0, I), and x₁ as fixed. What distribution does x_t have? Write its mean
 *    and its standard deviation σ_t as functions of t. (You will need σ_t again in milestone 2.)
 *  - Why bother with σ_min > 0 at all? What goes wrong at t = 1 if σ_min = 0 and you later divide by σ_t?
 */
export function conditionalPath(x0: number[], x1: number[], t: number, sigmaMin: number): number[] {
  void x0;
  void x1;
  void t;
  void sigmaMin;
  throw notYoursYet({
    file: FILE,
    fn: "conditionalPath",
    milestone: "m1-straight-lines",
    summary: "The point x_t on the straight line from one noise sample to one data point.",
  });
}

/**
 * The velocity of that path, d x_t / dt: the regression target of conditional flow matching.
 *
 *   Maths:   u_t(x_t | x₁) = d/dt [ (1 − (1 − σ_min) t) x₀ + t x₁ ]
 *
 * Signature: conditionalVelocity(x0: number[], x1: number[], sigmaMin: number) => number[]   (length d)
 *   Note there is no t argument. Your derivative should tell you why.
 *
 * On paper first:
 *  - Differentiate. Does the answer depend on t? What does that say about the speed a particle moves
 *    along its line?
 *  - The network will never see x₀ and x₁, only x_t and t. Many different (x₀, x₁) pairs pass through
 *    the same x_t at the same t. What single vector should the network predict there, then? (This is
 *    why the loss works at all; keep it in mind for milestone 4.)
 */
export function conditionalVelocity(x0: number[], x1: number[], sigmaMin: number): number[] {
  void x0;
  void x1;
  void sigmaMin;
  throw notYoursYet({
    file: FILE,
    fn: "conditionalVelocity",
    milestone: "m1-straight-lines",
    summary: "The target velocity u_t = dx_t/dt along one noise-to-data line.",
  });
}

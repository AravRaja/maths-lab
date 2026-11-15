import { notYoursYet } from "@/kit/not-yours-yet";

const FILE = "src/projects/say-and-reach/core/kinematics.ts";

/** A point on the table, in metres. x is right, y is away from the arm's base. */
export type Vec2 = [number, number];

/**
 * Forward kinematics of a planar serial arm.
 *
 * The base sits at the origin. Joint i turns by θ_i relative to the previous link
 * (θ_1 is measured from the +x axis). Link i has length ℓ_i.
 *
 * Maths:   φ_i = θ_1 + … + θ_i                                   (absolute angle of link i)
 *          p_0 = (0, 0),   p_i = p_{i-1} + ℓ_i (cos φ_i, sin φ_i)
 *
 * Signature: forwardKinematics(theta: number[], lengths: number[]) => Vec2[]
 *   theta and lengths have the same length n ≥ 1.
 *   Returns n + 1 points: the base p_0, every joint, and the fingertip p_n last.
 *
 * On paper first:
 *  - Draw a 2-link arm with θ = (π/2, −π/2). Where is the fingertip?
 *  - What is the set of all fingertips you can reach with ℓ = (0.55, 0.45, 0.3)? Its outer radius? Inner?
 *  - Why does adding the same angle c to θ_1 rotate the whole arm about the base?
 */
export function forwardKinematics(theta: number[], lengths: number[]): Vec2[] {
  void theta;
  void lengths;
  throw notYoursYet({
    file: FILE,
    fn: "forwardKinematics",
    milestone: "m1-forward-kinematics",
    summary: "Joint angles in, joint positions out: where the arm actually is.",
  });
}

/**
 * Jacobian of the fingertip position with respect to the joint angles.
 *
 * Maths:   J ∈ ℝ^{2×n},   J_{r,i} = ∂(p_n)_r / ∂θ_i
 *          so a small joint change δθ moves the fingertip by δp ≈ J δθ.
 *
 * Signature: jacobian(theta: number[], lengths: number[]) => number[][]
 *   Returns 2 rows (x then y), each of length n.
 *
 * On paper first:
 *  - Which links move when θ_i changes? Write ∂p_n/∂θ_i as a sum over those links.
 *  - Picture the fingertip as a point rotating about joint i (at p_{i−1}) with unit angular
 *    speed. Which vector is its velocity? Check your sum gives the same column.
 *  - When is J rank-deficient (the arm is "singular")? Try a fully stretched arm.
 */
export function jacobian(theta: number[], lengths: number[]): number[][] {
  void theta;
  void lengths;
  throw notYoursYet({
    file: FILE,
    fn: "jacobian",
    milestone: "m2-jacobian-ik",
    summary: "How the fingertip moves when each joint twitches. Drives reaching, the expert and every policy.",
  });
}

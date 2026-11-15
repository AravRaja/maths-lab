import type { Mat, Vec } from "../lib/linalg";

export type { Mat, Vec };

/**
 * One revolute joint. Going out along the arm, joint i sits at `offset` (metres) in the frame of
 * joint i-1, and turns about `axis` (a unit vector in its own frame) by its angle q_i (radians).
 */
export interface Joint {
  offset: Vec;
  axis: Vec;
  /** Joint limits in radians, [lo, hi]. Plumbing uses them; the cores can ignore them. */
  limits: [number, number];
  name: string;
}

/** A serial arm: joints from the base out, then a fixed tool offset in the last joint's frame. */
export interface ArmSpec {
  joints: Joint[];
  tool: Vec;
}

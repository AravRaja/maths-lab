import { notYoursYet } from "@/kit/not-yours-yet";
import type { ArmSpec, Mat } from "./types";

const FILE = "src/projects/jacobian/core/kinematics.ts";

/**
 * Forward kinematics of a serial arm of revolute joints.
 *
 * The arm (see lib/arm.ts for the six-joint one on the page):
 *   joint i sits at `arm.joints[i].offset` in the frame of joint i−1 (the base frame for i = 0),
 *   then turns by q[i] about `arm.joints[i].axis`, given in its own frame.
 *   The tool point sits at `arm.tool` in the last joint's frame.
 *
 * Maths:   T_i = T_{i−1} · Trans(offset_i) · Rot(axis_i, q_i),    T_{−1} = I (the base)
 *          T_tool = T_{n−1} · Trans(tool)
 *
 * Signature: forwardKinematics(q: number[n], arm: ArmSpec) => number[4][4][]   (length n + 1)
 *   Return the world transform of every joint frame, in order, then the tool frame last.
 *   Frame i's translation is where joint i is; its rotation already includes q_i.
 *
 * On paper first:
 *  - Draw a two-joint planar arm and compose the transforms by hand. Does Trans·Rot or Rot·Trans
 *    put the joint in the right place? What changes if you swap them?
 *  - Why multiply on the right? (Each new transform is described in the frame of the previous joint.)
 *  - All q = 0 for the arm on the page: the axes are z, y, y, y, z, x and every offset points up z.
 *    Where is the tool? Now set only the shoulder (joint 1, axis y) to +π/2. Which way does the arm point?
 *
 * Use `rodrigues` from ./se3 for Rot(axis, q).
 */
export function forwardKinematics(q: number[], arm: ArmSpec): Mat[] {
  void q;
  void arm;
  throw notYoursYet({
    file: FILE,
    fn: "forwardKinematics",
    milestone: "m2-forward-kinematics",
    summary: "Six joint angles in, the pose of every link out. This is what puts the arm on screen.",
  });
}

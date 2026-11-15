import { describe, expect, it } from "vitest";
import { forwardKinematics } from "../kinematics";
import type { ArmSpec } from "../types";
import { ARM } from "../../lib/arm";
import { Rz, eye, norm, posOf, rotOf, sub } from "../../lib/linalg";
import { expectMatClose, expectRotation, expectVecClose, rng } from "./helpers";

/*
 * Forward kinematics: closed-form poses of the page's arm, a planar two-link arm you can
 * do by hand, and invariants (rigid links, proper rotations, joint i doesn't move itself).
 */

const u = rng(11);
const randomQ = () => ARM.joints.map((j) => j.limits[0] + u() * (j.limits[1] - j.limits[0]));
const heights = ARM.joints.map((j) => j.offset[2]);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const SHOULDER = heights[0] + heights[1];
const LENGTH = sum(heights.slice(2)) + ARM.tool[2];

describe("forwardKinematics", () => {
  it("returns one 4×4 rigid transform per joint, then the tool", () => {
    const F = forwardKinematics(randomQ(), ARM);
    expect(F).toHaveLength(ARM.joints.length + 1);
    for (const T of F) {
      expect(T).toHaveLength(4);
      T.forEach((row) => expect(row).toHaveLength(4));
      expectVecClose(T[3], [0, 0, 0, 1], 1e-15, "bottom row");
      expectRotation(rotOf(T), 1e-9);
    }
  });

  it("stands straight up at q = 0", () => {
    const F = forwardKinematics([0, 0, 0, 0, 0, 0], ARM);
    let h = 0;
    F.forEach((T, i) => {
      h += i < heights.length ? heights[i] : ARM.tool[2];
      expectVecClose(posOf(T), [0, 0, h], 1e-12, `frame ${i}`);
      expectMatClose(rotOf(T), eye(3), 1e-12, `frame ${i} rotation`);
    });
  });

  it("lays the arm along +x when only the shoulder turns +π/2", () => {
    const F = forwardKinematics([0, Math.PI / 2, 0, 0, 0, 0], ARM);
    expectVecClose(posOf(F[1]), [0, 0, SHOULDER], 1e-12, "shoulder stays put");
    expectVecClose(posOf(F[F.length - 1]), [LENGTH, 0, SHOULDER], 1e-12, "tool");
  });

  it("sweeps that pose round a circle with the base yaw", () => {
    for (const a of [-2, -0.5, 0.9, 2.8]) {
      const F = forwardKinematics([a, Math.PI / 2, 0, 0, 0, 0], ARM);
      expectVecClose(posOf(F[F.length - 1]), [LENGTH * Math.cos(a), LENGTH * Math.sin(a), SHOULDER], 1e-12, `yaw ${a}`);
    }
  });

  it("turns the tool frame itself by the base yaw when the arm is upright", () => {
    const F = forwardKinematics([0.8, 0, 0, 0, 0, 0], ARM);
    expectMatClose(rotOf(F[F.length - 1]), Rz(0.8), 1e-12);
  });

  it("keeps every link rigid", () => {
    for (let s = 0; s < 10; s++) {
      const F = forwardKinematics(randomQ(), ARM);
      for (let i = 1; i < F.length; i++) {
        const want = i < ARM.joints.length ? norm(ARM.joints[i].offset) : norm(ARM.tool);
        expect(norm(sub(posOf(F[i]), posOf(F[i - 1])))).toBeCloseTo(want, 12);
      }
    }
  });

  it("puts joint i where it is regardless of q_i and later angles (Trans then Rot)", () => {
    const q = randomQ();
    const F = forwardKinematics(q, ARM);
    for (let i = 0; i < ARM.joints.length; i++) {
      const q2 = q.slice();
      for (let j = i; j < q2.length; j++) q2[j] += 0.7;
      expectVecClose(posOf(forwardKinematics(q2, ARM)[i]), posOf(F[i]), 1e-12, `joint ${i}`);
    }
  });

  it("matches the textbook planar two-link arm", () => {
    const planar: ArmSpec = {
      joints: [
        { name: "a", offset: [0, 0, 0], axis: [0, 0, 1], limits: [-4, 4] },
        { name: "b", offset: [1, 0, 0], axis: [0, 0, 1], limits: [-4, 4] },
      ],
      tool: [0.5, 0, 0],
    };
    for (let s = 0; s < 10; s++) {
      const q1 = (u() * 2 - 1) * 3;
      const q2 = (u() * 2 - 1) * 3;
      const F = forwardKinematics([q1, q2], planar);
      expectVecClose(posOf(F[1]), [Math.cos(q1), Math.sin(q1), 0], 1e-12, "elbow");
      expectVecClose(posOf(F[2]), [Math.cos(q1) + 0.5 * Math.cos(q1 + q2), Math.sin(q1) + 0.5 * Math.sin(q1 + q2), 0], 1e-12, "tip");
    }
  });

  it("handles joints about the x axis too", () => {
    const arm: ArmSpec = { joints: [{ name: "r", offset: [0, 0, 0], axis: [1, 0, 0], limits: [-4, 4] }], tool: [0, 1, 0] };
    expectVecClose(posOf(forwardKinematics([Math.PI / 2], arm)[1]), [0, 0, 1], 1e-12, "y rotated +90° about x is z");
  });
});

import type { ArmSpec } from "../core/types";

/*
 * The six-joint arm on the page. z is up, metres, radians.
 * Base yaw, shoulder pitch, elbow pitch, wrist pitch, wrist yaw, wrist roll.
 * At q = 0 it stands straight up: fully stretched, a singular pose.
 */
export const ARM: ArmSpec = {
  joints: [
    { name: "base", offset: [0, 0, 0.12], axis: [0, 0, 1], limits: [-Math.PI, Math.PI] },
    { name: "shoulder", offset: [0, 0, 0.26], axis: [0, 1, 0], limits: [-2.2, 2.2] },
    { name: "elbow", offset: [0, 0, 0.44], axis: [0, 1, 0], limits: [-2.6, 2.6] },
    { name: "wrist pitch", offset: [0, 0, 0.38], axis: [0, 1, 0], limits: [-2.4, 2.4] },
    { name: "wrist yaw", offset: [0, 0, 0.1], axis: [0, 0, 1], limits: [-Math.PI, Math.PI] },
    { name: "wrist roll", offset: [0, 0, 0.08], axis: [1, 0, 0], limits: [-2.4, 2.4] },
  ],
  tool: [0, 0, 0.12],
};

export const N_JOINTS = ARM.joints.length;

/** A comfortable bent pose to start from. */
export const HOME = [0.5, 0.55, 1.05, 0.75, 0, 0];

/** Total reach from the shoulder, used to scale views. */
export const REACH = ARM.joints.slice(2).reduce((s, j) => s + j.offset[2], 0) + ARM.tool[2];
export const SHOULDER_HEIGHT = ARM.joints[0].offset[2] + ARM.joints[1].offset[2];

export function clampToLimits(q: number[]): number[] {
  return q.map((v, i) => {
    const [lo, hi] = ARM.joints[i].limits;
    return Math.max(lo, Math.min(hi, v));
  });
}

/** Wrap an angle to (−π, π]. */
export const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** A smooth scripted joint-space dance (used before IK exists). */
export function dance(t: number): number[] {
  return [
    0.9 * Math.sin(t * 0.31),
    0.55 + 0.45 * Math.sin(t * 0.53 + 1),
    1.0 + 0.6 * Math.sin(t * 0.41 + 2),
    0.7 + 0.6 * Math.sin(t * 0.67),
    1.2 * Math.sin(t * 0.23 + 0.5),
    0.8 * Math.sin(t * 0.59 + 1.7),
  ];
}

/**
 * Ghost poses: joint positions (base, 6 joints, tool) for three hand-picked poses, as plain numbers.
 * Drawn while forwardKinematics is still a stub so the hero is never empty. Not used once FK exists.
 */
export const GHOST_POSES: number[][][] = [[[0,0,0], [0,0,0.12], [0,0,0.38], [0.202,0.11,0.755], [0.535,0.292,0.744], [0.598,0.326,0.674], [0.648,0.354,0.618], [0.722,0.395,0.533]], [[0,0,0], [0,0,0.12], [0,0,0.38], [0.067,-0.056,0.811], [0.357,-0.301,0.8], [0.403,-0.34,0.72], [0.44,-0.37,0.656], [0.462,-0.43,0.554]], [[0,0,0], [0,0,0.12], [0,0,0.38], [0.092,0.332,0.654], [0.192,0.693,0.718], [0.217,0.781,0.676], [0.236,0.851,0.643], [0.243,0.956,0.586]]];

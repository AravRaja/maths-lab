/** Shared constants for the flowfield project. */

/** σ_min of the conditional OT path: the width of each data point's Gaussian at t = 1. */
export const SIGMA_MIN = 0.02;

/** The 2D world is the square [-WORLD, WORLD]². Noise N(0, I) mostly lives inside it. */
export const WORLD = 2.2;

/** Points per 2D shape. */
export const SHAPE_POINTS = 320;

/** Label used for "no context" in classifier-free guidance. */
export const NULL_LABEL = -1;

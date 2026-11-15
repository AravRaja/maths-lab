import { zeros, type Mat, type Vec } from "./linalg";

/*
 * Target-tracking plumbing: the constant-velocity model matrices and a flying target.
 * State layout: [positions (dim), velocities (dim)].
 */

/**
 * Constant velocity with white-noise acceleration of spectral density q (per axis).
 * F = [[I, dt I], [0, I]],  Q = q [[dt³/3 I, dt²/2 I], [dt²/2 I, dt I]],  H = [I, 0].
 */
export function constantVelocity(dim: number, dt: number, q: number): { F: Mat; Q: Mat; H: Mat } {
  const n = 2 * dim;
  const F = zeros(n, n);
  const Q = zeros(n, n);
  const H = zeros(dim, n);
  for (let i = 0; i < dim; i++) {
    F[i][i] = 1;
    F[i][i + dim] = dt;
    F[i + dim][i + dim] = 1;
    Q[i][i] = (q * dt ** 3) / 3;
    Q[i][i + dim] = Q[i + dim][i] = (q * dt ** 2) / 2;
    Q[i + dim][i + dim] = q * dt;
    H[i][i] = 1;
  }
  return { F, Q, H };
}

/**
 * A firefly: smooth wandering in front of the arm, with an occasional dart. Deterministic in t.
 * Returns a world position (z up) inside the arm's reach.
 */
export function firefly(t: number, seed = 0): Vec {
  const s = seed * 1.7;
  const dart = Math.sin(t * 0.21 + s) > 0.93 ? 1 : 0;
  const a = t * (0.35 + 0.25 * dart);
  return [
    0.62 + 0.22 * Math.sin(a * 1.3 + s) + 0.06 * Math.sin(a * 4.1),
    0.42 * Math.sin(a * 0.9 + 1.1 + s) + 0.05 * Math.cos(a * 3.3),
    0.55 + 0.25 * Math.sin(a * 1.7 + 0.4) + 0.05 * Math.sin(a * 5.2 + s),
  ];
}

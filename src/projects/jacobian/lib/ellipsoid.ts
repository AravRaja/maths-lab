import { matMul, symEig, transpose, type Mat, type Vec } from "./linalg";

/**
 * The velocity (manipulability) ellipsoid { Jv q̇ : ‖q̇‖ ≤ 1 }: principal semi-axes are the
 * eigenvectors of Jv Jvᵀ scaled by the singular values. Plumbing on top of the user's Jacobian.
 */
export function velocityEllipsoid(Jv: Mat, scale = 1): { axes: Vec[]; sigma: number[] } {
  const { values, vectors } = symEig(matMul(Jv, transpose(Jv)));
  const sigma = values.map((l) => Math.sqrt(Math.max(0, l)));
  const axes = [0, 1, 2].map((k) => [vectors[0][k], vectors[1][k], vectors[2][k]].map((x) => x * sigma[k] * scale));
  return { axes, sigma };
}

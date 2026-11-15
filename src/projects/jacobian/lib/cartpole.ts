import { expm, type Mat, type Vec } from "./linalg";

/*
 * Cart-pole physics (plumbing). State x = [cart position, cart velocity, pole angle, pole angular velocity],
 * angle 0 = upright, positive = leaning towards +x. Input u = horizontal force on the cart (N).
 * Standard equations (Barto, Sutton & Anderson 1983; Florian 2007), pole as a uniform rod.
 */

export interface CartPoleParams {
  cartMass: number;
  poleMass: number;
  /** Half the pole length (to its centre of mass), m. */
  halfLength: number;
  gravity: number;
  /** Actuator saturation, N. */
  maxForce: number;
  /** Rail half-length, m (only the drawing and the "fell off" check use it). */
  rail: number;
}

export const CARTPOLE: CartPoleParams = { cartMass: 1.0, poleMass: 0.25, halfLength: 0.5, gravity: 9.81, maxForce: 25, rail: 2.4 };

/** Continuous-time dynamics ẋ = f(x, u). */
export function cartPoleDeriv(p: CartPoleParams, x: Vec, u: number): Vec {
  const [, v, th, w] = x;
  const s = Math.sin(th);
  const c = Math.cos(th);
  const total = p.cartMass + p.poleMass;
  const pml = p.poleMass * p.halfLength;
  const temp = (u + pml * w * w * s) / total;
  const thAcc = (p.gravity * s - c * temp) / (p.halfLength * (4 / 3 - (p.poleMass * c * c) / total));
  const xAcc = temp - (pml * thAcc * c) / total;
  return [v, xAcc, w, thAcc];
}

/** One RK4 step with the force held constant (zero-order hold). */
export function cartPoleStep(p: CartPoleParams, x: Vec, u: number, dt: number): Vec {
  const k1 = cartPoleDeriv(p, x, u);
  const k2 = cartPoleDeriv(p, x.map((v, i) => v + (dt / 2) * k1[i]), u);
  const k3 = cartPoleDeriv(p, x.map((v, i) => v + (dt / 2) * k2[i]), u);
  const k4 = cartPoleDeriv(p, x.map((v, i) => v + dt * k3[i]), u);
  return x.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

/** Linearise about upright (central differences) and discretise exactly with a zero-order hold. */
export function cartPoleLinear(p: CartPoleParams, dt: number): { A: Mat; B: Mat; Ac: Mat; Bc: Mat } {
  const h = 1e-6;
  const x0 = [0, 0, 0, 0];
  const Ac: Mat = [0, 1, 2, 3].map(() => [0, 0, 0, 0]);
  for (let j = 0; j < 4; j++) {
    const xp = x0.slice();
    const xm = x0.slice();
    xp[j] += h;
    xm[j] -= h;
    const fp = cartPoleDeriv(p, xp, 0);
    const fm = cartPoleDeriv(p, xm, 0);
    for (let i = 0; i < 4; i++) Ac[i][j] = (fp[i] - fm[i]) / (2 * h);
  }
  const fp = cartPoleDeriv(p, x0, h);
  const fm = cartPoleDeriv(p, x0, -h);
  const Bc: Mat = [0, 1, 2, 3].map((i) => [(fp[i] - fm[i]) / (2 * h)]);
  // exp([[Ac, Bc], [0, 0]] dt) = [[A, B], [0, I]]
  const M: Mat = Array.from({ length: 5 }, (_, i) => Array.from({ length: 5 }, (_, j) => (i < 4 ? (j < 4 ? Ac[i][j] : Bc[i][0]) * dt : 0)));
  const E = expm(M);
  return { A: E.slice(0, 4).map((r) => r.slice(0, 4)), B: E.slice(0, 4).map((r) => [r[4]]), Ac, Bc };
}

export const clampForce = (p: CartPoleParams, u: number) => Math.max(-p.maxForce, Math.min(p.maxForce, u));

/** Wrap the pole angle into (−π, π] so a full swing-over counts as upright again. */
export const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

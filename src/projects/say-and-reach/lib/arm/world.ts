import { forwardKinematics, jacobian, type Vec2 } from "@/projects/say-and-reach/core/kinematics";
import { dlsStep } from "@/projects/say-and-reach/core/ik";
import { DT, HOME, IK_LAMBDA, LINKS, OBJ_R, TABLE, TIP_R, VMAX } from "./config";
import { EMBED_DIM, OBJECTS, type ObjectKind } from "./language";
import { gauss, type Rng } from "./rng";

/*
 * A tiny kinematic tabletop. The arm is position-controlled through the user's IK:
 * a policy outputs a fingertip velocity, dlsStep turns it into joint motion, and
 * forwardKinematics says where the fingertip really went. Objects are discs that get
 * pushed out of the fingertip (and out of each other). No mass, no friction: enough
 * physics to push things around, simple enough to run thousands of steps a second.
 */

export interface Obj {
  kind: ObjectKind;
  x: number;
  y: number;
  /** Visual only: objects spin a little when pushed off-centre. */
  angle: number;
}

export interface Scene {
  theta: number[];
  objects: Obj[];
  tip: Vec2;
  t: number;
}

export function tipOf(theta: number[]): Vec2 {
  const p = forwardKinematics(theta, LINKS);
  return p[p.length - 1];
}

/** Objects only (no arm), so the table can be drawn before forwardKinematics exists. */
export function randomObjects(rng: Rng): Obj[] {
  const objects: Obj[] = [];
  for (const kind of OBJECTS) {
    for (let tries = 0; tries < 200; tries++) {
      const x = -0.62 + 1.24 * rng();
      const y = 0.5 + 0.48 * rng();
      if (objects.every((o) => Math.hypot(o.x - x, o.y - y) > 0.26)) {
        objects.push({ kind, x, y, angle: (rng() - 0.5) * 0.6 });
        break;
      }
    }
  }
  return objects;
}

export function randomScene(rng: Rng): Scene {
  const objects = randomObjects(rng);
  const theta = HOME.map((v) => v + 0.15 * gauss(rng));
  return { theta, objects, tip: tipOf(theta), t: 0 };
}

export function cloneScene(s: Scene): Scene {
  return { theta: s.theta.slice(), objects: s.objects.map((o) => ({ ...o })), tip: [s.tip[0], s.tip[1]], t: s.t };
}

export function objectOf(s: Scene, kind: ObjectKind): Obj {
  return s.objects.find((o) => o.kind === kind)!;
}

/** Move the fingertip toward `target` with a couple of damped-least-squares iterations. */
export function reachToward(theta: number[], target: Vec2, iters = 2, lambda = IK_LAMBDA): number[] {
  let th = theta;
  for (let k = 0; k < iters; k++) {
    const tip = tipOf(th);
    const e = [target[0] - tip[0], target[1] - tip[1]];
    const d = dlsStep(jacobian(th, LINKS), e, lambda);
    th = th.map((v, i) => v + Math.max(-0.35, Math.min(0.35, d[i])));
  }
  return th;
}

function clampObj(o: Obj) {
  o.x = Math.max(TABLE.x0 + OBJ_R, Math.min(TABLE.x1 - OBJ_R, o.x));
  o.y = Math.max(TABLE.y0 + OBJ_R, Math.min(TABLE.y1 - OBJ_R, o.y));
}

/** Apply a unit-scaled fingertip velocity for one step. Mutates and returns the scene. */
export function step(s: Scene, action: ArrayLike<number>): Scene {
  let ax = action[0], ay = action[1];
  const n = Math.hypot(ax, ay);
  if (n > 1) { ax /= n; ay /= n; }
  const target: Vec2 = [s.tip[0] + ax * VMAX * DT, s.tip[1] + ay * VMAX * DT];
  // Sub-step so fast pushes don't tunnel through objects.
  const sub = 3;
  for (let k = 1; k <= sub; k++) {
    const goal: Vec2 = [s.tip[0] + (target[0] - s.tip[0]) * (1 / (sub - k + 1)), s.tip[1] + (target[1] - s.tip[1]) * (1 / (sub - k + 1))];
    s.theta = reachToward(s.theta, goal, 1);
    s.tip = tipOf(s.theta);
    resolveContacts(s);
  }
  s.t += 1;
  return s;
}

export function resolveContacts(s: Scene) {
  const [tx, ty] = s.tip;
  const rr = OBJ_R + TIP_R;
  for (const o of s.objects) {
    const dx = o.x - tx, dy = o.y - ty;
    const d = Math.hypot(dx, dy);
    if (d < rr && d > 1e-9) {
      const push = rr - d;
      o.x += (dx / d) * push;
      o.y += (dy / d) * push;
      o.angle += 0.6 * push * Math.sign(dx * 0.3 - dy * 0.7 + 1e-6) * 4;
      clampObj(o);
    }
  }
  for (let it = 0; it < 2; it++)
    for (let i = 0; i < s.objects.length; i++)
      for (let j = i + 1; j < s.objects.length; j++) {
        const a = s.objects[i], b = s.objects[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d < 2 * OBJ_R && d > 1e-9) {
          const p = (2 * OBJ_R - d) / 2;
          a.x -= (dx / d) * p; a.y -= (dy / d) * p;
          b.x += (dx / d) * p; b.y += (dy / d) * p;
          clampObj(a); clampObj(b);
        }
      }
}

/** Observation the policies see: fingertip, then each object absolute and relative to the fingertip. */
export const STATE_DIM = 2 + OBJECTS.length * 4;
export const OBS_DIM = STATE_DIM + EMBED_DIM;

export function observe(s: Scene, text: Float32Array, out = new Float32Array(OBS_DIM)): Float32Array {
  out[0] = s.tip[0];
  out[1] = s.tip[1] - 0.7;
  let k = 2;
  for (const kind of OBJECTS) {
    const o = objectOf(s, kind);
    out[k++] = o.x;
    out[k++] = o.y - 0.7;
    out[k++] = (o.x - s.tip[0]) * 2;
    out[k++] = (o.y - s.tip[1]) * 2;
  }
  out.set(text, STATE_DIM);
  return out;
}

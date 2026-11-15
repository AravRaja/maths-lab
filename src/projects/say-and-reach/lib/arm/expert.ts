import { OBJ_R, TIP_R } from "./config";
import { DIR_VEC, type Task } from "./language";
import { objectOf, type Scene } from "./world";

/*
 * Scripted expert: the demonstrator the policies imitate. It knows the task (from the
 * keyword parser) and walks round the object to get behind it before pushing. `side` says
 * which way round. With one-way demos it is always +1. With two-way demos it is a coin flip per
 * episode, so the demonstrations become genuinely two-moded: exactly what a Gaussian head
 * averages and a flow head can keep apart.
 */

const RR = OBJ_R + TIP_R;

export function expertAction(s: Scene, task: Task, side: 1 | -1): [number, number] {
  const o = objectOf(s, task.object);
  const [px, py] = s.tip;
  const rx = px - o.x, ry = py - o.y;
  const dist = Math.hypot(rx, ry);

  if (task.kind === "touch") {
    const gap = dist - (RR + 0.004);
    const g = Math.min(1, Math.max(0, gap) * 5);
    return dist > 1e-6 ? [(-rx / dist) * g, (-ry / dist) * g] : [0, 0];
  }

  const [dx, dy] = DIR_VEC[task.dir];
  const along = rx * dx + ry * dy; // < 0 means the fingertip is behind the object
  const lx = rx - along * dx, ly = ry - along * dy; // lateral offset from the push line
  const lat = Math.hypot(lx, ly);

  if (along < -0.6 * RR && lat < 0.03) {
    // Lined up: push through, steering back onto the line.
    return clip(dx * 0.75 - lx * 8, dy * 0.75 - ly * 8);
  }

  const qx = o.x - dx * (RR + 0.06), qy = o.y - dy * (RR + 0.06);
  let vx = qx - px, vy = qy - py;
  const dq = Math.hypot(vx, vy);
  const gain = Math.min(1, dq * 6) / Math.max(dq, 1e-6);
  vx *= gain; vy *= gain;

  // Walk round the object (on the expert's chosen side) when it is in the way.
  if (dist < RR + 0.09 && along > -RR) {
    const nx = rx / dist, ny = ry / dist;
    const tx = -ny * side, ty = nx * side;
    const out = Math.max(0, RR + 0.06 - dist) * 12;
    return clip(tx * 0.9 + nx * out + vx * 0.25, ty * 0.9 + ny * out + vy * 0.25);
  }
  return clip(vx, vy);
}

function clip(x: number, y: number): [number, number] {
  const n = Math.hypot(x, y);
  return n > 1 ? [x / n, y / n] : [x, y];
}

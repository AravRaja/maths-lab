import { OBJ_R, PUSH_DIST, TABLE, TIP_R } from "./config";
import { DIR_VEC, type Task } from "./language";
import { objectOf, type Scene } from "./world";

/*
 * What "did it" means, and the potential used for shaping. The maths of shaping (turning
 * rewards and potentials into shaped rewards and returns) is the user's, in src/projects/say-and-reach/core/reward.ts.
 */

export function goalOf(start: Scene, task: Task): [number, number] {
  const o = objectOf(start, task.object);
  if (task.kind === "touch") return [o.x, o.y];
  const [dx, dy] = DIR_VEC[task.dir];
  return [
    Math.max(TABLE.x0 + OBJ_R, Math.min(TABLE.x1 - OBJ_R, o.x + dx * PUSH_DIST)),
    Math.max(TABLE.y0 + OBJ_R, Math.min(TABLE.y1 - OBJ_R, o.y + dy * PUSH_DIST)),
  ];
}

export function succeeded(start: Scene, s: Scene, task: Task): boolean {
  const o = objectOf(s, task.object);
  if (task.kind === "touch") return Math.hypot(o.x - s.tip[0], o.y - s.tip[1]) < OBJ_R + TIP_R + 0.02;
  const o0 = objectOf(start, task.object);
  const [dx, dy] = DIR_VEC[task.dir];
  const moved = (o.x - o0.x) * dx + (o.y - o0.y) * dy;
  const sideways = Math.abs((o.x - o0.x) * dy - (o.y - o0.y) * dx);
  // Most of the push distance (or as far as the table edge allows), without wandering off-line.
  const g = goalOf(start, task);
  const want = Math.min(0.6 * PUSH_DIST, 0.8 * Math.hypot(g[0] - o0.x, g[1] - o0.y));
  return moved >= want && sideways < 0.12;
}

/** Φ(s): minus the distance the job still has to go (object to goal, plus fingertip to object). */
export function potential(start: Scene, s: Scene, task: Task): number {
  const o = objectOf(s, task.object);
  const tipGap = Math.max(0, Math.hypot(o.x - s.tip[0], o.y - s.tip[1]) - (OBJ_R + TIP_R));
  if (task.kind === "touch") return -tipGap;
  const g = goalOf(start, task);
  return -(Math.hypot(o.x - g[0], o.y - g[1]) * 2 + tipGap * 0.5);
}

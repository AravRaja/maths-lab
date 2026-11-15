import { forwardKinematics } from "@/projects/say-and-reach/core/kinematics";
import { LINKS } from "@/projects/say-and-reach/lib/arm/config";
import { grey } from "@/kit/canvas";
import { isNotYoursYet } from "@/kit/not-yours-yet";
import type { Obj } from "@/projects/say-and-reach/lib/arm/world";
import { drawAction, drawArm, drawFlow, drawGoal, drawObjects, drawTable, GHOST_JOINTS, toPx, type DitherBuf, type View } from "./draw";
import type { SimRunner } from "./sim-runner";

/** Joint positions from the user's FK, or null while it's a stub. */
export function jointsOrNull(theta: number[]): [number, number][] | null {
  try {
    return forwardKinematics(theta, LINKS) as [number, number][];
  } catch (e) {
    if (isNotYoursYet(e)) return null;
    throw e;
  }
}

/** Draw a whole frame of the tabletop from a runner (or bare objects when there is no arm yet). */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  v: View,
  buf: DitherBuf,
  t: number,
  r: SimRunner | null,
  extra: { objects?: Obj[]; theta?: number[] | null; showAction?: boolean; flowUpto?: number } = {},
) {
  ctx.fillStyle = grey(0);
  ctx.fillRect(0, 0, v.width, v.height);
  const goal = r?.task && (r.running || r.steps > 0) ? r.goal : null;
  drawTable(ctx, v, buf, t, { goal, glow: r?.success ? 1.4 : 1 });
  if (goal) drawGoal(ctx, v, goal, r?.from, t);

  // Fingertip trail.
  if (r && r.trail.length > 1) {
    ctx.strokeStyle = grey(1, 0.35);
    ctx.lineWidth = 1;
    ctx.setLineDash([1, 3]);
    ctx.beginPath();
    r.trail.forEach(([x, y], i) => {
      const [px, py] = toPx(v, x, y);
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const objects = r?.scene.objects ?? extra.objects ?? [];
  drawObjects(ctx, v, objects, r?.info?.attention, t);

  const theta = extra.theta !== undefined ? extra.theta : r?.scene.theta ?? null;
  const joints = theta ? jointsOrNull(theta) : null;
  if (joints) drawArm(ctx, v, joints);
  else drawArm(ctx, v, GHOST_JOINTS, { ghost: true });

  if (r?.info && extra.showAction !== false && joints) {
    const tip = joints[joints.length - 1];
    if (r.info.paths) drawFlow(ctx, v, tip, r.info.paths, 0.28, extra.flowUpto ?? 1);
    else drawAction(ctx, v, tip, r.info.action, r.info.std);
  }
}

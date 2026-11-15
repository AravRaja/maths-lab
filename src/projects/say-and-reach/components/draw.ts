import { grey } from "@/kit/canvas";
import { ditherField, fbm } from "@/kit/dither";
import { OBJ_R, REACH, TABLE, TIP_R, VIEW } from "@/projects/say-and-reach/lib/arm/config";
import type { Obj } from "@/projects/say-and-reach/lib/arm/world";

/*
 * Monochrome drawing for the tabletop. World units are metres; `View` maps them into the
 * canvas (CSS px), keeping the aspect ratio and centring.
 */

export interface View {
  s: number;
  ox: number;
  oy: number;
  width: number;
  height: number;
}

export function makeView(width: number, height: number, pad = 0): View {
  const ww = VIEW.x1 - VIEW.x0, wh = VIEW.y1 - VIEW.y0;
  const s = Math.min((width - 2 * pad) / ww, (height - 2 * pad) / wh);
  const ox = (width - s * ww) / 2 - s * VIEW.x0;
  const oy = (height + s * wh) / 2 + s * VIEW.y0;
  return { s, ox, oy, width, height };
}

export const toPx = (v: View, x: number, y: number): [number, number] => [v.ox + v.s * x, v.oy - v.s * y];
export const toWorld = (v: View, px: number, py: number): [number, number] => [(px - v.ox) / v.s, (v.oy - py) / v.s];

/** A reusable low-res buffer for dithered backgrounds. */
export interface DitherBuf {
  w: number;
  h: number;
  f: Float32Array;
  img: ImageData;
  off: OffscreenCanvas;
}

export function ditherBuf(prev: DitherBuf | null, width: number, height: number, pixel: number): DitherBuf {
  const w = Math.max(8, Math.floor(width / pixel)), h = Math.max(8, Math.floor(height / pixel));
  if (prev && prev.w === w && prev.h === h) return prev;
  return { w, h, f: new Float32Array(w * h), img: new ImageData(w, h), off: new OffscreenCanvas(w, h) };
}

/**
 * The table: a slow dithered noise field, brighter inside the arm's reach, with an optional
 * glow around the goal (the potential Φ made visible).
 */
export function drawTable(
  ctx: CanvasRenderingContext2D,
  v: View,
  buf: DitherBuf,
  t: number,
  opts: { goal?: [number, number] | null; glow?: number; pixel?: number } = {},
) {
  const pixel = opts.pixel ?? 3;
  const { w, h, f } = buf;
  const tt = t * 0.05;
  const g = opts.goal;
  const glow = opts.glow ?? 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [wx, wy] = toWorld(v, (x + 0.5) * pixel, (y + 0.5) * pixel);
      const r = Math.hypot(wx, wy);
      const n = fbm(wx * 2.4 + tt, wy * 2.4 - tt * 0.7, 17);
      let val = 0.04 + 0.16 * n * n;
      // Reach annulus: a faint lit disc.
      if (r < REACH) val += 0.05 + 0.05 * (1 - r / REACH);
      // Table edge.
      const inside = wx > TABLE.x0 && wx < TABLE.x1 && wy > TABLE.y0 && wy < TABLE.y1;
      if (!inside) val *= 0.55;
      if (g) {
        const d = Math.hypot(wx - g[0], wy - g[1]);
        val += glow * (0.5 * Math.exp(-d * d * 40) + 0.12 * Math.max(0, Math.cos(d * 40 - t * 3)) * Math.exp(-d * 5));
      }
      f[y * w + x] = val;
    }
  }
  ditherField(f, w, h, buf.img.data, [0, 0.13, 0.32, 0.6]);
  buf.off.getContext("2d")!.putImageData(buf.img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buf.off, 0, 0, w * pixel, h * pixel);
  // Table outline.
  const [x0, y1] = toPx(v, TABLE.x0, TABLE.y1);
  const [x1, y0] = toPx(v, TABLE.x1, TABLE.y0);
  ctx.strokeStyle = grey(1, 0.18);
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 5]);
  roundRect(ctx, x0, y1, x1 - x0, y0 - y1, 10);
  ctx.stroke();
  ctx.setLineDash([]);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Objects: cube (filled square), ball (ring), wedge (outlined triangle). `focus` 0..1 glows. */
export function drawObjects(ctx: CanvasRenderingContext2D, v: View, objects: Obj[], focus?: number[], t = 0) {
  objects.forEach((o, i) => {
    const [cx, cy] = toPx(v, o.x, o.y);
    const r = OBJ_R * v.s;
    const a = focus?.[i] ?? 0;
    if (a > 0.05) {
      // Attention halo: concentric dashed rings, more as attention grows.
      ctx.strokeStyle = grey(1, 0.25 + 0.5 * a);
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.lineDashOffset = -t * 12;
      for (let k = 1; k <= 1 + Math.round(a * 2); k++) {
        ctx.beginPath();
        ctx.arc(cx, cy, r * (1.35 + 0.35 * k), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
    }
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-o.angle);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = grey(1);
    ctx.fillStyle = grey(1);
    if (o.kind === "cube") {
      const h = r * 0.86;
      ctx.beginPath();
      ctx.roundRect(-h, -h, 2 * h, 2 * h, 3);
      ctx.fill();
    } else if (o.kind === "ball") {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const ang = -Math.PI / 2 + (k * 2 * Math.PI) / 3;
        const px = Math.cos(ang) * r, py = Math.sin(ang) * r;
        if (k) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.fillStyle = grey(0);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  });
}

/** The arm from its joint positions (world). */
export function drawArm(ctx: CanvasRenderingContext2D, v: View, joints: [number, number][], opts: { ghost?: boolean } = {}) {
  const pts = joints.map(([x, y]) => toPx(v, x, y));
  const ghost = opts.ghost;
  // Base plate.
  const [bx, by] = pts[0];
  ctx.fillStyle = grey(ghost ? 0.3 : 0.9, ghost ? 0.4 : 1);
  ctx.beginPath();
  ctx.roundRect(bx - 0.13 * v.s, by - 0.02 * v.s, 0.26 * v.s, 0.12 * v.s, 4);
  ctx.fill();
  // Links: thick dark core with a bright rim (reads well on dithered ground).
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const widths = [0.075, 0.06, 0.045];
  for (let i = 0; i < pts.length - 1; i++) {
    const wpx = (widths[i] ?? 0.04) * v.s;
    ctx.strokeStyle = ghost ? grey(0.5, 0.5) : grey(1);
    ctx.lineWidth = wpx + 3;
    if (ghost) ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(...pts[i]);
    ctx.lineTo(...pts[i + 1]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (!ghost) {
      ctx.strokeStyle = grey(0.04);
      ctx.lineWidth = wpx - 1;
      ctx.beginPath();
      ctx.moveTo(...pts[i]);
      ctx.lineTo(...pts[i + 1]);
      ctx.stroke();
    }
  }
  // Joints.
  for (let i = 0; i < pts.length - 1; i++) {
    ctx.fillStyle = ghost ? grey(0.2) : grey(1);
    ctx.beginPath();
    ctx.arc(pts[i][0], pts[i][1], (ghost ? 3 : 4.5), 0, Math.PI * 2);
    ctx.fill();
    if (!ghost) {
      ctx.fillStyle = grey(0);
      ctx.beginPath();
      ctx.arc(pts[i][0], pts[i][1], 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Fingertip.
  const [tx, ty] = pts[pts.length - 1];
  ctx.strokeStyle = ghost ? grey(0.5, 0.6) : grey(1);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(tx, ty, TIP_R * v.s, 0, Math.PI * 2);
  ctx.stroke();
  if (!ghost) {
    ctx.fillStyle = grey(1);
    ctx.beginPath();
    ctx.arc(tx, ty, TIP_R * v.s * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A plausible fixed pose, drawn dashed, for when forwardKinematics isn't written yet. */
export const GHOST_JOINTS: [number, number][] = [
  [0, 0],
  [-0.229, 0.5],
  [0.06, 0.845],
  [0.33, 0.715],
];

/** Goal marker: a crosshair with an arrow from the object's start. */
export function drawGoal(ctx: CanvasRenderingContext2D, v: View, goal: [number, number], from?: [number, number] | null, t = 0) {
  const [gx, gy] = toPx(v, goal[0], goal[1]);
  ctx.strokeStyle = grey(1, 0.9);
  ctx.lineWidth = 1.5;
  const r = OBJ_R * v.s * 1.05;
  ctx.setLineDash([3, 4]);
  ctx.lineDashOffset = -t * 10;
  ctx.beginPath();
  ctx.arc(gx, gy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    ctx.beginPath();
    ctx.moveTo(gx + dx * r * 1.25, gy + dy * r * 1.25);
    ctx.lineTo(gx + dx * r * 1.7, gy + dy * r * 1.7);
    ctx.stroke();
  }
  if (from) {
    const [fx, fy] = toPx(v, from[0], from[1]);
    const len = Math.hypot(gx - fx, gy - fy);
    if (len > r * 1.5) {
      const ux = (gx - fx) / len, uy = (gy - fy) / len;
      ctx.strokeStyle = grey(1, 0.5);
      ctx.setLineDash([1.5, 4]);
      ctx.beginPath();
      ctx.moveTo(fx + ux * r * 1.3, fy + uy * r * 1.3);
      ctx.lineTo(gx - ux * r * 1.3, gy - uy * r * 1.3);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

/**
 * Flow particles at the fingertip: each Euler path, scaled from action units into the table
 * (an action of length 1 is drawn `scale` metres long). Early points are faint, the sample is bright.
 */
export function drawFlow(ctx: CanvasRenderingContext2D, v: View, tip: [number, number], paths: number[][][], scale = 0.28, upto = 1) {
  const [tx, ty] = toPx(v, tip[0], tip[1]);
  const k = scale * v.s;
  for (const p of paths) {
    const n = Math.max(1, Math.round((p.length - 1) * upto));
    for (let i = 0; i < n; i++) {
      ctx.strokeStyle = grey(1, 0.08 + (0.5 * (i + 1)) / p.length);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tx + p[i][0] * k, ty - p[i][1] * k);
      ctx.lineTo(tx + p[i + 1][0] * k, ty - p[i + 1][1] * k);
      ctx.stroke();
    }
    const e = p[n];
    ctx.fillStyle = grey(1);
    ctx.fillRect(tx + e[0] * k - 1.5, ty - e[1] * k - 1.5, 3, 3);
  }
}

/** Velocity arrow and, for the Gaussian head, its 1σ ellipse. */
export function drawAction(ctx: CanvasRenderingContext2D, v: View, tip: [number, number], a: [number, number], std?: [number, number], scale = 0.28) {
  const [tx, ty] = toPx(v, tip[0], tip[1]);
  const k = scale * v.s;
  const ex = tx + a[0] * k, ey = ty - a[1] * k;
  if (std) {
    ctx.strokeStyle = grey(1, 0.55);
    ctx.setLineDash([2, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(ex, ey, Math.max(1, std[0] * k), Math.max(1, std[1] * k), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const len = Math.hypot(ex - tx, ey - ty);
  if (len < 3) return;
  ctx.strokeStyle = grey(1);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  const ux = (ex - tx) / len, uy = (ey - ty) / len;
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - ux * 7 - uy * 4, ey - uy * 7 + ux * 4);
  ctx.lineTo(ex - ux * 7 + uy * 4, ey - uy * 7 - ux * 4);
  ctx.closePath();
  ctx.fillStyle = grey(1);
  ctx.fill();
}

/** Manipulability ellipse of J Jᵀ at the fingertip: how easily the tip moves in each direction. */
export function drawManipulability(ctx: CanvasRenderingContext2D, v: View, tip: [number, number], J: number[][], scale = 0.22) {
  let a = 0, b = 0, d = 0;
  for (let i = 0; i < J[0].length; i++) {
    a += J[0][i] ** 2;
    b += J[0][i] * J[1][i];
    d += J[1][i] ** 2;
  }
  const tr = a + d, det = a * d - b * b;
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const l1 = tr / 2 + disc, l2 = Math.max(0, tr / 2 - disc);
  const ang = Math.atan2(l1 - a, b || 1e-9);
  const [tx, ty] = toPx(v, tip[0], tip[1]);
  ctx.strokeStyle = grey(1, 0.7);
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.ellipse(tx, ty, Math.sqrt(l1) * scale * v.s, Math.max(1, Math.sqrt(l2) * scale * v.s), -ang, 0, Math.PI * 2);
  ctx.stroke();
  return { l1, l2 };
}

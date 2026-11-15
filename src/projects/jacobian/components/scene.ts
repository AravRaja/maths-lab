import { grey } from "@/kit/canvas";
import { ditherField } from "@/kit/dither";
import { add, cross, dot, normalize, scale, sub, type Mat, type Vec } from "../lib/linalg";

/*
 * A tiny software 3D renderer on Canvas 2D (no WebGL, no three.js): a perspective camera, a
 * low-resolution "glow" layer that is Bayer-dithered every frame for the 1-bit look, and crisp
 * vector strokes on top. z is up. Everything here is plumbing.
 */

export interface Camera {
  yaw: number;
  pitch: number;
  dist: number;
  target: Vec;
  /** Vertical field of view, radians. */
  fov: number;
}

export interface Projected {
  x: number;
  y: number;
  /** Camera-space depth (m). */
  z: number;
  /** Pixels per metre at this depth. */
  s: number;
}

export class View {
  readonly eye: Vec;
  readonly fwd: Vec;
  readonly right: Vec;
  readonly up: Vec;
  readonly f: number;
  constructor(
    readonly cam: Camera,
    readonly width: number,
    readonly height: number,
  ) {
    const cp = Math.cos(cam.pitch);
    this.eye = add(cam.target, scale([cp * Math.cos(cam.yaw), cp * Math.sin(cam.yaw), Math.sin(cam.pitch)], cam.dist));
    this.fwd = normalize(sub(cam.target, this.eye));
    this.right = normalize(cross(this.fwd, [0, 0, 1]));
    this.up = cross(this.right, this.fwd);
    // Fit the vertical FOV, but widen on tall (phone) canvases so the arm still fits sideways.
    const aspect = width / height;
    const fy = height / 2 / Math.tan(cam.fov / 2);
    this.f = aspect < 1.2 ? Math.min(fy, (width / 2 / Math.tan(cam.fov / 2)) * 1.15) : fy;
  }

  project(p: Vec): Projected {
    const d = sub(p, this.eye);
    const z = Math.max(1e-3, dot(d, this.fwd));
    const s = this.f / z;
    return { x: this.width / 2 + dot(d, this.right) * s, y: this.height / 2 - dot(d, this.up) * s, z, s };
  }

  /** World ray direction through a canvas pixel. */
  ray(px: number, py: number): Vec {
    return normalize(add(this.fwd, add(scale(this.right, (px - this.width / 2) / this.f), scale(this.up, -(py - this.height / 2) / this.f))));
  }

  /** Where the pixel's ray meets the plane through c with normal n (null if parallel or behind). */
  pick(px: number, py: number, c: Vec, n: Vec): Vec | null {
    const r = this.ray(px, py);
    const den = dot(r, n);
    if (Math.abs(den) < 1e-6) return null;
    const t = dot(sub(c, this.eye), n) / den;
    return t > 0 ? add(this.eye, scale(r, t)) : null;
  }

  /** Normal of the vertical plane that faces the camera. */
  facingNormal(): Vec {
    return normalize([this.fwd[0], this.fwd[1], 0]);
  }
}

// ---- the dithered glow layer ----------------------------------------------------------------

/** A low-res offscreen layer, drawn in CSS px, quantised to a few greys with Bayer dithering. */
export class GlowLayer {
  private canvas: OffscreenCanvas | null = null;
  ctx: OffscreenCanvasRenderingContext2D | null = null;
  private field = new Float32Array(1);
  private img: ImageData | null = null;
  private w = 0;
  private h = 0;

  constructor(public pixel = 3) {}

  begin(width: number, height: number): OffscreenCanvasRenderingContext2D {
    const w = Math.max(8, Math.floor(width / this.pixel));
    const h = Math.max(8, Math.floor(height / this.pixel));
    if (!this.canvas || w !== this.w || h !== this.h) {
      this.canvas = new OffscreenCanvas(w, h);
      this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
      this.field = new Float32Array(w * h);
      this.img = new ImageData(w, h);
      this.w = w;
      this.h = h;
    }
    const ctx = this.ctx!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    ctx.setTransform(1 / this.pixel, 0, 0, 1 / this.pixel, 0, 0);
    return ctx;
  }

  /** Dither the layer and draw it, pixelated, onto `out` (which is in CSS px). */
  end(out: CanvasRenderingContext2D, tones: number[]) {
    if (!this.ctx || !this.img || !this.canvas) return;
    const src = this.ctx.getImageData(0, 0, this.w, this.h).data;
    for (let i = 0; i < this.field.length; i++) this.field[i] = src[i * 4] / 255;
    const d = this.img.data;
    ditherField(this.field, this.w, this.h, d, tones);
    // Black is transparent, so crisp layers drawn underneath (the floor) show through.
    for (let i = 3; i < d.length; i += 4) if (d[i - 3] === 0) d[i] = 0;
    this.ctx.putImageData(this.img, 0, 0);
    out.save();
    out.imageSmoothingEnabled = false;
    out.drawImage(this.canvas, 0, 0, this.w * this.pixel, this.h * this.pixel);
    out.restore();
  }
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

// ---- primitives -----------------------------------------------------------------------------

export function line(ctx: Ctx, v: View, a: Vec, b: Vec) {
  const p = v.project(a);
  const q = v.project(b);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(q.x, q.y);
  ctx.stroke();
}

export function polyline(ctx: Ctx, v: View, pts: Vec[], close = false) {
  if (pts.length < 2) return;
  ctx.beginPath();
  pts.forEach((pt, i) => {
    const p = v.project(pt);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  if (close) ctx.closePath();
}

/** Dot-grid floor at z = 0 and a dashed circle at the arm's reach. */
export function drawFloor(ctx: Ctx, v: View, { extent = 1.3, step = 0.1, reach }: { extent?: number; step?: number; reach?: number } = {}) {
  for (let x = -extent; x <= extent + 1e-9; x += step) {
    for (let y = -extent; y <= extent + 1e-9; y += step) {
      const r = Math.hypot(x, y);
      if (r > extent) continue;
      const p = v.project([x, y, 0]);
      const major = Math.abs(Math.round(x * 10) % 5) === 0 && Math.abs(Math.round(y * 10) % 5) === 0;
      ctx.fillStyle = grey(1, (major ? 0.85 : 0.4) * (1 - r / extent) ** 0.6);
      const s = Math.max(0.8, Math.min(2.2, p.s * (major ? 0.006 : 0.004)));
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
  }
  if (reach) {
    const ring: Vec[] = [];
    for (let i = 0; i <= 96; i++) ring.push([reach * Math.cos((i / 96) * Math.PI * 2), reach * Math.sin((i / 96) * Math.PI * 2), 0]);
    ctx.save();
    ctx.setLineDash([2, 6]);
    ctx.strokeStyle = grey(0.55, 0.6);
    ctx.lineWidth = 1;
    polyline(ctx, v, ring);
    ctx.stroke();
    ctx.restore();
  }
}

const LINK_RADIUS = [0.075, 0.06, 0.05, 0.042, 0.034, 0.03, 0.022, 0.016];

/** The arm's soft body in the glow layer: thick links, joint balls, and a floor shadow. */
export function drawArmGlow(ctx: Ctx, v: View, pts: Vec[], { level = 0.85, shadow = true }: { level?: number; shadow?: boolean } = {}) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (shadow) {
    ctx.strokeStyle = grey(0.18);
    for (let i = 1; i < pts.length; i++) {
      const a = [pts[i - 1][0], pts[i - 1][1], 0];
      const b = [pts[i][0], pts[i][1], 0];
      const p = v.project(a);
      ctx.lineWidth = Math.max(2, LINK_RADIUS[i - 1] * 2.2 * p.s);
      line(ctx, v, a, b);
    }
  }
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const pa = v.project(a);
    const pb = v.project(b);
    const r = LINK_RADIUS[i - 1] ?? 0.015;
    // Fake shading: lighter for higher links and nearer the camera.
    const shade = level * (0.55 + 0.45 * Math.min(1, (a[2] + b[2]) / 1.6));
    const g = ctx.createLinearGradient(pa.x, pa.y, pb.x, pb.y);
    g.addColorStop(0, grey(shade * 0.75));
    g.addColorStop(1, grey(shade));
    ctx.strokeStyle = g;
    ctx.lineWidth = Math.max(2, r * 2 * (pa.s + pb.s) * 0.5);
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }
  for (let i = 1; i < pts.length - 1; i++) {
    const p = v.project(pts[i]);
    const r = (LINK_RADIUS[i - 1] ?? 0.02) * 1.25 * p.s;
    const g = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, r * 0.1, p.x, p.y, r);
    g.addColorStop(0, grey(1));
    g.addColorStop(1, grey(level * 0.5));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(1.5, r), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Crisp outline of the arm: a hairline spine, joint rings, the tool tip. */
export function drawArmCrisp(ctx: Ctx, v: View, pts: Vec[], { alpha = 1, dashed = false, rings = true }: { alpha?: number; dashed?: boolean; rings?: boolean } = {}) {
  ctx.save();
  ctx.lineCap = "round";
  if (dashed) ctx.setLineDash([5, 5]);
  ctx.strokeStyle = grey(1, alpha);
  ctx.lineWidth = 1.25;
  polyline(ctx, v, pts);
  ctx.stroke();
  ctx.setLineDash([]);
  if (rings) {
    for (let i = 1; i < pts.length - 1; i++) {
      const p = v.project(pts[i]);
      const r = Math.max(3, (LINK_RADIUS[i - 1] ?? 0.02) * 0.9 * p.s);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = grey(0, alpha * 0.85);
      ctx.fill();
      ctx.strokeStyle = grey(1, alpha);
      ctx.stroke();
    }
  }
  const tip = v.project(pts[pts.length - 1]);
  ctx.fillStyle = grey(1, alpha);
  ctx.beginPath();
  ctx.arc(tip.x, tip.y, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** RGB-free frame triad: x solid, y dashed, z dotted, each labelled. */
export function drawTriad(ctx: Ctx, v: View, T: Mat, size = 0.12, { alpha = 1, labels = true, width = 1.5 }: { alpha?: number; labels?: boolean; width?: number } = {}) {
  const o = [T[0][3], T[1][3], T[2][3]];
  const dashes = [[], [4, 3], [1.5, 3]];
  const names = ["x", "y", "z"];
  ctx.save();
  ctx.lineCap = "round";
  for (let k = 0; k < 3; k++) {
    const tip = add(o, scale([T[0][k], T[1][k], T[2][k]], size));
    ctx.setLineDash(dashes[k]);
    ctx.strokeStyle = grey(1, alpha);
    ctx.lineWidth = width;
    line(ctx, v, o, tip);
    if (labels) {
      const p = v.project(tip);
      ctx.setLineDash([]);
      ctx.fillStyle = grey(1, alpha * 0.85);
      ctx.font = "10px ui-monospace, monospace";
      ctx.fillText(names[k], p.x + 3, p.y - 3);
    }
  }
  ctx.restore();
}

function hull(points: { x: number; y: number }[]) {
  const pts = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const crossZ = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: typeof pts = [];
  for (const p of pts) {
    while (lower.length >= 2 && crossZ(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: typeof pts = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && crossZ(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/**
 * An ellipsoid centred at c with principal semi-axes a[0..2] (each a 3-vector, already scaled).
 * Glow: a shaded silhouette. Crisp: the three principal rings.
 */
export function drawEllipsoidGlow(ctx: Ctx, v: View, c: Vec, a: Vec[], level = 0.45) {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const th = (i / 9) * Math.PI;
    for (let j = 0; j < 20; j++) {
      const ph = (j / 20) * Math.PI * 2;
      const p = add(c, add(scale(a[0], Math.sin(th) * Math.cos(ph)), add(scale(a[1], Math.sin(th) * Math.sin(ph)), scale(a[2], Math.cos(th)))));
      pts.push(v.project(p));
    }
  }
  const h = hull(pts);
  if (h.length < 3) return;
  const pc = v.project(c);
  let rmax = 1;
  for (const p of h) rmax = Math.max(rmax, Math.hypot(p.x - pc.x, p.y - pc.y));
  const g = ctx.createRadialGradient(pc.x - rmax * 0.25, pc.y - rmax * 0.25, 0, pc.x, pc.y, rmax);
  g.addColorStop(0, grey(level * 1.3));
  g.addColorStop(1, grey(level * 0.35));
  ctx.fillStyle = g;
  ctx.beginPath();
  h.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();
}

export function drawEllipsoidCrisp(ctx: Ctx, v: View, c: Vec, a: Vec[], alpha = 0.9) {
  const pairs: [number, number][] = [
    [0, 1],
    [1, 2],
    [0, 2],
  ];
  ctx.save();
  pairs.forEach(([i, j], k) => {
    const ring: Vec[] = [];
    for (let s = 0; s <= 64; s++) {
      const t = (s / 64) * Math.PI * 2;
      ring.push(add(c, add(scale(a[i], Math.cos(t)), scale(a[j], Math.sin(t)))));
    }
    ctx.setLineDash(k === 0 ? [] : k === 1 ? [4, 4] : [1.5, 3]);
    ctx.strokeStyle = grey(1, alpha * (k === 0 ? 1 : 0.7));
    ctx.lineWidth = k === 0 ? 1.25 : 1;
    polyline(ctx, v, ring);
    ctx.stroke();
  });
  // Principal axes as short ticks.
  ctx.setLineDash([]);
  ctx.strokeStyle = grey(1, alpha * 0.6);
  for (const ax of a) line(ctx, v, sub(c, ax), add(c, ax));
  ctx.restore();
}

/** Crosshair target with a dashed drop line to the floor. */
export function drawTarget(ctx: Ctx, v: View, p: Vec, { label, size = 9, alpha = 1, style = "cross" }: { label?: string; size?: number; alpha?: number; style?: "cross" | "ring" | "dot" } = {}) {
  const q = v.project(p);
  const f = v.project([p[0], p[1], 0]);
  ctx.save();
  ctx.strokeStyle = grey(1, alpha * 0.45);
  ctx.setLineDash([2, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(q.x, q.y);
  ctx.lineTo(f.x, f.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.ellipse(f.x, f.y, 6, 2.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = grey(1, alpha);
  ctx.lineWidth = 1.5;
  if (style === "cross") {
    ctx.beginPath();
    ctx.moveTo(q.x - size, q.y);
    ctx.lineTo(q.x - 3, q.y);
    ctx.moveTo(q.x + 3, q.y);
    ctx.lineTo(q.x + size, q.y);
    ctx.moveTo(q.x, q.y - size);
    ctx.lineTo(q.x, q.y - 3);
    ctx.moveTo(q.x, q.y + 3);
    ctx.lineTo(q.x, q.y + size);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(q.x, q.y, size * 0.75, 0, Math.PI * 2);
    ctx.lineWidth = 1;
    ctx.stroke();
  } else if (style === "ring") {
    ctx.beginPath();
    ctx.arc(q.x, q.y, size, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = grey(1, alpha);
    ctx.beginPath();
    ctx.arc(q.x, q.y, size / 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (label) {
    ctx.fillStyle = grey(1, alpha * 0.8);
    ctx.font = "10px ui-monospace, monospace";
    ctx.fillText(label, q.x + size + 4, q.y - 4);
  }
  ctx.restore();
}

/** Small mono text with a black backing, for in-canvas readouts. */
export function label(ctx: Ctx, text: string, x: number, y: number, { align = "left", alpha = 0.85 }: { align?: CanvasTextAlign; alpha?: number } = {}) {
  ctx.save();
  ctx.font = "10px ui-monospace, monospace";
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  const w = ctx.measureText(text).width;
  const x0 = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
  ctx.fillStyle = grey(0, 0.7);
  ctx.fillRect(x0 - 3, y - 7, w + 6, 14);
  ctx.fillStyle = grey(1, alpha);
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** A soft dithered vignette for the glow layer's background. */
export function glowBackdrop(ctx: Ctx, width: number, height: number, level = 0.16, cx = 0.5, cy = 0.45) {
  const g = ctx.createRadialGradient(width * cx, height * cy, 0, width * cx, height * cy, Math.max(width, height) * 0.75);
  g.addColorStop(0, grey(level));
  g.addColorStop(1, grey(0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
}

/** Static: random grey speckle over the glow layer (used for the "near singular" glitch). */
export function glowStatic(ctx: Ctx, width: number, height: number, amount: number, seed: number) {
  if (amount <= 0.01) return;
  let s = (seed * 9301 + 49297) % 233280;
  const n = Math.floor(amount * 500);
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280;
    const x = (s / 233280) * width;
    s = (s * 9301 + 49297) % 233280;
    const y = (s / 233280) * height;
    s = (s * 9301 + 49297) % 233280;
    const w = 2 + (s / 233280) * 30 * amount;
    ctx.fillStyle = grey(0.2 + 0.6 * (s / 233280) * amount);
    ctx.fillRect(x, y, w, 2);
  }
}

/** Arm joint positions (base point, then every frame's origin) from FK frames. */
export function armPoints(frames: Mat[]): Vec[] {
  return [[0, 0, 0], ...frames.map((T) => [T[0][3], T[1][3], T[2][3]])];
}

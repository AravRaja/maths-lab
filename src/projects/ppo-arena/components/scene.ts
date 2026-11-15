import { grey } from "@/kit/canvas";
import { ditherField, fbm, valueNoise } from "@/kit/dither";
import { ENV, brightness, physics, resetState, terminalReason, type CartState } from "../lib/env";
import { mulberry32, type Rng } from "../lib/rng";

/*
 * Torchbearer's look. The scene is lit only by the flame on top of the pole: a low-res light field
 * (inverse-square falloff, flicker, pebbled ground, the cart's shadow) is Bayer-dithered to five
 * greys, then the cart, rail and torch are drawn crisp on top. A tipping torch dims as it leans,
 * so how well the agent balances is literally how much of the world you can see.
 */

let family: string | null = null;
/** Canvas font string in Archivo (canvas can't read CSS variables, so resolve the family once). */
export function font(weight: number, px: number): string {
  if (family === null && typeof document !== "undefined") family = getComputedStyle(document.body).fontFamily || "system-ui";
  return `${weight} ${px}px ${family ?? "system-ui"}`;
}

export interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

const TONES = [0, 0.13, 0.34, 0.66, 1];
const SPAN = ENV.xLimit + 0.55; // half-width of the visible world (m)

interface Buf {
  w: number;
  h: number;
  field: Float32Array;
  tex: Float32Array;
  img: ImageData;
  off: OffscreenCanvas;
}

/** Per-viewport scratch buffers, cached by size. */
export class LightBuffer {
  private cache = new Map<string, Buf>();
  get(w: number, h: number, seed = 0): Buf {
    const k = `${w}x${h}:${seed}`;
    let b = this.cache.get(k);
    if (!b) {
      const tex = new Float32Array(w * h);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) tex[y * w + x] = fbm(x * 0.21, y * 0.42, 31 + seed);
      b = { w, h, field: new Float32Array(w * h), tex, img: new ImageData(w, h), off: new OffscreenCanvas(w, h) };
      if (this.cache.size > 24) this.cache.clear();
      this.cache.set(k, b);
    }
    return b;
  }
}

export function layout(v: View) {
  const scale = v.w / (2 * SPAN);
  const groundY = v.y + v.h * 0.74;
  const toX = (x: number) => v.x + v.w / 2 + x * scale;
  return { scale, groundY, toX };
}

export interface SceneOpts {
  t: number;
  /** 0 = lit normally, 1 = fully dark (after a fall). */
  dark?: number;
  /** Dither pixel size in CSS px. */
  pixel?: number;
  seed?: number;
  /** Ghost carts drawn faint behind (e.g. other envs, earlier policies). */
  echoes?: CartState[];
  /** Draw the action arrow: −1 left, +1 right, with strength 0..1 (a probability). */
  push?: { dir: number; p: number } | null;
  /** Show the ±2.4 m rail ends. */
  posts?: boolean;
}

/** Where the flame sits in CSS px. */
export function flamePos(v: View, s: CartState) {
  const { scale, groundY, toX } = layout(v);
  const cartY = groundY - scale * 0.16;
  const L = scale * 2 * ENV.halfLength;
  return { fx: toX(s.x) + Math.sin(s.theta) * L, fy: cartY - Math.cos(s.theta) * L, cartY, scale, groundY, toX };
}

export function drawScene(ctx: CanvasRenderingContext2D, v: View, s: CartState, buf: LightBuffer, o: SceneOpts) {
  const pixel = o.pixel ?? 3;
  const w = Math.max(8, Math.floor(v.w / pixel));
  const h = Math.max(8, Math.floor(v.h / pixel));
  const b = buf.get(w, h, o.seed ?? 0);
  const { fx, fy, cartY, scale, groundY, toX } = flamePos(v, s);
  const flick = 0.86 + 0.14 * valueNoise(o.t * 9 + (o.seed ?? 0) * 3.1, 0.5, 7);
  const lit = brightness(s) ** 0.7 * (1 - (o.dark ?? 0)) * flick;
  const r2 = (scale * 1.25) ** 2 * (0.55 + 0.45 * lit);
  const gy = (groundY - v.y) / pixel;
  const cx = (toX(s.x) - v.x) / pixel;
  const halfCart = (scale * 0.34) / pixel;

  for (let y = 0; y < h; y++) {
    const py = v.y + (y + 0.5) * pixel;
    const ground = y >= gy;
    for (let x = 0; x < w; x++) {
      const px = v.x + (x + 0.5) * pixel;
      const dx = px - fx, dy = py - fy;
      let L = lit / (1 + (dx * dx + dy * dy) / r2);
      const i = y * w + x;
      if (ground) {
        // Pebbled ground, lit from above, with the cart's shadow straight under it.
        const depth = (y - gy) / (h - gy + 1);
        L *= 0.55 + 0.9 * b.tex[i] - 0.25 * depth;
        const sx = (x - cx) / (halfCart * (1.1 + depth * 2.2));
        if (Math.abs(sx) < 1 && y - gy < 4 + depth * 10) L *= 0.25 + 0.75 * sx * sx;
      } else {
        L *= 0.62;
        // A few stars where the light doesn't reach.
        if (b.tex[i] > 0.79 && ((x * 7 + y * 13) % 17 === 0)) L = Math.max(L, 0.18);
      }
      b.field[i] = L;
    }
  }
  ditherField(b.field, w, h, b.img.data, TONES);
  b.off.getContext("2d")!.putImageData(b.img, 0, 0);
  ctx.save();
  ctx.beginPath();
  ctx.rect(v.x, v.y, v.w, v.h);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(b.off, v.x, v.y, w * pixel, h * pixel);

  // Rail.
  ctx.strokeStyle = grey(0.4);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(toX(-ENV.xLimit), groundY + 0.5);
  ctx.lineTo(toX(ENV.xLimit), groundY + 0.5);
  ctx.stroke();
  if (o.posts !== false) {
    for (const e of [-ENV.xLimit, ENV.xLimit]) {
      ctx.fillStyle = grey(0.5);
      ctx.fillRect(toX(e) - 1, groundY - scale * 0.22, 2, scale * 0.22);
    }
  }

  for (const e of o.echoes ?? []) drawCart(ctx, v, e, 0.16, o.t, 0);
  drawCart(ctx, v, s, 1, o.t, lit);

  if (o.push) {
    const ax = toX(s.x) + o.push.dir * scale * 0.5;
    const ay = cartY + scale * 0.02;
    ctx.strokeStyle = grey(1, 0.25 + 0.75 * o.push.p);
    ctx.lineWidth = 1.5 + 2 * o.push.p;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax + o.push.dir * scale * 0.28 * (0.4 + o.push.p), ay);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCart(ctx: CanvasRenderingContext2D, v: View, s: CartState, alpha: number, t: number, lit: number) {
  const { fx, fy, cartY, scale, toX } = flamePos(v, s);
  const cx = toX(s.x);
  const cw = scale * 0.62, ch = scale * 0.2;
  ctx.fillStyle = grey(0.92, alpha);
  ctx.beginPath();
  ctx.roundRect(cx - cw / 2, cartY - ch / 2, cw, ch, Math.min(6, ch / 2));
  ctx.fill();
  ctx.fillStyle = grey(0, alpha);
  for (const k of [-0.3, 0.3]) {
    ctx.beginPath();
    ctx.arc(cx + k * cw, cartY + ch / 2, Math.max(1.5, ch * 0.28), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = grey(1, alpha);
  ctx.lineWidth = Math.max(1.5, scale * 0.035);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, cartY - ch / 2);
  ctx.lineTo(fx, fy);
  ctx.stroke();
  if (alpha < 1 || lit <= 0.02) return;
  // The flame: a flickering teardrop that shrinks as the torch tips.
  const fs = scale * (0.07 + 0.08 * lit) * (0.9 + 0.2 * valueNoise(t * 14, 1.3, 3));
  const lean = -s.omega * 0.15 + 0.12 * (valueNoise(t * 5, 2.7, 5) - 0.5);
  ctx.save();
  ctx.translate(fx, fy);
  ctx.rotate(lean);
  ctx.fillStyle = grey(1);
  ctx.beginPath();
  ctx.moveTo(0, -fs * 2.3);
  ctx.bezierCurveTo(fs * 1.1, -fs * 0.9, fs, fs * 0.6, 0, fs * 0.8);
  ctx.bezierCurveTo(-fs, fs * 0.6, -fs * 1.1, -fs * 0.9, 0, -fs * 2.3);
  ctx.fill();
  ctx.fillStyle = grey(0.1);
  ctx.beginPath();
  ctx.ellipse(0, fs * 0.15, fs * 0.32, fs * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A controller. `force` (N) overrides the action's ±10 N, so a human can also coast. */
export type Decide = (s: CartState) => { action: number; probs?: number[]; force?: number };

/**
 * Plays episodes in real time (50 Hz physics, fixed step) with any controller. On a fall it
 * freezes, fades to dark, then resets: the dark beat is part of the show.
 */
export class TorchRunner {
  s: CartState;
  steps = 0;
  /** Seconds since the episode ended, or −1 while running. */
  fallT = -1;
  lastAction = 1;
  lastProbs: number[] | null = null;
  history: number[] = [];
  /** Episodes finished so far. */
  episodes = 0;
  reason: "fell" | "rail" | "time" | null = null;
  private acc = 0;
  private shove = 0;
  readonly rng: Rng;

  constructor(seed: number) {
    this.rng = mulberry32(seed);
    this.s = resetState(this.rng);
  }

  reset() {
    this.s = resetState(this.rng);
    this.steps = 0;
    this.fallT = -1;
    this.reason = null;
  }

  /** A short sideways shove (N), applied over the next few ticks. */
  push(force: number) {
    this.shove = force;
  }

  get dark() {
    return this.fallT < 0 ? 0 : Math.min(1, this.fallT / 0.5);
  }

  update(dt: number, decide: Decide, speed = 1) {
    if (this.fallT >= 0) {
      // Let it keep tipping, uncontrolled, while the light dies.
      this.fallT += dt;
      const n = Math.round(Math.min(dt, 0.1) / ENV.tau);
      for (let k = 0; k < n && Math.abs(this.s.theta) < 1.45; k++) this.s = physics(this.s, 0);
      this.s = { ...this.s, v: this.s.v * 0.9 };
      if (this.fallT > 1.1) this.reset();
      return;
    }
    this.acc += Math.min(dt, 0.1) * speed;
    while (this.acc >= ENV.tau) {
      this.acc -= ENV.tau;
      const d = decide(this.s);
      this.lastAction = d.action;
      this.lastProbs = d.probs ?? null;
      const f = (d.force ?? (d.action === 1 ? ENV.forceMag : -ENV.forceMag)) + this.shove;
      this.shove *= 0.7;
      this.s = physics(this.s, f);
      this.steps++;
      const r = terminalReason(this.s, this.steps);
      if (r) {
        this.reason = r;
        this.episodes++;
        this.history.push(this.steps);
        if (this.history.length > 40) this.history.shift();
        if (r === "time") this.reset();
        else {
          this.fallT = 0;
          this.acc = 0;
        }
        return;
      }
    }
  }
}

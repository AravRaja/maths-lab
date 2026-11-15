import { BAYER8, grey, valueNoise } from "@/kit";

/*
 * Canvas helpers for Daydream's screens: frames are tiny (20×20), so they're upsampled and
 * Bayer-dithered to a few greys, which gives every view the same 1-bit "old monitor" look.
 */

const bufs = new Map<string, { img: ImageData; off: OffscreenCanvas }>();
function buf(w: number, h: number) {
  const k = `${w}x${h}`;
  let b = bufs.get(k);
  if (!b) {
    b = { img: new ImageData(w, h), off: new OffscreenCanvas(w, h) };
    bufs.set(k, b);
  }
  return b;
}

export const TONES = [0, 0.18, 0.55, 1];

/** Bilinear sample of a side×side field at continuous (u, v) in [0, 1]. */
function sample(f: ArrayLike<number>, side: number, u: number, v: number): number {
  const x = Math.max(0, Math.min(side - 1, u * side - 0.5));
  const y = Math.max(0, Math.min(side - 1, v * side - 0.5));
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(side - 1, x0 + 1), y1 = Math.min(side - 1, y0 + 1);
  const fx = x - x0, fy = y - y0;
  const a = f[y0 * side + x0], b = f[y0 * side + x1], c = f[y1 * side + x0], d = f[y1 * side + x1];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

export interface PaintOpts {
  /** Size of one dither dot in CSS px. */
  pixel?: number;
  tones?: number[];
  /** Brightness multiplier (for dimmed or ghosted screens). */
  gain?: number;
  /** Add faint value noise (dream grain). */
  grain?: number;
  t?: number;
  /** Nearest-neighbour blocks instead of a smooth dithered upsample. */
  blocks?: boolean;
}

/** Paint a side×side frame into the square (x, y, size). */
export function paintFrame(ctx: CanvasRenderingContext2D, frame: ArrayLike<number>, side: number, x: number, y: number, size: number, o: PaintOpts = {}) {
  const px = o.pixel ?? 3;
  const n = Math.max(side, Math.round(size / px));
  const { img, off } = buf(n, n);
  const tones = o.tones ?? TONES;
  const k = tones.length - 1;
  const gain = o.gain ?? 1;
  const d = img.data;
  for (let j = 0; j < n; j++) {
    const v = (j + 0.5) / n;
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      let val = o.blocks ? frame[Math.min(side - 1, Math.floor(v * side)) * side + Math.min(side - 1, Math.floor(u * side))] : sample(frame, side, u, v);
      val *= gain;
      if (o.grain) val += o.grain * (valueNoise(i * 0.35, j * 0.35 + (o.t ?? 0) * 3, 5) - 0.5);
      const q = Math.max(0, Math.min(1, val)) * k;
      const lo = Math.floor(q);
      const lvl = Math.min(k, lo + (q - lo > BAYER8[(j & 7) * 8 + (i & 7)] ? 1 : 0));
      const g = Math.round(tones[lvl] * 255);
      const p = (j * n + i) * 4;
      d[p] = d[p + 1] = d[p + 2] = g;
      d[p + 3] = 255;
    }
  }
  off.getContext("2d")!.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, x, y, size, size);
}

/** Dithered TV static: what an untrained dream looks like. */
export function paintStatic(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, t: number, pixel = 3, gain = 0.5) {
  const n = Math.max(8, Math.round(size / pixel));
  const { img, off } = buf(n, n);
  const d = img.data;
  const f = Math.floor(t * 12);
  for (let j = 0; j < n; j++) {
    const band = 0.5 + 0.5 * Math.sin(j * 0.21 + t * 4);
    for (let i = 0; i < n; i++) {
      let h = Math.imul(i + f * 131, 374761393) ^ Math.imul(j + f * 71, 668265263);
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      const r = ((h ^ (h >>> 16)) >>> 0) / 4294967296;
      const v = r * gain * (0.55 + 0.45 * band);
      const g = v > BAYER8[(j & 7) * 8 + (i & 7)] * 0.9 + 0.1 ? (v > 0.42 ? 200 : 70) : 0;
      const p = (j * n + i) * 4;
      d[p] = d[p + 1] = d[p + 2] = g;
      d[p + 3] = 255;
    }
  }
  off.getContext("2d")!.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, x, y, size, size);
}

/** Corner brackets round a screen. */
export function brackets(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, len = 10, level = 0.55) {
  ctx.strokeStyle = grey(level);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]] as const) {
    ctx.moveTo(cx + dx * len, cy + 0.5 * dy);
    ctx.lineTo(cx + 0.5 * dx, cy + 0.5 * dy);
    ctx.lineTo(cx + 0.5 * dx, cy + dy * len);
  }
  ctx.stroke();
}

/** The page's font family (Archivo via next/font), for canvas text. */
export function fontFamily(): string {
  if (typeof document === "undefined") return "sans-serif";
  return getComputedStyle(document.body).fontFamily || "sans-serif";
}

/** Small-caps label like the kit's `type-narrow tracking-[0.2em] uppercase`. */
export function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, o: { level?: number; size?: number; align?: CanvasTextAlign; weight?: number } = {}) {
  ctx.fillStyle = grey(o.level ?? 0.55);
  ctx.font = `${o.weight ?? 500} ${o.size ?? 10}px ${fontFamily()}`;
  ctx.textAlign = o.align ?? "left";
  ctx.textBaseline = "alphabetic";
  const t = text.toUpperCase();
  // manual letter-spacing (canvas letterSpacing is not everywhere yet)
  const sp = (o.size ?? 10) * 0.2;
  let w = 0;
  for (const ch of t) w += ctx.measureText(ch).width + sp;
  w -= sp;
  let cx = o.align === "right" ? x - w : o.align === "center" ? x - w / 2 : x;
  ctx.textAlign = "left";
  for (const ch of t) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + sp;
  }
}

/** Phosphor persistence: fade the old image and keep the brighter of old and new. */
export function phosphor(acc: Float32Array, frame: ArrayLike<number>, decay = 0.72) {
  for (let i = 0; i < acc.length; i++) acc[i] = Math.max(acc[i] * decay, frame[i]);
}

import { ditherField } from "@/kit/dither";

/*
 * Drawing greyscale matrices onto a canvas: smooth, or Bayer-dithered for the house look.
 * Pure helpers; the components own the canvases.
 */

export type Range = [number, number] | "auto" | "symmetric";

export interface RasterOptions {
  /** Value range mapped to black..white. "symmetric" puts 0 at mid-grey (for signed layers). */
  range?: Range;
  dither?: boolean;
  tones?: number[];
  /** Dither cell in CSS px (dither only). */
  cell?: number;
}

type F32 = Float32Array<ArrayBuffer>;
const cache = new Map<string, { off: OffscreenCanvas; img: ImageData; f: F32 }>();

function buffers(w: number, h: number, tag: string) {
  const key = `${tag}:${w}x${h}`;
  let b = cache.get(key);
  if (!b) {
    b = { off: new OffscreenCanvas(w, h), img: new ImageData(w, h), f: new Float32Array(w * h) };
    cache.set(key, b);
  }
  return b;
}

/** Map values into [0, 1] under a range rule. */
export function normalise(values: ArrayLike<number>, range: Range = [0, 1], out: F32 = new Float32Array(values.length)): F32 {
  let lo = 0, hi = 1;
  if (range === "auto" || range === "symmetric") {
    lo = Infinity;
    hi = -Infinity;
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    if (range === "symmetric") {
      const a = Math.max(Math.abs(lo), Math.abs(hi)) || 1;
      lo = -a;
      hi = a;
    }
  } else [lo, hi] = range;
  const s = 1 / (hi - lo || 1);
  for (let i = 0; i < values.length; i++) out[i] = (values[i] - lo) * s;
  return out;
}

/**
 * Draw a rows × cols matrix into the box (x, y, w, h) in CSS px.
 * Smooth mode draws one canvas pixel per entry, scaled with nearest-neighbour.
 * Dither mode resamples to the box at `cell` px and Bayer-dithers to `tones`.
 */
export function drawMatrix(
  ctx: CanvasRenderingContext2D,
  values: ArrayLike<number>,
  rows: number,
  cols: number,
  x: number,
  y: number,
  w: number,
  h: number,
  { range = [0, 1], dither = false, tones = [0, 0.3, 0.62, 1], cell = 2 }: RasterOptions = {},
  tag = "m",
) {
  if (w <= 0 || h <= 0) return;
  ctx.imageSmoothingEnabled = false;
  if (!dither) {
    const b = buffers(cols, rows, tag + "s");
    normalise(values, range, b.f);
    const d = b.img.data;
    for (let i = 0; i < rows * cols; i++) {
      const g = Math.max(0, Math.min(255, Math.round(b.f[i] * 255)));
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = g;
      d[i * 4 + 3] = 255;
    }
    b.off.getContext("2d")!.putImageData(b.img, 0, 0);
    ctx.drawImage(b.off, x, y, w, h);
    return;
  }
  const gw = Math.max(1, Math.round(w / cell)), gh = Math.max(1, Math.round(h / cell));
  const src = buffers(cols, rows, tag + "n");
  normalise(values, range, src.f);
  const b = buffers(gw, gh, tag + "d");
  for (let yy = 0; yy < gh; yy++) {
    const sy = Math.min(rows - 1, Math.floor(((yy + 0.5) / gh) * rows));
    for (let xx = 0; xx < gw; xx++) {
      const sx = Math.min(cols - 1, Math.floor(((xx + 0.5) / gw) * cols));
      b.f[yy * gw + xx] = src.f[sy * cols + sx];
    }
  }
  ditherField(b.f, gw, gh, b.img.data, tones);
  b.off.getContext("2d")!.putImageData(b.img, 0, 0);
  ctx.drawImage(b.off, x, y, gw * cell, gh * cell);
}

/** Fit a rows × cols image inside a box, centred. */
export function fit(rows: number, cols: number, W: number, H: number) {
  const s = Math.min(W / cols, H / rows);
  const w = cols * s, h = rows * s;
  return { x: (W - w) / 2, y: (H - h) / 2, w, h };
}

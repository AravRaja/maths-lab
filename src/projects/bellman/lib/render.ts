import { BAYER8, valueNoise } from "@/kit/dither";
import { grey } from "@/kit/canvas";
import { TILE, type World } from "./grid";

/*
 * The signature look: a value function drawn as dithered terrain. Bright = valuable. Values are
 * interpolated between cell centres so the field reads as a landscape, then Bayer-8 dithered to a
 * few greys. Cells whose value just changed shimmer (the "ripple"), walls are hatched, lava boils,
 * goals ring. No hue anywhere: only grey levels, stroke weight and motion.
 */

export interface Layout {
  x0: number;
  y0: number;
  cell: number;
  w: number;
  h: number;
}

/** Square cells fitted into a box. "cover" fills the box and crops; "contain" letterboxes. */
export function fitLayout(width: number, height: number, w: number, h: number, mode: "contain" | "cover" = "contain"): Layout {
  const cell = mode === "cover" ? Math.max(width / w, height / h) : Math.min(width / w, height / h);
  return { cell, w, h, x0: (width - cell * w) / 2, y0: (height - cell * h) / 2 };
}

export function cellAt(L: Layout, x: number, y: number): number | null {
  const cx = Math.floor((x - L.x0) / L.cell);
  const cy = Math.floor((y - L.y0) / L.cell);
  if (cx < 0 || cy < 0 || cx >= L.w || cy >= L.h) return null;
  return cy * L.w + cx;
}

export interface FieldOptions {
  /** Size of one dither pixel, CSS px. */
  pixel?: number;
  /** Grey levels, dark to light. */
  tones?: number[];
  /** Fix the value → brightness map instead of auto-ranging over live cells. */
  range?: [number, number];
  /** Dim the whole field (used for ghosts). */
  dim?: number;
}

const TONES = [0, 0.14, 0.38, 0.7, 1];

/** Normalised display value per cell: live cells in [0,1], goals above, lava below, walls NaN. */
export function normalise(world: World, V: ArrayLike<number> | null, range?: [number, number], contrast = 1.6): Float32Array {
  const n = world.w * world.h;
  const out = new Float32Array(n);
  let lo = Infinity, hi = -Infinity;
  if (V) {
    if (range) [lo, hi] = range;
    else
      for (let s = 0; s < n; s++) {
        const t = world.tiles[s];
        if (t === TILE.empty || t === TILE.mud) { lo = Math.min(lo, V[s]); hi = Math.max(hi, V[s]); }
      }
  }
  if (!isFinite(lo) || !isFinite(hi)) { lo = 0; hi = 1; }
  if (hi - lo < 1e-9) { lo -= 0.5; hi += 0.5; }
  for (let s = 0; s < n; s++) {
    const t = world.tiles[s];
    out[s] = t === TILE.wall ? NaN : t === TILE.goal ? 1.2 : t === TILE.lava ? -0.15 : V ? Math.pow(Math.max(0, (V[s] - lo) / (hi - lo)), contrast) : 0.06;
  }
  return out;
}

function sample(f: Float32Array, w: number, h: number, gx: number, gy: number, own: number): number {
  const fx = gx - 0.5, fy = gy - 0.5;
  const i0 = Math.floor(fx), j0 = Math.floor(fy);
  const tx = fx - i0, ty = fy - j0;
  let acc = 0, wsum = 0;
  for (let dj = 0; dj < 2; dj++)
    for (let di = 0; di < 2; di++) {
      const i = Math.min(w - 1, Math.max(0, i0 + di));
      const j = Math.min(h - 1, Math.max(0, j0 + dj));
      const v = f[j * w + i];
      if (v !== v) continue; // NaN: wall
      const k = (di ? tx : 1 - tx) * (dj ? ty : 1 - ty);
      acc += k * Math.min(1, Math.max(0, v));
      wsum += k;
    }
  return wsum > 1e-6 ? acc / wsum : own;
}

/** Holds the offscreen buffer for one canvas. */
export class FieldPainter {
  private off: OffscreenCanvas | null = null;
  private img: ImageData | null = null;
  private bw = 0;
  private bh = 0;

  paint(
    ctx: CanvasRenderingContext2D,
    L: Layout,
    world: World,
    norm: Float32Array,
    energy: Float32Array | null,
    t: number,
    opts: FieldOptions = {},
  ) {
    const pixel = opts.pixel ?? 2;
    const tones = opts.tones ?? TONES;
    const dim = opts.dim ?? 1;
    const bw = Math.max(1, Math.ceil((L.w * L.cell) / pixel));
    const bh = Math.max(1, Math.ceil((L.h * L.cell) / pixel));
    if (!this.off || this.bw !== bw || this.bh !== bh) {
      this.off = new OffscreenCanvas(bw, bh);
      this.img = new ImageData(bw, bh);
      this.bw = bw;
      this.bh = bh;
    }
    const data = this.img!.data;
    const nT = tones.length - 1;
    const per = L.cell / pixel; // dither pixels per cell
    const { w, h, tiles } = world;
    for (let py = 0; py < bh; py++) {
      const gy = (py + 0.5) / per;
      const cy = Math.min(h - 1, gy | 0);
      for (let px = 0; px < bw; px++) {
        const gx = (px + 0.5) / per;
        const cx = Math.min(w - 1, gx | 0);
        const s = cy * w + cx;
        const tile = tiles[s];
        const th = BAYER8[(py & 7) * 8 + (px & 7)];
        let g: number;
        if (tile === TILE.wall) {
          g = (px + py) % 4 === 0 ? 0.26 : 0.035;
        } else if (tile === TILE.lava) {
          const nz = valueNoise(px * 0.21, py * 0.21 - t * 1.4, 7) * 0.65 + valueNoise(px * 0.5 + t, py * 0.5, 9) * 0.35;
          g = nz * nz > th * 0.9 ? 0.42 : 0.02;
        } else if (tile === TILE.goal) {
          const dx = gx - cx - 0.5, dy = gy - cy - 0.5;
          const d = Math.sqrt(dx * dx + dy * dy);
          const ring = 0.5 + 0.5 * Math.sin(d * 22 - t * 5);
          g = ring > th ? 1 : 0.55;
        } else {
          let v = sample(norm, w, h, gx, gy, norm[s]);
          if (energy) {
            const e = energy[s];
            if (e > 0.002) {
              // Shimmer: a fast noisy flicker, strongest where the value just moved.
              const nz = valueNoise(gx * 2.1, gy * 2.1, 3);
              v += Math.min(0.32, e * 0.8) * Math.sin(t * 13 + nz * 9);
            }
          }
          if (tile === TILE.mud) {
            v *= 0.55;
            if (px % 3 === 0 && py % 3 === 0) v = 0;
          }
          v = Math.max(0, Math.min(1, v)) * nT;
          const lo = v | 0;
          const k = Math.min(nT, lo + (v - lo > th ? 1 : 0));
          g = tones[k];
        }
        const c = Math.round(g * dim * 255);
        const p = (py * bw + px) * 4;
        data[p] = data[p + 1] = data[p + 2] = c;
        data[p + 3] = 255;
      }
    }
    this.off.getContext("2d")!.putImageData(this.img!, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(L.x0, L.y0, L.w * L.cell, L.h * L.cell);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.off, L.x0, L.y0, bw * pixel, bh * pixel);
    ctx.restore();
  }
}

/** Faint cell grid. */
export function drawGrid(ctx: CanvasRenderingContext2D, L: Layout, alpha = 0.07) {
  ctx.strokeStyle = grey(1, alpha);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= L.w; i++) {
    const x = Math.round(L.x0 + i * L.cell) + 0.5;
    ctx.moveTo(x, L.y0);
    ctx.lineTo(x, L.y0 + L.h * L.cell);
  }
  for (let j = 0; j <= L.h; j++) {
    const y = Math.round(L.y0 + j * L.cell) + 0.5;
    ctx.moveTo(L.x0, y);
    ctx.lineTo(L.x0 + L.w * L.cell, y);
  }
  ctx.stroke();
}

/** Iso-value lines by marching squares over the cell-centre lattice. */
export function drawContours(ctx: CanvasRenderingContext2D, L: Layout, norm: Float32Array, levels = 7) {
  const { w, h, cell } = L;
  const segs: number[] = [];
  for (let k = 1; k <= levels; k++) {
    const iso = k / (levels + 1);
    for (let j = 0; j + 1 < h; j++)
      for (let i = 0; i + 1 < w; i++) {
        const a = norm[j * w + i], b = norm[j * w + i + 1], c = norm[(j + 1) * w + i + 1], d = norm[(j + 1) * w + i];
        if (a !== a || b !== b || c !== c || d !== d) continue;
        if (a > 1 || b > 1 || c > 1 || d > 1 || a < 0 || b < 0 || c < 0 || d < 0) continue;
        const pts: number[] = [];
        const edge = (v0: number, v1: number, x0: number, y0: number, x1: number, y1: number) => {
          if ((v0 < iso) !== (v1 < iso)) {
            const u = (iso - v0) / (v1 - v0);
            pts.push(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u);
          }
        };
        edge(a, b, i, j, i + 1, j);
        edge(b, c, i + 1, j, i + 1, j + 1);
        edge(c, d, i + 1, j + 1, i, j + 1);
        edge(d, a, i, j + 1, i, j);
        if (pts.length >= 4) segs.push(...pts.slice(0, 4));
        if (pts.length === 8) segs.push(...pts.slice(4, 8));
      }
  }
  const X = (g: number) => L.x0 + (g + 0.5) * cell;
  const Y = (g: number) => L.y0 + (g + 0.5) * cell;
  const path = () => {
    ctx.beginPath();
    for (let i = 0; i < segs.length; i += 4) {
      ctx.moveTo(X(segs[i]), Y(segs[i + 1]));
      ctx.lineTo(X(segs[i + 2]), Y(segs[i + 3]));
    }
  };
  ctx.lineCap = "round";
  path();
  ctx.strokeStyle = grey(0, 0.6);
  ctx.lineWidth = 2.6;
  ctx.stroke();
  ctx.strokeStyle = grey(1, 0.5);
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** Ease each arrow's angle toward its action (0 up, 1 right, 2 down, 3 left) the short way round. */
export function easeAngles(angles: Float32Array, actions: ArrayLike<number>, k: number) {
  for (let s = 0; s < angles.length; s++) {
    const a = actions[s];
    if (a < 0) continue;
    const target = (a * Math.PI) / 2;
    let d = target - angles[s];
    d = Math.atan2(Math.sin(d), Math.cos(d));
    angles[s] += d * k;
  }
}

/** Policy arrows. actions[s] = -1 draws a small four-way star (a uniformly random cell). */
export function drawArrows(
  ctx: CanvasRenderingContext2D,
  L: Layout,
  world: World,
  angles: Float32Array,
  actions: ArrayLike<number>,
  alpha = 1,
) {
  const len = L.cell * 0.5;
  const head = Math.max(2.5, L.cell * 0.17);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let s = 0; s < actions.length; s++) {
    const t = world.tiles[s];
    if (t === TILE.wall || t === TILE.goal || t === TILE.lava) continue;
    const cx = L.x0 + ((s % L.w) + 0.5) * L.cell;
    const cy = L.y0 + (((s / L.w) | 0) + 0.5) * L.cell;
    if (actions[s] < -1) continue;
    if (actions[s] < 0) {
      const r = L.cell * 0.16;
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.sin(a) * r, cy - Math.cos(a) * r);
      }
      ctx.strokeStyle = grey(0, 0.7 * alpha);
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = grey(1, 0.8 * alpha);
      ctx.lineWidth = 1;
      ctx.stroke();
      continue;
    }
    const th = angles[s];
    const dx = Math.sin(th), dy = -Math.cos(th);
    const x0 = cx - dx * len * 0.45, y0 = cy - dy * len * 0.45;
    const x1 = cx + dx * len * 0.55, y1 = cy + dy * len * 0.55;
    const nx = -dy, ny = dx;
    const draw = () => {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.moveTo(x1 - dx * head + nx * head * 0.75, y1 - dy * head + ny * head * 0.75);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x1 - dx * head - nx * head * 0.75, y1 - dy * head - ny * head * 0.75);
    };
    draw();
    ctx.strokeStyle = grey(0, 0.85 * alpha);
    ctx.lineWidth = 3.6;
    ctx.stroke();
    ctx.strokeStyle = grey(1, alpha);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

/** Visit counts as stippled footprints (up to 9 dots a cell, log-scaled). */
export function drawFootprints(ctx: CanvasRenderingContext2D, L: Layout, visits: ArrayLike<number>) {
  let max = 1;
  for (let s = 0; s < visits.length; s++) max = Math.max(max, visits[s]);
  const lm = Math.log1p(max);
  const sz = Math.max(1.2, L.cell * 0.07);
  ctx.fillStyle = grey(1, 0.85);
  for (let s = 0; s < visits.length; s++) {
    if (!visits[s]) continue;
    const k = Math.max(1, Math.round((Math.log1p(visits[s]) / lm) * 9));
    const bx = L.x0 + (s % L.w) * L.cell, by = L.y0 + ((s / L.w) | 0) * L.cell;
    for (let i = 0; i < k; i++) {
      const u = ((i % 3) + 0.5) / 3 + (((s * 7 + i * 13) % 5) - 2) * 0.02;
      const v = (((i / 3) | 0) + 0.5) / 3 + (((s * 11 + i * 3) % 5) - 2) * 0.02;
      ctx.fillRect(bx + u * L.cell - sz / 2, by + v * L.cell - sz / 2, sz, sz);
    }
  }
}

/** Cell centre in CSS px. */
export function centre(L: Layout, s: number): [number, number] {
  return [L.x0 + ((s % L.w) + 0.5) * L.cell, L.y0 + (((s / L.w) | 0) + 0.5) * L.cell];
}

/** The agent: a white bead with a black rim and a fading wake. */
export function drawAgent(ctx: CanvasRenderingContext2D, L: Layout, x: number, y: number, wake: [number, number][], t: number) {
  if (wake.length > 1) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = 1; i < wake.length; i++) {
      const a = i / wake.length;
      ctx.strokeStyle = grey(1, a * 0.7);
      ctx.lineWidth = Math.max(1, L.cell * 0.12 * a);
      ctx.beginPath();
      ctx.moveTo(wake[i - 1][0], wake[i - 1][1]);
      ctx.lineTo(wake[i][0], wake[i][1]);
      ctx.stroke();
    }
  }
  const r = Math.max(3, L.cell * 0.26);
  ctx.beginPath();
  ctx.arc(x, y, r + 2 + Math.sin(t * 6) * 1.2, 0, Math.PI * 2);
  ctx.strokeStyle = grey(1, 0.4);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grey(1);
  ctx.fill();
  ctx.strokeStyle = grey(0);
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** Start marker: hollow diamond. */
export function drawStart(ctx: CanvasRenderingContext2D, L: Layout, s: number) {
  const [x, y] = centre(L, s);
  const r = L.cell * 0.3;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.strokeStyle = grey(0, 0.9);
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.strokeStyle = grey(1);
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** Selection ring. */
export function drawSelection(ctx: CanvasRenderingContext2D, L: Layout, s: number, t: number) {
  const x = L.x0 + (s % L.w) * L.cell, y = L.y0 + ((s / L.w) | 0) * L.cell;
  ctx.save();
  ctx.setLineDash([3, 3]);
  ctx.lineDashOffset = -t * 12;
  ctx.strokeStyle = grey(1);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 1.5, y + 1.5, L.cell - 3, L.cell - 3);
  ctx.restore();
}

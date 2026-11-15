import type { Matrix } from "../core/types";
import { gaussian, rng } from "./rng";

/*
 * A crowd of procedurally drawn faces: the eigenfaces dataset. No photos of real people.
 * Each face is a handful of random parameters (lighting, head shape, eyes, brows, mouth, hair,
 * glasses, beard) rendered as a soft greyscale image. Because the faces vary along a few
 * smooth directions, PCA finds real structure: lighting, smile, hair, glasses.
 */

export interface FaceParams {
  cx: number; cy: number; rx: number; ry: number;
  skin: number; bg: number;
  lx: number; ly: number;
  eyeX: number; eyeY: number; eyeR: number;
  browY: number; browTilt: number; browDark: number;
  mouthY: number; mouthW: number; smile: number; mouthDark: number;
  noseLen: number;
  hair: number; hairline: number; hairVol: number;
  glasses: number; beard: number;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

export function randomFace(r: () => number): FaceParams {
  const g = gaussian(r);
  const n = (mu: number, sd: number, lo = -Infinity, hi = Infinity) => Math.max(lo, Math.min(hi, mu + sd * g()));
  return {
    cx: n(0, 0.03), cy: n(0.04, 0.03),
    rx: n(0.6, 0.05, 0.48, 0.72), ry: n(0.78, 0.05, 0.66, 0.9),
    skin: n(0.62, 0.11, 0.35, 0.88), bg: n(0.16, 0.06, 0.03, 0.35),
    lx: n(0, 0.5, -0.95, 0.95), ly: n(-0.35, 0.2, -0.8, 0.2),
    eyeX: n(0.25, 0.025, 0.19, 0.31), eyeY: n(-0.08, 0.035), eyeR: n(0.065, 0.012, 0.04, 0.09),
    browY: n(0.13, 0.025, 0.07, 0.2), browTilt: n(0, 0.07), browDark: n(0.6, 0.2, 0.15, 1),
    mouthY: n(0.42, 0.035), mouthW: n(0.2, 0.035, 0.12, 0.3), smile: n(0.06, 0.08, -0.12, 0.2), mouthDark: n(0.55, 0.15, 0.2, 0.9),
    noseLen: n(0.2, 0.04, 0.12, 0.3),
    hair: n(0.18, 0.14, 0.02, 0.75), hairline: n(-0.42, 0.08, -0.6, -0.22), hairVol: n(0.1, 0.06, 0, 0.25),
    glasses: r() < 0.25 ? 1 : 0,
    beard: r() < 0.18 ? n(0.6, 0.2, 0.25, 1) : 0,
  };
}

/** Render one face into a w × h greyscale image in [0, 1], row-major. */
export function renderFace(p: FaceParams, w: number, h: number, out: Float64Array<ArrayBufferLike> = new Float64Array(w * h), grain = 0, seed = 1): Float64Array<ArrayBufferLike> {
  const L = norm3(p.lx, p.ly, 0.75);
  const r = grain ? rng(seed) : null;
  for (let y = 0; y < h; y++) {
    // v in [-1, 1] top to bottom; u in [-1, 1] scaled to keep faces round on non-square grids.
    const v = ((y + 0.5) / h) * 2 - 1;
    for (let x = 0; x < w; x++) {
      const u = (((x + 0.5) / w) * 2 - 1) * (w / h) * 1.15;
      const dx = (u - p.cx) / p.rx, dy = (v - p.cy) / p.ry;
      const d2 = dx * dx + dy * dy;
      const inHead = 1 - smooth(0.92, 1.02, d2);
      // Lambert shading on an ellipsoid.
      const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, d2)));
      const shade = Math.max(0, dx * L[0] + dy * L[1] + nz * L[2]);
      let face = p.skin * (0.28 + 0.82 * shade);

      const fx = u - p.cx, fy = v - p.cy;
      // Eye sockets, eyes, pupils.
      for (const side of [-1, 1]) {
        const ex = fx - side * p.eyeX, ey = fy - p.eyeY;
        const socket = Math.exp(-(ex * ex) / 0.02 - (ey * ey) / 0.008);
        face *= 1 - 0.28 * socket;
        const e2 = (ex * ex) / (p.eyeR * p.eyeR * 2.2) + (ey * ey) / (p.eyeR * p.eyeR * 0.9);
        const white = 1 - smooth(0.8, 1.1, e2);
        face = face * (1 - white) + white * Math.min(1, p.skin + 0.25);
        const pupil = 1 - smooth(0.12, 0.35, e2);
        face *= 1 - 0.9 * pupil;
        // Brows.
        const by = fy - (p.eyeY - p.browY) - side * p.browTilt * ex;
        const brow = Math.exp(-(by * by) / 0.0009) * (1 - smooth(0.012, 0.028, ex * ex));
        face *= 1 - p.browDark * 0.85 * brow;
        // Glasses: a ring round each eye and a bridge.
        if (p.glasses) {
          const rr = Math.sqrt(ex * ex * 0.8 + ey * ey * 1.4);
          const ring = Math.exp(-((rr - 0.13) ** 2) / 0.00025);
          face *= 1 - 0.85 * ring;
        }
      }
      if (p.glasses) {
        const bridge = Math.exp(-((fy - p.eyeY + 0.02) ** 2) / 0.0003) * (1 - smooth(0.004, 0.012, fx * fx));
        face *= 1 - 0.7 * bridge;
      }
      // Nose: a soft shadow on the side away from the light, and nostrils.
      const nyRel = fy - p.eyeY;
      if (nyRel > 0 && nyRel < p.noseLen + 0.05) {
        const nx = fx + 0.03 * Math.sign(p.lx || 1);
        face *= 1 - 0.22 * Math.exp(-(nx * nx) / 0.0012) * smooth(0, p.noseLen, nyRel);
      }
      const nos = fy - (p.eyeY + p.noseLen + 0.03);
      for (const side of [-1, 1]) face *= 1 - 0.45 * Math.exp(-((fx - side * 0.045) ** 2) / 0.0008 - (nos * nos) / 0.0006);
      // Mouth: a curve whose height depends on the smile.
      const mx = fx / p.mouthW;
      if (Math.abs(mx) < 1.25) {
        const curve = p.mouthY - p.smile * (1 - mx * mx);
        const md = fy - curve;
        const lip = Math.exp(-(md * md) / 0.0011) * (1 - smooth(0.8, 1.2, Math.abs(mx)));
        face *= 1 - p.mouthDark * lip;
      }
      // Beard: darken the jaw.
      if (p.beard) {
        const jaw = smooth(p.mouthY - 0.12, p.mouthY + 0.12, fy) * smooth(0.25, 0.75, d2) + smooth(p.mouthY + 0.05, p.mouthY + 0.3, fy) * 0.8;
        face = face * (1 - Math.min(1, jaw) * p.beard * 0.8) + Math.min(1, jaw) * p.beard * 0.8 * 0.08;
      }

      // Hair: a cap above the hairline, a bit wider than the head.
      const hdx = (u - p.cx) / (p.rx + p.hairVol), hdy = (v - p.cy + p.hairVol * 0.6) / (p.ry + p.hairVol);
      const hd2 = hdx * hdx + hdy * hdy;
      const inHair = (1 - smooth(0.9, 1.0, hd2)) * (1 - smooth(p.hairline - 0.06, p.hairline + 0.06, v - p.cy + 0.1 * (u - p.cx) ** 2));
      const hairTone = p.hair * (0.6 + 0.4 * Math.max(0, dx * L[0] + dy * L[1] + 0.6));

      let val = p.bg * (1 - 0.25 * v);
      val = val * (1 - inHead) + face * inHead;
      val = val * (1 - inHair) + hairTone * inHair;
      // Neck below the head.
      const neck = (1 - smooth(0.16, 0.22, Math.abs(fx))) * smooth(p.cy + p.ry * 0.8, p.cy + p.ry * 0.95, v) * (1 - inHead);
      val = val * (1 - neck) + p.skin * 0.55 * neck;
      if (r) val += (r() - 0.5) * grain;
      out[y * w + x] = clamp01(val);
    }
  }
  return out;
}

function norm3(x: number, y: number, z: number): [number, number, number] {
  const n = Math.hypot(x, y, z);
  return [x / n, y / n, z / n];
}

export interface FaceSet {
  /** Rows are faces, flattened row-major images of size w × h. */
  X: Matrix;
  w: number;
  h: number;
  params: FaceParams[];
}

export const FACE_W = 28;
export const FACE_H = 32;

/** n faces of FACE_W × FACE_H, as an n × (w·h) data matrix. */
export function makeFaces(n: number, seed = 7, w = FACE_W, h = FACE_H): FaceSet {
  const r = rng(seed);
  const d = w * h;
  const X: Matrix = { rows: n, cols: d, data: new Float64Array(n * d) };
  const params: FaceParams[] = [];
  for (let i = 0; i < n; i++) {
    const p = randomFace(r);
    params.push(p);
    renderFace(p, w, h, X.data.subarray(i * d, (i + 1) * d), 0.04, seed * 1000 + i);
  }
  return { X, w, h, params };
}

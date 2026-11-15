import { ditherField } from "@/kit/dither";
import type { View } from "../lib/view";

/**
 * Splat samples into a grid, blur once, and dither it to a few greys: a picture of p_t built only
 * from samples (no density formula needed).
 */
export class DensityImage {
  private f: Float32Array;
  private tmp: Float32Array;
  private img: ImageData;
  private off: OffscreenCanvas | HTMLCanvasElement;
  constructor(public n = 80, public world = 2.3) {
    this.f = new Float32Array(n * n);
    this.tmp = new Float32Array(n * n);
    this.img = new ImageData(n, n);
    this.off = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(n, n) : Object.assign(document.createElement("canvas"), { width: n, height: n });
  }

  build(samples: ArrayLike<number>[], tones = [0, 0.1, 0.22, 0.4]): void {
    const { n, world, f, tmp } = this;
    f.fill(0);
    for (const p of samples) {
      const i = Math.floor(((p[0] + world) / (2 * world)) * n);
      const j = Math.floor(((world - p[1]) / (2 * world)) * n);
      if (i >= 0 && i < n && j >= 0 && j < n) f[j * n + i] += 1;
    }
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          let s = 0, c = 0;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx, yy = y + dy;
              if (xx >= 0 && yy >= 0 && xx < n && yy < n) { s += f[yy * n + xx]; c++; }
            }
          tmp[y * n + x] = s / c;
        }
      f.set(tmp);
    }
    let max = 0;
    for (let i = 0; i < f.length; i++) max = Math.max(max, f[i]);
    for (let i = 0; i < f.length; i++) f[i] = max > 0 ? Math.sqrt(f[i] / max) : 0;
    ditherField(f, n, n, this.img.data, tones);
    (this.off.getContext("2d") as CanvasRenderingContext2D).putImageData(this.img, 0, 0);
  }

  draw(ctx: CanvasRenderingContext2D, v: View): void {
    const x0 = v.x(-this.world), y0 = v.y(this.world);
    const size = v.x(this.world) - x0;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.off, x0, y0, size, size);
  }
}

import { grey } from "@/kit/canvas";
import type { View } from "../lib/view";

/** Small canvas helpers shared by the flowfield views. Monochrome only. */

export function clear(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = grey(0);
  ctx.fillRect(0, 0, w, h);
}

export function drawGrid(ctx: CanvasRenderingContext2D, v: View, w: number, h: number) {
  ctx.strokeStyle = grey(1, 0.06);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = -2; k <= 2; k++) {
    ctx.moveTo(v.x(k), 0);
    ctx.lineTo(v.x(k), h);
    ctx.moveTo(0, v.y(k));
    ctx.lineTo(w, v.y(k));
  }
  ctx.stroke();
  ctx.strokeStyle = grey(1, 0.14);
  ctx.beginPath();
  ctx.moveTo(v.x(0), 0);
  ctx.lineTo(v.x(0), h);
  ctx.moveTo(0, v.y(0));
  ctx.lineTo(w, v.y(0));
  ctx.stroke();
}

export function drawPoints(ctx: CanvasRenderingContext2D, v: View, pts: ArrayLike<number>[] | number[][], size = 1.6, color = grey(1)) {
  ctx.fillStyle = color;
  for (const p of pts) ctx.fillRect(v.x(p[0]) - size / 2, v.y(p[1]) - size / 2, size, size);
}

export function drawArrow(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, head = 6) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * Math.cos(a - 0.45), y1 - head * Math.sin(a - 0.45));
  ctx.lineTo(x1 - head * Math.cos(a + 0.45), y1 - head * Math.sin(a + 0.45));
  ctx.closePath();
  ctx.fill();
}

/** Overlay label in the corner of a canvas (drawn, so it is part of screenshots). */
export function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, align: CanvasTextAlign = "left", alpha = 0.7, upper = true) {
  ctx.font = upper ? '600 10px "Archivo", ui-sans-serif, system-ui' : '500 12px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.letterSpacing = upper ? "2px" : "0px";
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.fillStyle = grey(1, alpha);
  ctx.fillText(upper ? text.toUpperCase() : text, x, y);
  ctx.letterSpacing = "0px";
}

/** True when the canvas is scrolled out of view: loops skip their work and keep the last frame. */
export function offscreen(ctx: CanvasRenderingContext2D, margin = 80): boolean {
  const r = ctx.canvas.getBoundingClientRect();
  return r.bottom < -margin || r.top > window.innerHeight + margin || r.width === 0;
}

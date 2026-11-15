/** Framework-free canvas helpers. The React hook lives in components/kit/use-canvas.ts. */

export interface CanvasSize {
  /** CSS pixels. Draw in these units; the context is pre-scaled by dpr. */
  width: number;
  height: number;
  /** Device pixel ratio actually used (capped). */
  dpr: number;
}

/** Resize a canvas's backing store to its CSS box at the given DPR (capped) and pre-scale the context. */
export function fitCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, maxDpr = 2): CanvasSize {
  const dpr = Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, maxDpr);
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const bw = Math.round(width * dpr);
  const bh = Math.round(height * dpr);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width, height, dpr };
}

export interface LoopHandle {
  stop: () => void;
}

/**
 * requestAnimationFrame loop with optional fps cap. `frame(t, dt)` gets seconds since start and since last frame.
 * Pauses while the tab is hidden (rAF does this for free).
 */
export function startLoop(frame: (t: number, dt: number) => void | false, fps?: number): LoopHandle {
  let raf = 0;
  let start = -1;
  let last = -1;
  const minStep = fps ? 1000 / fps : 0;
  const tick = (now: number) => {
    if (start < 0) start = last = now;
    if (!minStep || now - last >= minStep - 0.5) {
      const dt = (now - last) / 1000;
      last = now;
      if (frame((now - start) / 1000, dt) === false) return;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return { stop: () => cancelAnimationFrame(raf) };
}

/** Linear map of v from [a0,a1] to [b0,b1]. */
export function remap(v: number, a0: number, a1: number, b0: number, b1: number): number {
  return a1 === a0 ? (b0 + b1) / 2 : b0 + ((v - a0) * (b1 - b0)) / (a1 - a0);
}

/** Grey level 0..1 as a CSS colour. The only way the kit makes colour. */
export function grey(level: number, alpha = 1): string {
  const v = Math.round(Math.max(0, Math.min(1, level)) * 255);
  return alpha >= 1 ? `rgb(${v} ${v} ${v})` : `rgb(${v} ${v} ${v} / ${alpha})`;
}

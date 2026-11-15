"use client";

import { useRef, type ReactNode } from "react";
import { useCanvas } from "@/kit/components/use-canvas";
import { grey } from "@/kit/canvas";
import { cn } from "@/lib/utils";
import { lc } from "./bits";
import type { World } from "../lib/grid";
import {
  FieldPainter, cellAt, centre, drawAgent, drawArrows, drawContours, drawFootprints, drawGrid, drawSelection, drawStart,
  easeAngles, fitLayout, normalise, type Layout,
} from "../lib/render";

export interface GridViewProps {
  world: World;
  /** Target values (length nS). The display eases toward them and shimmers where they change. null = blank. */
  values: ArrayLike<number> | null;
  /** Arrows: an action per state (0 up … 3 left), -1 for a random-policy star. null = none. */
  actions?: ArrayLike<number> | null;
  /** Arrow opacity. */
  arrowAlpha?: number;
  /** Visit counts, drawn as footprints. */
  visits?: ArrayLike<number> | null;
  /** An episode to replay (state indices). Changing the array restarts the replay. */
  trail?: number[] | null;
  /** Cells per second for the replay. */
  agentSpeed?: number;
  /** Loop the replay. */
  loopTrail?: boolean;
  selected?: number | null;
  /** Pointer on a cell: "down" on press, "drag" as it moves into a new cell. */
  onCell?: (s: number, phase: "down" | "drag") => void;
  /** Block page scrolling while touching (for painting). */
  paint?: boolean;
  /** Value easing per frame (1 = snap). */
  ease?: number;
  contours?: boolean;
  /** Dim the field (ghost previews). */
  dim?: number;
  range?: [number, number];
  fit?: "contain" | "cover";
  pixel?: number;
  /** Overlay in the top-left corner. */
  badge?: ReactNode;
  className?: string;
  label?: string;
}

/** A gridworld drawn as dithered value terrain, with arrows, footprints and an agent. */
export function GridView({
  world, values, actions = null, arrowAlpha = 1, visits = null, trail = null, agentSpeed = 8, loopTrail = true, selected = null, onCell,
  paint = false, ease = 0.22, contours = true, dim = 1, range, fit = "contain", pixel = 2, badge, className, label,
}: GridViewProps) {
  const painter = useRef(new FieldPainter());
  const layout = useRef<Layout | null>(null);
  const anim = useRef<{
    n: number; disp: Float64Array; target: ArrayLike<number> | null; energy: Float32Array; angles: Float32Array;
    trail: number[] | null; p: number; hold: number; wake: [number, number][];
  } | null>(null);
  const lastCell = useRef<number | null>(null);

  const ref = useCanvas(({ ctx, width, height, t, dt }) => {
    const n = world.w * world.h;
    if (!anim.current || anim.current.n !== n) {
      anim.current = {
        n, disp: new Float64Array(n), target: null, energy: new Float32Array(n), angles: new Float32Array(n),
        trail: null, p: 0, hold: 0, wake: [],
      };
      if (actions) for (let s = 0; s < n; s++) anim.current.angles[s] = (Math.max(0, actions[s]) * Math.PI) / 2;
    }
    const A = anim.current;
    const L = fitLayout(width, height, world.w, world.h, fit);
    layout.current = L;

    // Values: shimmer where the target moved, then ease toward it.
    if (values && values !== A.target) {
      let lo = Infinity, hi = -Infinity;
      for (let s = 0; s < n; s++) { lo = Math.min(lo, values[s]); hi = Math.max(hi, values[s]); }
      const span = Math.max(1e-6, hi - lo);
      const prev = A.target;
      if (prev && prev.length === n)
        for (let s = 0; s < n; s++) {
          const d = Math.abs(values[s] - prev[s]) / span;
          A.energy[s] = Math.min(1, A.energy[s] + d * 2.5);
        }
      else A.disp.set(Array.from(values));
      A.target = values;
    }
    const k = dt === 0 ? 1 : 1 - Math.pow(1 - ease, Math.min(4, dt * 30));
    if (A.target) for (let s = 0; s < n; s++) A.disp[s] += (A.target[s] - A.disp[s]) * k;
    const decay = Math.pow(0.9, Math.max(1, dt * 30));
    for (let s = 0; s < n; s++) A.energy[s] *= decay;

    ctx.fillStyle = grey(0);
    ctx.fillRect(0, 0, width, height);
    const norm = normalise(world, A.target ? A.disp : null, range);
    painter.current.paint(ctx, L, world, norm, A.energy, t, { pixel, dim });
    drawGrid(ctx, L);
    if (contours && A.target) drawContours(ctx, L, norm);
    if (visits) drawFootprints(ctx, L, visits);
    if (actions) {
      easeAngles(A.angles, actions, dt === 0 ? 1 : Math.min(1, dt * 14));
      drawArrows(ctx, L, world, A.angles, actions, arrowAlpha);
    }
    drawStart(ctx, L, world.start);
    if (selected != null) drawSelection(ctx, L, selected, t);

    // Agent replay.
    if (trail !== A.trail) { A.trail = trail; A.p = 0; A.hold = 0; A.wake = []; }
    if (A.trail && A.trail.length > 0) {
      const tr = A.trail;
      if (A.p < tr.length - 1) A.p = Math.min(tr.length - 1, A.p + agentSpeed * dt);
      else if (loopTrail) { A.hold += dt; if (A.hold > 0.9) { A.p = 0; A.hold = 0; A.wake = []; } }
      const i = Math.floor(A.p), f = A.p - i;
      const [x0, y0] = centre(L, tr[i]);
      const [x1, y1] = centre(L, tr[Math.min(tr.length - 1, i + 1)]);
      const ef = f * f * (3 - 2 * f);
      const x = x0 + (x1 - x0) * ef, y = y0 + (y1 - y0) * ef;
      A.wake.push([x, y]);
      if (A.wake.length > 40) A.wake.shift();
      drawAgent(ctx, L, x, y, A.wake, t);
    }
  }, { fps: 30 }, [fit, pixel]);

  const toCell = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const L = layout.current;
    if (!L) return null;
    const r = e.currentTarget.getBoundingClientRect();
    return cellAt(L, e.clientX - r.left, e.clientY - r.top);
  };

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-rule bg-paper", className)}>
      <canvas
        ref={ref}
        role={onCell ? "application" : "img"}
        aria-label={label ?? "Gridworld value map"}
        className={cn("block h-full w-full [image-rendering:pixelated]", paint ? "touch-none" : "touch-manipulation")}
        onPointerDown={(e) => {
          if (!onCell) return;
          const s = toCell(e);
          if (s == null) return;
          if (paint) e.currentTarget.setPointerCapture(e.pointerId);
          lastCell.current = s;
          onCell(s, "down");
        }}
        onPointerMove={(e) => {
          if (!onCell || !paint || e.buttons === 0) return;
          const s = toCell(e);
          if (s == null || s === lastCell.current) return;
          lastCell.current = s;
          onCell(s, "drag");
        }}
        onPointerUp={() => (lastCell.current = null)}
      />
      {badge && <div className="pointer-events-none absolute top-2 left-2">{badge}</div>}
    </div>
  );
}

/** Small corner label for a canvas: "ghost", "live", "sweep 12". */
export function Badge({ children, solid }: { children: ReactNode; solid?: boolean }) {
  return (
    <span
      className={cn(
        "type-narrow inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] tracking-[0.2em] uppercase backdrop-blur",
        solid ? "border-ink bg-ink text-paper" : "border-rule bg-paper/80 text-ink",
      )}
    >
      {typeof children === "string" ? lc(children) : Array.isArray(children) ? children.map((c, i) => (typeof c === "string" ? <span key={i}>{lc(c)}</span> : c)) : children}
    </span>
  );
}

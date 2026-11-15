"use client";

import { useEffect, useRef } from "react";
import { useCanvas } from "@/kit/components/use-canvas";
import { grey } from "@/kit/canvas";
import { layoutGraph, fmtNum, type LaidEdge, type LaidNode } from "@/projects/chainrule/lib/engine/graph-layout";
import { OP_SYMBOL, type Value } from "@/projects/chainrule/lib/engine/value";
import { setFont } from "@/projects/chainrule/lib/engine/canvas-font";

export interface GraphScene {
  key: string;
  root: Value;
  /** ∂child/∂parent for each op node (from the user's op rules), or null when they're stubs. */
  local: Map<Value, number[]> | null;
  /** Backward schedule, or null when backprop is a stub. */
  backward: {
    /** Op nodes in the order they pass gradient on (reverse topological). */
    fire: Value[];
    /** g·∂child/∂parent per op node, from the user's rules at the final grads. */
    contrib: Map<Value, number[]>;
    grads: Map<Value, number>;
  } | null;
}

const STEP = 0.55; // seconds per node firing
const HOLD = 3.2; // pause before replaying

function hash(n: number) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function bezier(e: LaidEdge, f: number): [number, number] {
  const { child: c, parent: p } = e;
  const off = edgeOffset(e);
  const x0 = p.x + off, y0 = p.y - p.h / 2;
  const x3 = c.x + off * 0.4, y3 = c.y + c.h / 2;
  const my = (y0 + y3) / 2;
  const u = 1 - f;
  const x = u * u * u * x0 + 3 * u * u * f * x0 + 3 * u * f * f * x3 + f * f * f * x3;
  const y = u * u * u * y0 + 3 * u * u * f * my + 3 * u * f * f * my + f * f * f * y3;
  return [x, y];
}

function edgeOffset(e: LaidEdge) {
  const dup = e.child.v.parents.length === 2 && e.child.v.parents[0] === e.child.v.parents[1];
  return dup ? (e.index === 0 ? -9 : 9) : 0;
}

export function nodeTitle(v: Value): string {
  if (v.op === "leaf") return v.label ?? "x";
  if (v.op === "const") return fmtNum(v.data);
  if (v.op === "pow") return `^${fmtNum(v.k)}`;
  return OP_SYMBOL[v.op];
}

export function GraphCanvas({
  scene,
  height,
  selected,
  onSelect,
  replay,
}: {
  scene: GraphScene;
  height: number;
  selected: Value | null;
  onSelect: (v: Value | null) => void;
  /** Bump to restart the backward animation. */
  replay: number;
}) {
  const laid = useRef<{ w: number; key: string; nodes: LaidNode[]; edges: LaidEdge[] } | null>(null);
  const start = useRef<number | null>(null);
  const sceneRef = useRef(scene);
  const selRef = useRef(selected);
  useEffect(() => {
    sceneRef.current = scene;
    selRef.current = selected;
  });
  useEffect(() => {
    start.current = null;
  }, [scene.key, replay]);

  const ref = useCanvas(
    ({ ctx, width, height: H, t }) => {
      const sc = sceneRef.current;
      if (!laid.current || laid.current.w !== width || laid.current.key !== sc.key) {
        const L = layoutGraph(sc.root, width);
        laid.current = { w: width, key: sc.key, nodes: L.nodes, edges: L.edges };
      }
      const { nodes, edges } = laid.current;
      ctx.clearRect(0, 0, width, H);

      // Backward timeline.
      const bw = sc.backward;
      if (start.current === null) start.current = t;
      const total = bw ? bw.fire.length * STEP : 0;
      let at = t - start.current;
      if (bw && at > total + HOLD) {
        start.current = t;
        at = 0;
      }
      const fireIdx = new Map<Value, number>();
      bw?.fire.forEach((v, i) => fireIdx.set(v, i));
      // Gradient shown so far at each node: root starts at 1, others sum the pulses that have landed.
      const shown = new Map<Value, number>();
      const done = new Map<Value, boolean>();
      let maxC = 1e-9;
      if (bw) {
        shown.set(sc.root, 1);
        for (const [, cs] of bw.contrib) for (const c of cs) maxC = Math.max(maxC, Math.abs(c));
        bw.fire.forEach((v, i) => {
          if (at >= (i + 1) * STEP) {
            const cs = bw.contrib.get(v) ?? [];
            v.parents.forEach((p, j) => shown.set(p, (shown.get(p) ?? 0) + cs[j]));
          }
        });
        // A node is complete once every user has fired.
        for (const n of nodes) {
          const users = nodes.filter((m) => m.v.parents.includes(n.v));
          done.set(n.v, n.v === sc.root || (users.length > 0 && users.every((u) => at >= ((fireIdx.get(u.v) ?? 0) + 1) * STEP)));
        }
      }

      // Edges.
      for (const e of edges) {
        const fi = fireIdx.get(e.child.v);
        const landed = bw && fi !== undefined && at >= (fi + 1) * STEP;
        const c = bw?.contrib.get(e.child.v)?.[e.index] ?? 0;
        ctx.beginPath();
        for (let s = 0; s <= 16; s++) {
          const [x, y] = bezier(e, s / 16);
          if (s) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.strokeStyle = landed ? grey(0.92) : grey(0.24);
        ctx.lineWidth = landed ? 1 + 2.4 * Math.min(1, Math.abs(c) / maxC) : 1;
        ctx.stroke();

        // Ambient forward flow: values climbing towards the output.
        const f = (t * 0.32 + hash(e.child.v.id * 7 + e.index)) % 1;
        const [fx, fy] = bezier(e, f);
        ctx.fillStyle = grey(0.42);
        ctx.beginPath();
        ctx.arc(fx, fy, 1.3, 0, Math.PI * 2);
        ctx.fill();

        // Backward pulse: gradient falling from the child to this input.
        if (bw && fi !== undefined) {
          const ph = (at - fi * STEP) / STEP;
          if (ph >= 0 && ph < 1) {
            const [px, py] = bezier(e, 1 - ph);
            ctx.save();
            ctx.shadowColor = grey(1, 0.9);
            ctx.shadowBlur = 10;
            ctx.fillStyle = grey(1);
            ctx.beginPath();
            ctx.arc(px, py, 2.4 + 2 * Math.min(1, Math.abs(c) / maxC), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      }

      // Local derivative labels on edges.
      const sel = selRef.current;
      if (sc.local) {
        const all = nodes.length <= 22;
        setFont(ctx, 9.5, 500, "condensed");
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (const e of edges) {
          if (!all && e.child.v !== sel) continue;
          const d = sc.local.get(e.child.v)?.[e.index];
          if (d === undefined) continue;
          const [mx, my] = bezier(e, 0.42);
          const txt = fmtNum(d);
          const w = ctx.measureText(txt).width + 6;
          ctx.fillStyle = grey(0.05);
          ctx.fillRect(mx - w / 2, my - 6, w, 12);
          ctx.fillStyle = grey(0.62);
          ctx.fillText(txt, mx, my);
        }
      }

      // Nodes.
      for (const n of nodes) {
        const v = n.v;
        const lit = bw ? done.get(v) : false;
        const x = n.x - n.w / 2, y = n.y - n.h / 2;
        ctx.beginPath();
        ctx.roundRect(x, y, n.w, n.h, n.small ? n.h / 2 : 11);
        ctx.fillStyle = lit ? grey(1) : grey(0.04);
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = lit ? grey(1) : v.op === "leaf" ? grey(0.7) : grey(0.3);
        if (v.op === "leaf" && !lit) ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
        if (v === sel) {
          ctx.beginPath();
          ctx.roundRect(x - 4, y - 4, n.w + 8, n.h + 8, n.small ? n.h / 2 + 4 : 14);
          ctx.strokeStyle = grey(1);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = lit ? grey(0) : grey(1);
        if (n.small) {
          setFont(ctx, 10.5, 600, "condensed");
          ctx.fillText(nodeTitle(v), n.x, n.y + 0.5);
        } else {
          setFont(ctx, v.op === "leaf" ? 14 : 15, 800, "expanded");
          ctx.fillText(nodeTitle(v), n.x, n.y - 7);
          setFont(ctx, 10, 500, "condensed");
          ctx.fillStyle = lit ? grey(0.35) : grey(0.55);
          ctx.fillText(fmtNum(v.data), n.x, n.y + 10);
        }
        // Gradient tag under the node.
        if (!n.small) {
          setFont(ctx, 10, 600, "condensed");
          const g = shown.get(v);
          if (bw && g !== undefined) {
            const txt = `∇ ${fmtNum(g)}`;
            ctx.fillStyle = lit ? grey(1) : grey(0.6);
            ctx.fillText(txt, n.x, n.y + n.h / 2 + 10);
          } else if (!bw) {
            ctx.strokeStyle = grey(0.28);
            ctx.setLineDash([2, 3]);
            ctx.strokeRect(n.x - 15, n.y + n.h / 2 + 4, 30, 12);
            ctx.setLineDash([]);
            ctx.fillStyle = grey(0.35);
            ctx.fillText("∇ ?", n.x, n.y + n.h / 2 + 10.5);
          }
        }
      }
    },
    { fps: 40 },
  );

  return (
    <canvas
      ref={ref}
      style={{ height }}
      className="block w-full touch-manipulation"
      role="img"
      aria-label="Computation graph. Tap a node to inspect it."
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        const hit = laid.current?.nodes.find((n) => Math.abs(x - n.x) <= n.w / 2 + 6 && Math.abs(y - n.y) <= n.h / 2 + 6);
        onSelect(hit?.v ?? null);
      }}
    />
  );
}

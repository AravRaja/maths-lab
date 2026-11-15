"use client";

import { useMemo, useRef, useState } from "react";
import { Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Sheet } from "@/kit/components/page-shell";
import { CoreError, CorePanel, runCore } from "@/kit/components/core-guard";
import { useCanvas } from "@/kit/components/use-canvas";
import { grey } from "@/kit/canvas";
import { gramSchmidt, projectOnto } from "../core/projection";
import { pca } from "../core/pca";
import { galaxy, rawSpan, type V3 } from "../lib/cloud";
import { font } from "./canvas-font";
import { Field, Pills, Readout, Waiting, sliderValue } from "./ui-bits";

const X = galaxy();
const N = X.rows;
const pts: V3[] = Array.from({ length: N }, (_, i) => [X.data[i * 3], X.data[i * 3 + 1], X.data[i * 3 + 2]]);

type Dim = 1 | 2;

/**
 * Drop a cloud onto a plane (or a line). The user's gramSchmidt() turns two skewed spanning
 * vectors into an orthonormal pair; projectOnto() casts every point's shadow. Residuals are the
 * thin lines; their mean square is what PCA minimises.
 */
export function ShadowLab() {
  const [tilt, setTilt] = useState(0.5);
  const [turn, setTurn] = useState(2.2);
  const [dim, setDim] = useState<Dim>(2);
  const [fitted, setFitted] = useState<Float64Array[] | null>(null);
  const cam = useRef({ yaw: 0.6, pitch: 0.42, drag: null as null | { x: number; y: number; yaw: number; pitch: number }, auto: true });

  const raw = useMemo(() => rawSpan(tilt, turn), [tilt, turn]);
  const Q = useMemo(
    () => (fitted ? runCore(() => fitted) : runCore(() => gramSchmidt(dim === 2 ? [Float64Array.from(raw.a), Float64Array.from(raw.b)] : [Float64Array.from(raw.a)]))),
    [raw, dim, fitted],
  );
  const shadows = useMemo(() => {
    if (Q.status !== "ok") return null;
    return runCore(() => pts.map((p) => projectOnto(Q.value, Float64Array.from(p))));
  }, [Q]);
  const msr = useMemo(() => {
    if (shadows?.status !== "ok") return null;
    let s = 0;
    shadows.value.forEach((q, i) => (s += (pts[i][0] - q[0]) ** 2 + (pts[i][1] - q[1]) ** 2 + (pts[i][2] - q[2]) ** 2));
    return s / N;
  }, [shadows]);
  const best = useMemo(() => runCore(() => pca(X, 3)), []);
  const floor = best.status === "ok" ? best.value.variances.slice(dim).reduce((a, b) => a + b, 0) * ((N - 1) / N) : null;

  const ref = useCanvas(
    ({ ctx, width, height, t, dt, pointer }) => {
      const c = cam.current;
      if (pointer?.down) {
        if (!c.drag) c.drag = { x: pointer.x, y: pointer.y, yaw: c.yaw, pitch: c.pitch };
        c.yaw = c.drag.yaw + (pointer.x - c.drag.x) * 0.01;
        c.pitch = Math.max(-1.3, Math.min(1.3, c.drag.pitch + (pointer.y - c.drag.y) * 0.01));
        c.auto = false;
      } else {
        c.drag = null;
        if (c.auto) c.yaw += dt * 0.25;
      }
      void t;
      const s = Math.min(width, height) * 0.3;
      const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
      const P = (p: ArrayLike<number>): [number, number, number] => {
        // z-up world: yaw about z, then pitch about the screen x-axis.
        const x1 = p[0] * cy - p[1] * sy;
        const y1 = p[0] * sy + p[1] * cy;
        const z1 = p[2];
        const y2 = y1 * cp - z1 * sp; // depth
        const z2 = y1 * sp + z1 * cp;
        return [width / 2 + x1 * s, height / 2 - z2 * s, y2];
      };
      ctx.fillStyle = grey(0);
      ctx.fillRect(0, 0, width, height);

      const q = Q.status === "ok" ? Q.value : null;
      // Subspace: a grid for a plane, a long line for a line.
      ctx.lineWidth = 1;
      if (q && q.length === 2) {
        ctx.strokeStyle = grey(0.2);
        for (let i = -4; i <= 4; i++) {
          const f = i * 0.4;
          seg(ctx, P(add(scale(q[0], f), scale(q[1], -1.6))), P(add(scale(q[0], f), scale(q[1], 1.6))));
          seg(ctx, P(add(scale(q[1], f), scale(q[0], -1.6))), P(add(scale(q[1], f), scale(q[0], 1.6))));
        }
      } else if (q && q.length === 1) {
        ctx.strokeStyle = grey(0.35);
        seg(ctx, P(scale(q[0], -2.4)), P(scale(q[0], 2.4)));
      }

      // Residuals.
      const sh = shadows?.status === "ok" ? shadows.value : null;
      if (sh) {
        ctx.strokeStyle = grey(0.5, 0.35);
        for (let i = 0; i < N; i++) seg(ctx, P(pts[i]), P(sh[i]));
      }
      // Points, shaded by depth.
      for (let i = 0; i < N; i++) {
        const [x, y, d] = P(pts[i]);
        ctx.fillStyle = grey(0.45 + 0.4 * Math.max(-1, Math.min(1, -d / 1.6)));
        ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      }
      if (sh) {
        ctx.fillStyle = grey(1);
        for (let i = 0; i < N; i++) {
          const [x, y] = P(sh[i]);
          ctx.fillRect(x - 1, y - 1, 2, 2);
        }
      }
      // Spanning vectors: raw (dashed) and orthonormal (solid).
      const o = P([0, 0, 0]);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = grey(0.6);
      if (!fitted) {
        arrow(ctx, o, P(raw.a));
        if (dim === 2) arrow(ctx, o, P(raw.b));
      }
      ctx.setLineDash([]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = grey(1);
      q?.forEach((v) => arrow(ctx, o, P(v)));
      ctx.lineWidth = 1;
      font(ctx, 10, 500, "condensed");
      ctx.fillStyle = grey(0.55);
      ctx.fillText(fitted ? "PCA FIT · SOLID = q₁, q₂" : "DASHED = a, b · SOLID = YOUR q₁, q₂", 10, height - 10);
    },
    { fps: 30 },
    [Q, shadows, raw, dim, fitted],
  );

  const fit = () => {
    const r = runCore(() => pca(X, dim).components);
    if (r.status === "ok") setFitted(r.value);
  };

  return (
    <div className="flex flex-col gap-4">
      <Sheet className="flex flex-col gap-4 p-0 sm:p-0">
        <canvas ref={ref} aria-label="point cloud projected onto a plane" className="block aspect-[4/3] w-full cursor-grab touch-none rounded-t-2xl" />
        <div className="flex flex-col gap-4 px-4 pb-4 sm:px-5 sm:pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Pills label="subspace" value={dim} options={[2, 1] as Dim[]} onChange={(d) => { setDim(d); setFitted(null); }} render={(d) => (d === 2 ? "Plane" : "Line")} />
            {best.status === "ok" ? (
              <Button variant="outline" className="min-h-11" onClick={fit}>
                <Crosshair className="size-4" aria-hidden /> Best {dim === 2 ? "plane" : "line"} (your PCA)
              </Button>
            ) : (
              <Waiting>Best fit lights up at M5</Waiting>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tilt" value={`${((tilt * 180) / Math.PI).toFixed(0)}°`}>
              <Slider min={0} max={Math.PI} step={0.01} value={[tilt]} onValueChange={(v) => { setTilt(sliderValue(v)); setFitted(null); }} aria-label="tilt" />
            </Field>
            <Field label="Turn" value={`${((turn * 180) / Math.PI).toFixed(0)}°`}>
              <Slider min={0} max={Math.PI * 2} step={0.01} value={[turn]} onValueChange={(v) => { setTurn(sliderValue(v)); setFitted(null); }} aria-label="turn" />
            </Field>
          </div>
        </div>
      </Sheet>
      {Q.status === "missing" ? (
        <CorePanel error={Q.missing} />
      ) : Q.status === "error" ? (
        <CoreError error={Q.error} />
      ) : shadows?.status === "missing" ? (
        <CorePanel error={shadows.missing} />
      ) : shadows?.status === "error" ? (
        <CoreError error={shadows.error} />
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <Readout label="Mean squared residual" value={msr !== null ? msr.toFixed(4) : "—"} sub={`${N} points`} />
          <Readout label="Best possible" value={floor !== null ? floor.toFixed(4) : "—"} sub={floor !== null ? "sum of the dropped variances" : "needs pca()"} />
        </div>
      )}
    </div>
  );
}

const scale = (v: ArrayLike<number>, f: number): V3 => [v[0] * f, v[1] * f, v[2] * f];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

function seg(ctx: CanvasRenderingContext2D, a: number[], b: number[]) {
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

function arrow(ctx: CanvasRenderingContext2D, a: number[], b: number[]) {
  seg(ctx, a, b);
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const h = 8;
  ctx.beginPath();
  ctx.moveTo(b[0], b[1]);
  ctx.lineTo(b[0] - h * Math.cos(ang - 0.4), b[1] - h * Math.sin(ang - 0.4));
  ctx.moveTo(b[0], b[1]);
  ctx.lineTo(b[0] - h * Math.cos(ang + 0.4), b[1] - h * Math.sin(ang + 0.4));
  ctx.stroke();
}

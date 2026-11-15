"use client";

import { useMemo, useRef } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { CorePanel } from "@/kit/components/core-guard";
import { Sheet } from "@/kit/components/page-shell";
import { useCanvas } from "@/kit/components/use-canvas";
import { Ghost } from "@/kit/components/yours-to-write";
import { grey } from "@/kit/canvas";
import { conditionalPath, conditionalVelocity } from "../core/path";
import { SIGMA_MIN } from "../lib/config";
import { gaussVec, mulberry32 } from "../lib/rng";
import { useShape } from "../lib/shape-store";
import { makeView } from "../lib/view";
import { Kicker } from "./chip";
import { clear, drawArrow, drawGrid, drawPoints, label, offscreen } from "./draw";
import { usePlay } from "./use-play";
import { useFlowCores } from "./use-flow-cores";
import { GhostCanvas } from "./ghosts";

const PAIRS = 90;

/*
 * M1: one noise sample, one data point, one straight line. Drag the two big handles; scrub t.
 * Every faint line is another (x₀, x₁) pair: they cross everywhere, which is the whole problem
 * milestone 2 solves.
 */
export function PairSection() {
  const cores = useFlowCores();
  const shape = useShape();
  const { t, setT, tRef, playing, setPlaying } = usePlay(0.5, 2.6);
  const handles = useRef<{ x0: [number, number]; x1: [number, number]; drag: 0 | 1 | null }>({ x0: [-1.4, -1.1], x1: [1.1, 1.2], drag: null });

  const pairs = useMemo(() => {
    const rng = mulberry32(17);
    return Array.from({ length: PAIRS }, () => ({ x0: gaussVec(rng, 2), x1: shape.points[Math.floor(rng() * shape.points.length)] as number[] }));
  }, [shape]);

  const ok = cores && !cores.path;

  const ref = useCanvas(
    ({ ctx, width, height }) => {
      if (!ok || offscreen(ctx)) return;
      const v = makeView(width, height, 2.3, 4);
      const tt = tRef.current;
      clear(ctx, width, height);
      drawGrid(ctx, v, width, height);
      drawPoints(ctx, v, shape.points, 1.5, grey(1, 0.28));
      ctx.lineWidth = 1;
      ctx.strokeStyle = grey(1, 0.13);
      ctx.beginPath();
      for (const p of pairs) {
        const a = conditionalPath(p.x0, p.x1, 0, SIGMA_MIN);
        const b = conditionalPath(p.x0, p.x1, 1, SIGMA_MIN);
        ctx.moveTo(v.x(a[0]), v.y(a[1]));
        ctx.lineTo(v.x(b[0]), v.y(b[1]));
      }
      ctx.stroke();
      ctx.fillStyle = grey(1, 0.85);
      for (const p of pairs) {
        const xt = conditionalPath(p.x0, p.x1, tt, SIGMA_MIN);
        ctx.beginPath();
        ctx.arc(v.x(xt[0]), v.y(xt[1]), 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // The highlighted pair.
      const { x0, x1 } = handles.current;
      const xt = conditionalPath(x0, x1, tt, SIGMA_MIN);
      const u = conditionalVelocity(x0, x1, SIGMA_MIN);
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = grey(1, 0.5);
      ctx.beginPath();
      ctx.moveTo(v.x(x0[0]), v.y(x0[1]));
      ctx.lineTo(v.x(x1[0]), v.y(x1[1]));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = grey(1);
      ctx.beginPath();
      ctx.arc(v.x(x0[0]), v.y(x0[1]), 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = grey(1);
      ctx.beginPath();
      ctx.arc(v.x(x1[0]), v.y(x1[1]), 7, 0, Math.PI * 2);
      ctx.fill();
      label(ctx, "x₀", v.x(x0[0]) + 12, v.y(x0[1]) - 6, "left", 0.9, false);
      label(ctx, "x₁", v.x(x1[0]) + 12, v.y(x1[1]) - 6, "left", 0.9, false);
      ctx.lineWidth = 2.5;
      const k = 0.3;
      drawArrow(ctx, v.x(xt[0]), v.y(xt[1]), v.x(xt[0] + k * u[0]), v.y(xt[1] + k * u[1]), 9);
      ctx.fillStyle = grey(0);
      ctx.strokeStyle = grey(1);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(v.x(xt[0]), v.y(xt[1]), 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = grey(0, 0.75);
      ctx.fillRect(8, height - 48, 210, 40);
      label(ctx, `xₜ = (${xt[0].toFixed(2)}, ${xt[1].toFixed(2)})`, 14, height - 44, "left", 0.9, false);
      label(ctx, `uₜ = (${u[0].toFixed(2)}, ${u[1].toFixed(2)})`, 14, height - 27, "left", 0.9, false);
      label(ctx, `t = ${tt.toFixed(2)}`, width - 12, 12, "right", 0.9);
    },
    { animate: true, fps: 40 },
    [ok, shape, pairs],
  );

  if (!cores) return <Ghost label="loading" className="aspect-square w-full" />;
  if (cores.path) return <CorePanel error={cores.path} ghost={<GhostCanvas kind="lines" />} />;

  const hit = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const v = makeView(r.width, r.height, 2.3, 4);
    const px = e.clientX - r.left, py = e.clientY - r.top;
    return { v, px, py };
  };

  return (
    <Sheet className="flex flex-col gap-4">
      <canvas
        ref={ref}
        aria-label="Straight conditional paths from noise to data"
        className="aspect-square w-full touch-none rounded-xl border border-rule"
        onPointerDown={(e) => {
          const { v, px, py } = hit(e);
          const h = handles.current;
          const d0 = Math.hypot(v.x(h.x0[0]) - px, v.y(h.x0[1]) - py);
          const d1 = Math.hypot(v.x(h.x1[0]) - px, v.y(h.x1[1]) - py);
          if (Math.min(d0, d1) < 32) {
            h.drag = d0 < d1 ? 0 : 1;
            e.currentTarget.setPointerCapture(e.pointerId);
          }
        }}
        onPointerMove={(e) => {
          const h = handles.current;
          if (h.drag === null) return;
          const { v, px, py } = hit(e);
          const w = v.toWorld(px, py).map((c) => Math.max(-2.2, Math.min(2.2, c))) as [number, number];
          if (h.drag === 0) h.x0 = w;
          else h.x1 = w;
        }}
        onPointerUp={() => (handles.current.drag = null)}
        onPointerCancel={() => (handles.current.drag = null)}
      />
      <div className="flex items-center gap-3">
        <Button size="icon" variant="outline" aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying(!playing)}>
          {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
        </Button>
        <div className="min-w-0 flex-1">
          <Slider
            aria-label="Flow time t"
            min={0}
            max={1}
            step={0.01}
            value={[t]}
            onValueChange={(x) => {
              setPlaying(false);
              setT(Array.isArray(x) ? x[0] : x);
            }}
          />
        </div>
        <span className="type-wide w-12 text-right tabular-nums">{t.toFixed(2)}</span>
      </div>
      <Kicker>Drag x₀ and x₁. The arrow is your u_t; watch whether it changes as t moves.</Kicker>
    </Sheet>
  );
}

"use client";

import { useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { CorePanel, CoreError } from "@/kit/components/core-guard";
import { Sheet } from "@/kit/components/page-shell";
import { useCanvas } from "@/kit/components/use-canvas";
import { Ghost } from "@/kit/components/yours-to-write";
import { grey } from "@/kit/canvas";
import { isNotYoursYet } from "@/kit/not-yours-yet";
import { conditionalPath } from "../core/path";
import { marginalVelocity } from "../core/marginal";
import { eulerStep } from "../core/euler";
import { SIGMA_MIN } from "../lib/config";
import { gaussVec, mulberry32 } from "../lib/rng";
import { useShape } from "../lib/shape-store";
import { makeView } from "../lib/view";
import { Kicker } from "./chip";
import { DensityImage } from "./density";
import { clear, drawArrow, drawPoints, label, offscreen } from "./draw";
import { usePlay } from "./use-play";
import { useFlowCores } from "./use-flow-cores";
import { GhostCanvas } from "./ghosts";

const GRID = 15;
const SAMPLES = 3500;

/*
 * M2: the exact marginal field for your dataset, no network. Arrows: your marginalVelocity on a grid.
 * Behind them: p_t, drawn from samples of your conditionalPath. Tap to drop a probe; once eulerStep
 * exists it traces where the probe flows from this t to t = 1.
 */
export function FieldSection() {
  const cores = useFlowCores();
  const shape = useShape();
  const { t, setT, tRef, playing, setPlaying } = usePlay(0.35, 4);
  const probe = useRef<[number, number] | null>([-1.2, -0.9]);
  const [err, setErr] = useState<Error | null>(null);
  const density = useRef<DensityImage | null>(null);
  const lastT = useRef(-1);

  const data = useMemo(() => shape.points.filter((_, i) => i % 2 === 0), [shape]);
  const noise = useMemo(() => {
    const rng = mulberry32(5);
    return Array.from({ length: SAMPLES }, () => ({ x0: gaussVec(rng, 2), i: Math.floor(rng() * shape.points.length) }));
  }, [shape]);

  const ok = cores && !cores.marginal;

  const ref = useCanvas(
    ({ ctx, width, height }) => {
      if (!ok || err || offscreen(ctx)) return;
      const v = makeView(width, height, 2.3, 0);
      const tt = Math.min(0.995, tRef.current);
      clear(ctx, width, height);
      try {
        if (cores && !cores.path) {
          if (!density.current) density.current = new DensityImage();
          if (Math.abs(lastT.current - tt) > 1e-4) {
            density.current.build(noise.map((n) => conditionalPath(n.x0, shape.points[n.i], tt, SIGMA_MIN)));
            lastT.current = tt;
          }
          density.current.draw(ctx, v);
        }
        drawPoints(ctx, v, data, 1.4, grey(1, 0.25));
        const cell = (2 * 2.1) / (GRID - 1);
        const vecs: { x: number; y: number; u: number[]; m: number }[] = [];
        let max = 0;
        for (let i = 0; i < GRID; i++)
          for (let j = 0; j < GRID; j++) {
            const x = -2.1 + i * cell, y = -2.1 + j * cell;
            const u = marginalVelocity([x, y], tt, data, SIGMA_MIN);
            const m = Math.hypot(u[0], u[1]);
            max = Math.max(max, m);
            vecs.push({ x, y, u, m });
          }
        for (const a of vecs) {
          const len = Math.min(cell * 0.85, (a.m / (max || 1)) * cell * 1.6);
          const k = a.m > 0 ? len / a.m : 0;
          const g = 0.35 + 0.65 * Math.min(1, a.m / (max || 1) * 1.4);
          ctx.strokeStyle = ctx.fillStyle = grey(g);
          ctx.lineWidth = 1.3;
          drawArrow(ctx, v.x(a.x), v.y(a.y), v.x(a.x + a.u[0] * k), v.y(a.y + a.u[1] * k), 4);
        }
        // Probe trajectory.
        const p = probe.current;
        if (p) {
          ctx.fillStyle = grey(1);
          ctx.beginPath();
          ctx.arc(v.x(p[0]), v.y(p[1]), 5, 0, Math.PI * 2);
          ctx.fill();
          if (cores && !cores.euler) {
            const vel = (x: number[], s: number) => marginalVelocity(x, s, data, SIGMA_MIN);
            let x = [...p];
            const n = 40;
            const dt = (1 - tt) / n;
            ctx.strokeStyle = grey(1);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(v.x(x[0]), v.y(x[1]));
            for (let k = 0; k < n; k++) {
              x = eulerStep(vel, x, tt + k * dt, dt);
              ctx.lineTo(v.x(x[0]), v.y(x[1]));
            }
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(v.x(x[0]), v.y(x[1]), 3.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.fillStyle = grey(0, 0.8);
        ctx.fillRect(0, 0, width, 30);
        label(ctx, `t = ${tt.toFixed(2)}`, width - 12, 10, "right", 0.9);
        label(ctx, cores?.path ? "arrows: uₜ(x)" : "arrows: uₜ(x)   dots: pₜ(x)", 12, 9, "left", 0.8, false);
      } catch (e) {
        if (!isNotYoursYet(e)) setErr(e instanceof Error ? e : new Error(String(e)));
      }
    },
    { animate: true, fps: 24 },
    [ok, err, shape, data, noise],
  );

  if (!cores) return <Ghost label="loading" className="aspect-square w-full" />;
  if (cores.marginal) return <CorePanel error={cores.marginal} ghost={<GhostCanvas kind="arrows" />} />;
  if (err) return <CoreError error={err} />;

  return (
    <Sheet className="flex flex-col gap-4">
      <canvas
        ref={ref}
        aria-label="Exact marginal velocity field"
        className="aspect-square w-full touch-none rounded-xl border border-rule"
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          probe.current = makeView(r.width, r.height, 2.3, 0).toWorld(e.clientX - r.left, e.clientY - r.top);
        }}
      />
      <div className="flex items-center gap-3">
        <Button size="icon" variant="outline" aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying(!playing)}>
          {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
        </Button>
        <div className="min-w-0 flex-1">
          <Slider
            aria-label="Flow time t"
            min={0}
            max={0.99}
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
      <Kicker>
        Tap anywhere to drop a probe.{cores.euler ? " Write eulerStep() to see where it flows." : " The line is where it flows by t = 1."}
      </Kicker>
    </Sheet>
  );
}

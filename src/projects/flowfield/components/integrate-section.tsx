"use client";

import { useMemo, useState } from "react";
import { LineChart } from "@/kit/components/charts";
import { CorePanel, CoreError, runCore } from "@/kit/components/core-guard";
import { Sheet } from "@/kit/components/page-shell";
import { Stat } from "@/kit/components/stat";
import { useCanvas } from "@/kit/components/use-canvas";
import { Ghost } from "@/kit/components/yours-to-write";
import { grey } from "@/kit/canvas";
import { marginalVelocity } from "../core/marginal";
import { sampleODE } from "../core/euler";
import { SIGMA_MIN } from "../lib/config";
import { gaussVec, mulberry32 } from "../lib/rng";
import { useShape } from "../lib/shape-store";
import { makeView } from "../lib/view";
import { Chip, Kicker } from "./chip";
import { clear, drawPoints, label, offscreen } from "./draw";
import { needs, useFlowCores } from "./use-flow-cores";
import { GhostCanvas } from "./ghosts";
import { meanNearest, straightness } from "./metrics";

const STEPS = [1, 2, 4, 8, 16, 48];
const P = 110;

/*
 * M3: integrate the exact field with your sampleODE. Few steps overshoot and blur the shape; many
 * steps land on it. The paths are visibly curved: the marginal field is not a straight-line flow.
 */
export function IntegrateSection() {
  const cores = useFlowCores();
  const shape = useShape();
  const [steps, setSteps] = useState(8);
  const missing = cores ? needs(cores, "marginal", "euler") : null;

  const data = useMemo(() => shape.points.filter((_, i) => i % 2 === 0), [shape]);
  const run = useMemo(() => {
    if (!cores || missing) return null;
    return runCore(() => {
      const rng = mulberry32(23);
      const x0s = Array.from({ length: P }, () => gaussVec(rng, 2));
      const v = (x: number[], t: number) => marginalVelocity(x, Math.min(t, 0.999), data, SIGMA_MIN);
      return STEPS.map((n) => {
        const paths = x0s.map((x0) => sampleODE(v, x0, n));
        const ends = paths.map((p) => p[p.length - 1]);
        return { n, paths, err: meanNearest(ends, data), straight: straightness(paths) };
      });
    });
  }, [cores, missing, data]);

  const cur = run?.status === "ok" ? run.value.find((r) => r.n === steps)! : null;

  const ref = useCanvas(
    ({ ctx, width, height, t }) => {
      if (!cur || offscreen(ctx)) return;
      const v = makeView(width, height, 2.3, 0);
      clear(ctx, width, height);
      drawPoints(ctx, v, data, 1.4, grey(1, 0.3));
      const head = ((t * 0.45) % 1.3) / 1; // 0..1.3, hold at the end
      const h = Math.min(1, head);
      ctx.lineWidth = 1;
      for (const p of cur.paths) {
        ctx.strokeStyle = grey(1, 0.16);
        ctx.beginPath();
        p.forEach((x, i) => (i ? ctx.lineTo(v.x(x[0]), v.y(x[1])) : ctx.moveTo(v.x(x[0]), v.y(x[1]))));
        ctx.stroke();
        // comet head along the path
        const f = h * (p.length - 1);
        const i = Math.min(p.length - 2, Math.floor(f));
        const a = p[i], b = p[i + 1] ?? p[i];
        const u = f - i;
        const x = a[0] + u * (b[0] - a[0]), y = a[1] + u * (b[1] - a[1]);
        ctx.fillStyle = grey(1);
        ctx.fillRect(v.x(x) - 1.5, v.y(y) - 1.5, 3, 3);
      }
      label(ctx, `${steps} euler step${steps > 1 ? "s" : ""} · t = ${h.toFixed(2)}`, 12, 12, "left", 0.9);
    },
    { animate: true, fps: 30 },
    [cur, data, steps],
  );

  if (!cores) return <Ghost label="loading" className="aspect-square w-full" />;
  if (missing) return <CorePanel error={missing} ghost={<GhostCanvas kind="paths" />} />;
  if (run?.status === "error") return <CoreError error={run.error} />;
  if (run?.status === "missing") return <CorePanel error={run.missing} />;

  return (
    <Sheet className="flex flex-col gap-4">
      <canvas ref={ref} aria-label="Euler trajectories through the exact field" className="aspect-square w-full rounded-xl border border-rule" />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Euler steps">
        {STEPS.map((n) => (
          <Chip key={n} active={n === steps} onClick={() => setSteps(n)} className="type-wide tabular-nums">
            {n}
          </Chip>
        ))}
      </div>
      {cur && (
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Miss distance" value={cur.err} decimals={3} />
          <Stat label="Path / chord" value={cur.straight} decimals={3} />
        </div>
      )}
      {run?.status === "ok" && (
        <div>
          <Kicker className="mb-2">Mean distance from sample to nearest data point, by steps</Kicker>
          <LineChart series={[{ label: "miss", data: run.value.map((r) => [Math.log2(r.n), r.err] as [number, number]) }]} logY height={180} xLabel="log₂ steps" />
        </div>
      )}
    </Sheet>
  );
}

"use client";

import { useRef, useState } from "react";
import { CorePanel } from "@/kit/components/core-guard";
import { Sheet } from "@/kit/components/page-shell";
import { Slider } from "@/components/ui/slider";
import { HOME, LINKS, REACH } from "@/projects/say-and-reach/lib/arm/config";
import { useAvailability } from "@/projects/say-and-reach/lib/arm/availability";
import { grey } from "@/kit/canvas";
import { makeRng } from "@/projects/say-and-reach/lib/arm/rng";
import { randomObjects, type Obj } from "@/projects/say-and-reach/lib/arm/world";
import { drawArm, drawObjects, drawTable, toPx } from "./draw";
import { jointsOrNull } from "./render";
import { TableCanvas } from "./table-canvas";

/** M1: joint sliders drive the user's forwardKinematics. */
export function PoseSection() {
  const avail = useAvailability();
  const [theta, setTheta] = useState<number[]>(HOME);
  const objs = useRef<Obj[] | null>(null);
  const tipEl = useRef<HTMLParagraphElement>(null);

  if (avail?.fk) return <CorePanel error={avail.fk} ghost={<TableCanvas animate={false} />} />;

  return (
    <div className="flex flex-col gap-4">
      <TableCanvas
        label="Arm posed by the joint sliders"
        draw={({ ctx, v, buf, t }) => {
          ctx.fillStyle = grey(0);
          ctx.fillRect(0, 0, v.width, v.height);
          drawTable(ctx, v, buf, t);
          objs.current ??= randomObjects(makeRng(11));
          drawObjects(ctx, v, objs.current);
          const j = jointsOrNull(theta);
          if (!j) return;
          // Reach circle and per-joint angle arcs.
          const [bx, by] = toPx(v, 0, 0);
          ctx.strokeStyle = grey(1, 0.25);
          ctx.setLineDash([2, 6]);
          ctx.beginPath();
          ctx.arc(bx, by, REACH * v.s, Math.PI, 0);
          ctx.stroke();
          ctx.setLineDash([]);
          let phi = 0;
          j.slice(0, -1).forEach(([x, y], i) => {
            const [px, py] = toPx(v, x, y);
            const r = 16 + i * 2;
            ctx.strokeStyle = grey(1, 0.6);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(px, py, r, -phi, -(phi + theta[i]), theta[i] > 0);
            ctx.stroke();
            phi += theta[i];
          });
          drawArm(ctx, v, j);
          const tip = j[j.length - 1];
          const txt = `tip (${tip[0].toFixed(3)}, ${tip[1].toFixed(3)}) m`;
          if (tipEl.current && tipEl.current.textContent !== txt) tipEl.current.textContent = txt;
        }}
      />
      <Sheet className="flex flex-col gap-1">
        <p ref={tipEl} className="type-wide text-lg tabular-nums">tip</p>
        {theta.map((th, i) => (
          <div key={i}>
            <div className="flex items-baseline justify-between">
              <span className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">
                θ{i + 1} · link {LINKS[i]} m
              </span>
              <span className="font-mono text-sm tabular-nums">{th.toFixed(2)} rad</span>
            </div>
            <Slider
              min={-Math.PI}
              max={Math.PI}
              step={0.01}
              value={th}
              aria-label={`Joint ${i + 1} angle`}
              onValueChange={(val) => {
                const x = Array.isArray(val) ? val[0] : val;
                setTheta((old) => old.map((o, k) => (k === i ? x : o)));
              }}
            />
          </div>
        ))}
      </Sheet>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { CorePanel, CoreError } from "@/kit/components/core-guard";
import { LineChart } from "@/kit/components/charts";
import { Sheet } from "@/kit/components/page-shell";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { jacobian } from "@/projects/say-and-reach/core/kinematics";
import { dlsStep } from "@/projects/say-and-reach/core/ik";
import { HOME, LINKS } from "@/projects/say-and-reach/lib/arm/config";
import { useAvailability } from "@/projects/say-and-reach/lib/arm/availability";
import { grey } from "@/kit/canvas";
import { tipOf } from "@/projects/say-and-reach/lib/arm/world";
import { drawArm, drawManipulability, drawTable, toPx } from "./draw";
import { jointsOrNull } from "./render";
import { TableCanvas } from "./table-canvas";

/*
 * M2: tap the table and the arm reaches there with the user's jacobian + dlsStep, one
 * damped-least-squares iteration per frame, so the convergence is visible. The ellipse is
 * J Jᵀ: long where the fingertip moves easily, flat near singular poses.
 */

interface ReachState {
  theta: number[];
  target: [number, number];
  errs: number[];
  iter: number;
}

export function ReachSection() {
  const avail = useAvailability();
  const [lambda, setLambda] = useState(0.06);
  const [errs, setErrs] = useState<number[]>([]);
  const [stats, setStats] = useState({ iter: 0, err: 0, sigmaMin: 1 });
  const [crash, setCrash] = useState<Error | null>(null);
  const st = useRef<ReachState>({ theta: HOME.slice(), target: [-0.45, 0.85], errs: [], iter: 0 });
  const lam = useRef(lambda);
  useEffect(() => {
    lam.current = lambda;
  }, [lambda]);

  // Push the error history to React a few times a second, not every frame.
  useEffect(() => {
    const id = window.setInterval(() => {
      const s = st.current;
      setErrs(s.errs.slice());
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  if (avail?.ik) return <CorePanel error={avail.ik} ghost={<TableCanvas animate={false} />} />;
  if (crash) return <CoreError error={crash} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <TableCanvas
          label="Tap to set a reach target"
          onPointer={(w) => {
            st.current.target = w;
            st.current.errs = [];
            st.current.iter = 0;
          }}
          draw={({ ctx, v, buf, t, dt }) => {
            ctx.fillStyle = grey(0);
            ctx.fillRect(0, 0, v.width, v.height);
            drawTable(ctx, v, buf, t, { goal: st.current.target, glow: 0.7 });
            const s = st.current;
            if (!avail) return;
            try {
              // ~15 IK iterations a second.
              s.iter += dt * 15;
              while (s.iter >= 1) {
                s.iter -= 1;
                const tip = tipOf(s.theta);
                const e = [s.target[0] - tip[0], s.target[1] - tip[1]];
                const err = Math.hypot(e[0], e[1]);
                if (err < 1e-5 && s.errs.length > 0) break;
                // Cap the step so a far tap animates instead of teleporting.
                const k = Math.min(1, 0.12 / Math.max(err, 1e-9));
                const d = dlsStep(jacobian(s.theta, LINKS), [e[0] * k, e[1] * k], lam.current);
                s.theta = s.theta.map((th, i) => th + d[i]);
                s.errs.push(Math.max(err, 1e-9));
                if (s.errs.length > 120) s.errs.shift();
              }
              const j = jointsOrNull(s.theta);
              if (!j) return;
              const tip = j[j.length - 1];
              const { l1, l2 } = drawManipulability(ctx, v, tip, jacobian(s.theta, LINKS));
              drawArm(ctx, v, j);
              const [gx, gy] = toPx(v, s.target[0], s.target[1]);
              ctx.strokeStyle = grey(1);
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(gx - 7, gy);
              ctx.lineTo(gx + 7, gy);
              ctx.moveTo(gx, gy - 7);
              ctx.lineTo(gx, gy + 7);
              ctx.stroke();
              if (Math.random() < 0.1) setStats({ iter: s.errs.length, err: s.errs[s.errs.length - 1] ?? 0, sigmaMin: Math.sqrt(Math.max(0, l2 / Math.max(l1, 1e-12))) });
            } catch (e) {
              setCrash(e instanceof Error ? e : new Error(String(e)));
            }
          }}
        />
        <div className="pointer-events-none absolute top-3 left-3 flex gap-2">
          <Badge variant="outline" className="bg-paper/80">tap anywhere</Badge>
          {stats.sigmaMin < 0.08 && <Badge className="bg-ink text-paper">near singular</Badge>}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Sheet>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Damping λ</span>
            <span className="type-wide text-2xl tabular-nums">{lambda.toFixed(2)}</span>
          </div>
          <Slider min={0} max={0.5} step={0.01} value={lambda} aria-label="Damping lambda" onValueChange={(x) => setLambda(Array.isArray(x) ? x[0] : x)} />
          <p className="mt-2 text-sm text-ink-soft">
            λ = 0 is the pseudo-inverse: fastest, but it lurches near a stretched-out arm. Tap the far edge of the reach circle and compare.
          </p>
        </Sheet>
        <Sheet>
          <p className="type-narrow mb-2 text-xs tracking-[0.2em] text-ink-soft uppercase">Fingertip error per iteration</p>
          {errs.length > 1 ? <LineChart series={[{ label: "‖e‖ (m)", data: errs }]} logY height={150} yDomain={[1e-6, 1]} /> : <LineChart ghost series={[]} height={150} />}
        </Sheet>
      </div>
    </div>
  );
}

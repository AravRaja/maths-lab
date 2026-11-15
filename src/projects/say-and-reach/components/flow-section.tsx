"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Shuffle } from "lucide-react";
import { CorePanel, CoreError, runCore } from "@/kit/components/core-guard";
import { Sheet } from "@/kit/components/page-shell";
import { useCanvas } from "@/kit/components/use-canvas";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useAvailability } from "@/projects/say-and-reach/lib/arm/availability";
import { expertAction } from "@/projects/say-and-reach/lib/arm/expert";
import { embed, parseCommand } from "@/projects/say-and-reach/lib/arm/language";
import { flowPaths, gaussianAct } from "@/projects/say-and-reach/lib/arm/policy";
import { gauss, makeRng } from "@/projects/say-and-reach/lib/arm/rng";
import { usePolicies } from "@/projects/say-and-reach/lib/arm/store";
import { objectOf, observe, OBS_DIM, randomScene, type Scene } from "@/projects/say-and-reach/lib/arm/world";
import { grey } from "@/kit/canvas";
import { isNotYoursYet } from "@/kit/not-yours-yet";
import { cn } from "@/lib/utils";

/*
 * M4's payoff: the action plane. 160 noise samples flow (through the user's eulerSample)
 * into fingertip velocities for one frozen scene. The crosshairs are what the expert would do.
 * Pick a scene where the fingertip is dead ahead of the object and, with two-way demos, the
 * cloud has two places to go.
 */

const COMMANDS = ["push the cube down", "push the cube up", "slide the ball left", "touch the wedge"];
const K = 160;
const R = 1.5; // half-width of the plane, in action units

/** A scene with the cube right in front of the fingertip: the ambiguous case. */
function ambiguousScene(seed: number): Scene {
  const s = randomScene(makeRng(seed));
  const cube = objectOf(s, "cube");
  cube.x = Math.max(-0.6, Math.min(0.6, s.tip[0]));
  cube.y = Math.min(1.1, s.tip[1] + 0.3);
  for (const o of s.objects) if (o !== cube && Math.hypot(o.x - cube.x, o.y - cube.y) < 0.3) o.x = cube.x + (o.x > cube.x ? 0.4 : -0.4);
  return s;
}

export function FlowSection() {
  const avail = useAvailability();
  const policies = usePolicies();
  const [cmd, setCmd] = useState(COMMANDS[0]);
  const [seed, setSeed] = useState(3);
  const [steps, setSteps] = useState(8);
  // Needs forwardKinematics (for the fingertip); null until it is written.
  const scene = useMemo(() => runCore(() => ambiguousScene(seed)).value ?? null, [seed]);

  const result = useMemo(() => {
    if (!policies.flow || avail?.flow !== null || !scene) return null;
    const rng = makeRng(99);
    const noises = Array.from({ length: K }, () => [gauss(rng), gauss(rng)]);
    const obs = observe(scene, embed(cmd), new Float32Array(OBS_DIM));
    try {
      const paths = flowPaths(policies.flow, obs, noises, steps);
      const task = parseCommand(cmd);
      const experts = task ? [expertAction(scene, task, 1), ...(policies.twoWay ? [expertAction(scene, task, -1)] : [])] : [];
      const g = policies.gaussian ? gaussianAct(policies.gaussian, obs) : null;
      return { paths, experts, g, error: null };
    } catch (e) {
      return { paths: [], experts: [], g: null, error: e };
    }
  }, [policies.flow, policies.gaussian, policies.twoWay, avail, scene, cmd, steps]);

  const res = useRef(result);
  useEffect(() => {
    res.current = result;
  }, [result]);

  const ref = useCanvas(({ ctx, width, height, t }) => {
    ctx.fillStyle = grey(0);
    ctx.fillRect(0, 0, width, height);
    const s = Math.min(width, height) / (2 * R);
    const cx = width / 2, cy = height / 2;
    const P = (x: number, y: number): [number, number] => [cx + x * s, cy - y * s];
    // Grid, axes and the |a| = 1 speed limit.
    ctx.strokeStyle = grey(1, 0.08);
    ctx.lineWidth = 1;
    for (let g = -1; g <= 1; g += 0.5) {
      ctx.beginPath();
      ctx.moveTo(...P(g, -R));
      ctx.lineTo(...P(g, R));
      ctx.moveTo(...P(-R, g));
      ctx.lineTo(...P(R, g));
      ctx.stroke();
    }
    ctx.strokeStyle = grey(1, 0.3);
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const r = res.current;
    if (!r || !r.paths.length) {
      // Ghost: a breathing noise cloud.
      const rng = makeRng(5);
      for (let i = 0; i < K; i++) {
        const [x, y] = [gauss(rng) * 0.5, gauss(rng) * 0.5];
        const [px, py] = P(x * (1 + 0.05 * Math.sin(t + i)), y * (1 + 0.05 * Math.cos(t * 1.3 + i)));
        ctx.fillStyle = grey(1, 0.25);
        ctx.fillRect(px - 1, py - 1, 2, 2);
      }
      return;
    }
    // Animate t: 0 → 1 over 2.4 s, hold for 1 s.
    const cyc = (t % 3.4) / 2.4;
    const u = Math.min(1, cyc);
    const ease = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
    for (const p of r.paths) {
      const f = ease * (p.length - 1);
      const k = Math.min(p.length - 2, Math.floor(f));
      const w = f - k;
      ctx.strokeStyle = grey(1, 0.12);
      ctx.beginPath();
      ctx.moveTo(...P(p[0][0], p[0][1]));
      for (let i = 1; i <= k; i++) ctx.lineTo(...P(p[i][0], p[i][1]));
      const hx = p[k][0] + (p[k + 1][0] - p[k][0]) * w, hy = p[k][1] + (p[k + 1][1] - p[k][1]) * w;
      ctx.lineTo(...P(hx, hy));
      ctx.stroke();
      const [px, py] = P(hx, hy);
      ctx.fillStyle = grey(1, 0.4 + 0.6 * ease);
      ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
    }
    if (r.g) {
      const [mx, my] = P(r.g.mu[0], r.g.mu[1]);
      ctx.strokeStyle = grey(1, 0.8);
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.ellipse(mx, my, Math.exp(r.g.logStd[0]) * s, Math.exp(r.g.logStd[1]) * s, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const e of r.experts) {
      const [ex, ey] = P(e[0], e[1]);
      ctx.strokeStyle = grey(1);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ex, ey, 8, 0, Math.PI * 2);
      ctx.moveTo(ex - 13, ey);
      ctx.lineTo(ex - 4, ey);
      ctx.moveTo(ex + 4, ey);
      ctx.lineTo(ex + 13, ey);
      ctx.moveTo(ex, ey - 13);
      ctx.lineTo(ex, ey - 4);
      ctx.moveTo(ex, ey + 4);
      ctx.lineTo(ex, ey + 13);
      ctx.stroke();
    }
  }, { fps: 30 });

  if (avail?.flow) return <CorePanel error={avail.flow} ghost={<div className="aspect-square w-full bg-hatch" />} />;
  if (result?.error) {
    if (isNotYoursYet(result.error)) return <CorePanel error={result.error} />;
    return <CoreError error={result.error instanceof Error ? result.error : new Error(String(result.error))} />;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_15rem]">
      <div className="relative">
        <canvas ref={ref} role="img" aria-label="Noise samples flowing into actions" className="block aspect-square w-full touch-none rounded-2xl border border-rule bg-paper" />
        <span className="type-narrow pointer-events-none absolute top-3 left-3 text-[11px] tracking-[0.18em] text-ink-soft uppercase">action plane · vx, vy</span>
        {!policies.flow && (
          <span className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-sm text-ink-soft">Train the flow head (section 05) to see the cloud flow.</span>
        )}
      </div>
      <Sheet className="flex flex-col gap-3">
        <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Command</p>
        <div className="flex flex-col gap-2">
          {COMMANDS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCmd(c)}
              className={cn("min-h-11 rounded-xl border px-3 text-left text-sm transition-colors", c === cmd ? "border-ink bg-ink text-paper" : "border-rule text-ink-soft hover:border-ink")}
            >
              {c}
            </button>
          ))}
        </div>
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Euler steps</span>
            <span className="font-mono text-sm tabular-nums">{steps}</span>
          </div>
          <Slider min={1} max={32} step={1} value={steps} aria-label="Euler steps" onValueChange={(v) => setSteps(Array.isArray(v) ? v[0] : v)} />
        </div>
        <Button variant="outline" onClick={() => setSeed((x) => x + 1)}>
          <Shuffle /> New scene
        </Button>
        <p className="text-xs leading-snug text-ink-soft">
          Dots: samples. Crosshair{policies.twoWay ? "s" : ""}: the expert{policies.twoWay ? " (both ways round)" : ""}. Dashed ellipse: the Gaussian head&apos;s μ ± σ.
        </p>
      </Sheet>
    </div>
  );
}

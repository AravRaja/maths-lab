"use client";

import { useRef, useState } from "react";
import { Dices, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedSwitch } from "@/components/spectrumui/animated-switch";
import { LineChart } from "@/kit/components/charts";
import { CorePanel, CoreError } from "@/kit/components/core-guard";
import { Sheet } from "@/kit/components/page-shell";
import { Stat } from "@/kit/components/stat";
import { useCanvas } from "@/kit/components/use-canvas";
import { useWorker } from "@/kit/components/use-worker";
import { Ghost } from "@/kit/components/yours-to-write";
import { grey } from "@/kit/canvas";
import { isNotYoursYet, type NotYoursYet } from "@/kit/not-yours-yet";
import type { handlers, ReachRollout } from "../workers/flow.worker";
import { L1, L2, POST, fk, type P2 } from "../lib/reacher";
import { Chip, Kicker } from "./chip";
import { clear, label, offscreen } from "./draw";
import { emaSeries, useTrainLoop } from "./use-train-loop";
import { needs, useFlowCores } from "./use-flow-cores";
import { GhostCanvas } from "./ghosts";

type Policy = "flow" | "regression";
const CX = 0.85;
const HALF = 1.45;
const DENOISE_S = 1.6;
const STEP_HZ = 11;

function sceneView(w: number, h: number) {
  const s = Math.min(w, h) / 2 / HALF;
  return { x: (x: number) => w / 2 + (x - CX) * s, y: (y: number) => h / 2 - y * s, s };
}

/*
 * M6: the same flow-matching machinery, now on 16-dimensional action chunks (8 future joint moves of
 * a 2-link arm), conditioned on the arm's state and the target. Demonstrations go round the post on
 * either side. A flow samples one side or the other; a regression net trained on the same data with
 * the same squared error averages them, straight into the post.
 */
export function ReacherSection() {
  const cores = useFlowCores();
  const worker = useWorker<typeof handlers>(() => new Worker(new URL("../workers/flow.worker.ts", import.meta.url)));
  const [policy, setPolicy] = useState<Policy>("flow");
  const [ensemble, setEnsemble] = useState(false);
  const [step, setStep] = useState(0);
  const [flowL, setFlowL] = useState<[number, number][]>([]);
  const [regL, setRegL] = useState<[number, number][]>([]);
  const [missing, setMissing] = useState<NotYoursYet | null>(null);
  const [rollMissing, setRollMissing] = useState<NotYoursYet | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [score, setScore] = useState<{ flow?: number; regression?: number; busy?: number } | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const demos = useRef<{ tips: P2[][]; sides: number[] } | null>(null);
  const anim = useRef<{ roll: ReachRollout; t0: number; policy: Policy } | null>(null);
  const inited = useRef(false);
  const seed = useRef(1000);
  const clock = useRef(0);

  const trainMissing = cores ? needs(cores, "path", "loss") : null;

  const onErr = (e: unknown) => {
    if (isNotYoursYet(e)) setMissing(e as NotYoursYet);
    else setError(e instanceof Error ? e : new Error(String(e)));
  };

  const ensureInit = async () => {
    const w = worker.current;
    if (!w) throw new Error("worker not ready");
    if (!inited.current) {
      const r = await w.call("initReacher", { demos: 300, seed: 1 });
      demos.current = { tips: r.demoTips, sides: r.sides };
      inited.current = true;
    }
    return w;
  };

  const loop = useTrainLoop(async () => {
    const w = await ensureInit();
    const r = await w.call("trainReacher", { steps: 25, batch: 64 });
    setStep(r.step);
    setFlowL((p) => emaSeries(p, r.flowLoss, r.step - 24));
    setRegL((p) => emaSeries(p, r.regLoss, r.step - 24));
  }, onErr);

  const rollout = async () => {
    setRollMissing(null);
    try {
      const w = await ensureInit();
      const roll = await w.call("rollout", { seed: seed.current++, policy, ensemble, m: 0.25, previews: policy === "flow" ? 6 : 1, odeSteps: 10 });
      anim.current = { roll, t0: clock.current, policy };
      setOutcome(null);
      const total = (roll.denoise.length && policy === "flow" ? DENOISE_S : 0) + roll.tips.length / STEP_HZ;
      setTimeout(() => setOutcome(roll.collided ? "Hit the post" : roll.success ? "Reached the target" : "Ran out of time"), total * 1000);
    } catch (e) {
      if (isNotYoursYet(e)) setRollMissing(e as NotYoursYet);
      else setError(e instanceof Error ? e : new Error(String(e)));
    }
  };

  const evaluate = async () => {
    setRollMissing(null);
    try {
      const w = await ensureInit();
      const out: { flow?: number; regression?: number; busy?: number } = { busy: 0 };
      setScore({ ...out });
      for (const p of ["regression", "flow"] as const) {
        const r = await w.call("evaluate", { n: 30, seed: 7, policy: p, ensemble, m: 0.25, odeSteps: 10 }, (v) => setScore({ ...out, busy: v as number }));
        out[p] = r.success;
        setScore({ ...out });
      }
      setScore({ ...out, busy: undefined });
    } catch (e) {
      setScore(null);
      if (isNotYoursYet(e)) setRollMissing(e as NotYoursYet);
      else setError(e instanceof Error ? e : new Error(String(e)));
    }
  };

  const ref = useCanvas(
    ({ ctx, width, height, t }) => {
      clock.current = t;
      if (t > 0 && offscreen(ctx)) return;
      const v = sceneView(width, height);
      clear(ctx, width, height);
      // reach annulus
      ctx.setLineDash([3, 6]);
      ctx.strokeStyle = grey(1, 0.12);
      ctx.lineWidth = 1;
      for (const r of [L1 + L2, L1 - L2]) {
        ctx.beginPath();
        ctx.arc(v.x(0), v.y(0), r * v.s, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      const a = anim.current;

      // demos
      const d = demos.current;
      if (d) {
        ctx.lineWidth = 1;
        d.tips.forEach((path, i) => {
          ctx.strokeStyle = grey(1, a ? 0.05 : 0.14);
          ctx.setLineDash(d.sides[i] < 0 ? [] : [4, 4]);
          ctx.beginPath();
          path.forEach((p, k) => (k ? ctx.lineTo(v.x(p[0]), v.y(p[1])) : ctx.moveTo(v.x(p[0]), v.y(p[1]))));
          ctx.stroke();
        });
        ctx.setLineDash([]);
      }

      // timeline
      let s = 0;
      let denoiseP = -1;
      if (a) {
        const el = t - a.t0;
        const dn = a.policy === "flow" && a.roll.denoise.length ? DENOISE_S : 0;
        if (el < dn) denoiseP = el / dn;
        else s = Math.min(a.roll.tips.length - 1, Math.floor((el - dn) * STEP_HZ));
      }
      const hit = a && a.roll.collided && s >= a.roll.tips.length - 1;

      // post
      ctx.fillStyle = hit ? grey(1) : grey(0.12);
      ctx.strokeStyle = grey(1, 0.7);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(v.x(POST.x), v.y(POST.y), POST.r * v.s, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = grey(1, hit ? 0 : 0.18);
      for (let k = -10; k < 10; k++) {
        ctx.beginPath();
        ctx.moveTo(v.x(POST.x - POST.r) + k * 6, v.y(POST.y + POST.r));
        ctx.lineTo(v.x(POST.x - POST.r) + k * 6 + POST.r * 2 * v.s, v.y(POST.y - POST.r));
        ctx.stroke();
      }
      ctx.restore();

      if (a) {
        const r = a.roll;
        // target
        ctx.strokeStyle = grey(1);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(v.x(r.target[0]), v.y(r.target[1]), 10, 0, Math.PI * 2);
        ctx.stroke();
        if (r.success && s >= r.tips.length - 1) {
          ctx.fillStyle = grey(1);
          ctx.beginPath();
          ctx.arc(v.x(r.target[0]), v.y(r.target[1]), 6, 0, Math.PI * 2);
          ctx.fill();
        }
        const ribbon = (pts: P2[], alpha: number, w: number, dots = false) => {
          ctx.strokeStyle = grey(1, alpha);
          ctx.lineWidth = w;
          ctx.beginPath();
          pts.forEach((p, k) => (k ? ctx.lineTo(v.x(p[0]), v.y(p[1])) : ctx.moveTo(v.x(p[0]), v.y(p[1]))));
          ctx.stroke();
          if (dots) {
            ctx.fillStyle = grey(1, alpha);
            for (const p of pts) ctx.fillRect(v.x(p[0]) - 1.5, v.y(p[1]) - 1.5, 3, 3);
          }
        };
        let q = r.arm[s];
        if (denoiseP >= 0) {
          q = r.arm[0];
          const f = denoiseP * (r.denoise.length - 1);
          const k = Math.min(r.denoise.length - 2, Math.floor(f));
          const u = f - k;
          const A = r.denoise[k], B = r.denoise[k + 1];
          ribbon(A.map((p, i) => [p[0] + u * (B[i][0] - p[0]), p[1] + u * (B[i][1] - p[1])] as P2), 0.95, 2, true);
          label(ctx, `denoising the chunk · τ = ${denoiseP.toFixed(2)}`, 12, 12, "left", 0.9, false);
        } else {
          const plan = [...r.plans].reverse().find((p) => p.step <= s);
          if (plan) {
            plan.ribbons.slice(1).forEach((rb) => ribbon(rb, 0.3, 1));
            if (plan.ribbons[0]) ribbon(plan.ribbons[0], 0.85, 1.5, true);
          }
          ribbon(r.tips.slice(0, s + 1), 1, 2.5);
          label(ctx, `${a.policy} · step ${s}`, 12, 12, "left", 0.9);
        }
        // arm
        const { elbow, tip } = fk(q);
        ctx.strokeStyle = grey(0.85);
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(v.x(0), v.y(0));
        ctx.lineTo(v.x(elbow[0]), v.y(elbow[1]));
        ctx.lineTo(v.x(tip[0]), v.y(tip[1]));
        ctx.stroke();
        ctx.lineCap = "butt";
        for (const [p, rad] of [[[0, 0], 7], [elbow, 5], [tip, 4]] as [P2, number][]) {
          ctx.fillStyle = grey(0);
          ctx.strokeStyle = grey(1);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(v.x(p[0]), v.y(p[1]), rad, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = grey(1, 0.9);
        ctx.fillRect(v.x(0) - 6, v.y(0) - 6, 12, 12);
        label(ctx, d ? "demos: solid inside, dashed outside" : "train to load 300 demos", 12, 12, "left", 0.7);
      }
    },
    { fps: 40 },
    [cores, trainMissing, missing, error],
  );

  if (!cores) return <Ghost label="loading" className="aspect-square w-full" />;
  if (trainMissing || missing) return <CorePanel error={(trainMissing ?? missing)!} ghost={<GhostCanvas kind="arm" />} />;
  if (error) return <CoreError error={error} />;

  const ready = step >= 300;

  return (
    <Sheet className="flex flex-col gap-4">
      <canvas ref={ref} aria-label="Two-link reacher rolling out sampled action chunks" className="aspect-square w-full rounded-xl border border-rule" />
      {outcome && <Kicker className="text-ink">{outcome}</Kicker>}
      <Button onClick={() => (loop.running ? loop.stop() : void loop.start())}>
        {loop.running ? <Pause aria-hidden /> : <Play aria-hidden />}
        {loop.running ? "Pause" : step ? "Keep training" : "Train both policies"}
      </Button>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Policy">
        <Chip active={policy === "flow"} onClick={() => setPolicy("flow")} className="type-narrow text-xs tracking-[0.15em] uppercase">
          Flow policy
        </Chip>
        <Chip active={policy === "regression"} onClick={() => setPolicy("regression")} className="type-narrow text-xs tracking-[0.15em] uppercase">
          L2 regression
        </Chip>
      </div>
      {/* The whole 44px row is the switch's label, so the touch target is the row, not the 24px track. */}
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-rule px-3">
        <span className="text-sm">Replan every step, temporal ensemble</span>
        <AnimatedSwitch checked={ensemble} onCheckedChange={setEnsemble} disabled={!!cores.chunks} label="Temporal ensemble" />
      </label>
      {cores.chunks && <CorePanel error={cores.chunks} />}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" disabled={!ready} onClick={() => void rollout()}>
          <Dices aria-hidden /> Roll out
        </Button>
        <Button variant="outline" disabled={!ready || score?.busy !== undefined} onClick={() => void evaluate()}>
          {score?.busy !== undefined ? `Scoring ${Math.round(score.busy * 100)}%` : "Score 30 each"}
        </Button>
      </div>
      {!ready && <Kicker>Train for 300 steps to unlock roll-outs ({step}/300).</Kicker>}
      {rollMissing && <CorePanel error={rollMissing} />}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Step" value={step} />
        <Stat label="Flow ok" value={Math.round((score?.flow ?? 0) * 100)} suffix="%" />
        <Stat label="L2 ok" value={Math.round((score?.regression ?? 0) * 100)} suffix="%" />
      </div>
      {flowL.length > 1 ? (
        <LineChart
          series={[
            { label: "flow (CFM loss)", data: flowL },
            { label: "regression (MSE)", data: regL, stroke: "dashed" },
          ]}
          logY
          height={170}
          xLabel="step"
        />
      ) : (
        <LineChart ghost series={[]} height={170} />
      )}
      <Kicker>Solid: flow loss. Dashed: regression loss. Which is lower, and does lower mean a better policy?</Kicker>
    </Sheet>
  );
}

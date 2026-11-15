"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { grey } from "@/kit/canvas";
import { isNotYoursYet } from "@/kit/not-yours-yet";
import { CorePanel, CoreError } from "@/kit/components/core-guard";
import { Sheet } from "@/kit/components/page-shell";
import { useWorker } from "@/kit/components/use-worker";
import { Button } from "@/components/ui/button";
import { MorphButton } from "@/components/spectrumui/morph-button";
import { AnimatedSwitch } from "@/components/spectrumui/animated-switch";
import { forwardKinematics } from "../core/kinematics";
import { ARM, GHOST_POSES, HOME, REACH } from "../lib/arm";
import { posOf, type Mat } from "../lib/linalg";
import type { handlers } from "../workers/arm.worker";
import { Stage, type StageFrame } from "./stage";
import { armPoints, drawArmCrisp, drawArmGlow, drawFloor, drawTriad, label } from "./scene";
import { useCores } from "./use-cores";
import { LabeledSlider, MatrixGrid, Predict, Readout } from "./bits";

/*
 * M2: the puppet. Six sliders drive forwardKinematics; every joint frame can be shown as a triad.
 * "Sample the workspace" runs 30,000 random poses through FK in a worker and paints the cloud of
 * reachable tool positions (shaded by manipulability once M3 is written).
 */

export const ARM_CAM = { yaw: -0.85, pitch: 0.35, dist: 2.7, target: [0.2, 0, 0.45], fov: 0.75 };

export function GhostArmStage({ className = "h-80" }: { className?: string }) {
  return (
    <Stage
      className={className}
      camera={ARM_CAM}
      animate={false}
      back={(f) => drawFloor(f.ctx, f.view, { reach: REACH })}
      glow={(f) => drawArmGlow(f.glow, f.view, GHOST_POSES[0], { level: 0.5 })}
      crisp={(f) => drawArmCrisp(f.ctx, f.view, GHOST_POSES[0], { dashed: true, alpha: 0.6 })}
    />
  );
}

export function PuppetSection() {
  const a = useCores();
  const [q, setQ] = useState<number[]>(HOME);
  const [showFrames, setShowFrames] = useState(true);
  const [cloud, setCloud] = useState<{ pts: Float32Array; haveW: boolean; wMax: number } | null>(null);
  const [progress, setProgress] = useState(0);
  const [workerErr, setWorkerErr] = useState<Error | null>(null);
  const live = useRef({ q, showFrames, cloud });
  useEffect(() => {
    live.current = { q, showFrames, cloud };
  }, [q, showFrames, cloud]);
  const worker = useWorker<typeof handlers>(() => new Worker(new URL("../workers/arm.worker.ts", import.meta.url)));

  const fk = useMemo(() => {
    if (!a || a.forwardKinematics) return null;
    try {
      return { frames: forwardKinematics(q, ARM), error: null };
    } catch (e) {
      return { frames: null, error: e instanceof Error ? e : new Error(String(e)) };
    }
  }, [a, q]);

  if (!a) return <div className="h-80 rounded-2xl border border-rule bg-sheet" />;
  if (a.forwardKinematics) return <CorePanel error={a.forwardKinematics} ghost={<GhostArmStage />} />;
  if (fk?.error) return <CoreError error={fk.error} />;
  const frames = fk!.frames!;
  const tool = frames[ARM.joints.length];

  const back = (f: StageFrame) => drawFloor(f.ctx, f.view, { reach: REACH });
  const glow = (f: StageFrame) => {
    const s = live.current;
    if (s.cloud) {
      const { pts, haveW, wMax } = s.cloud;
      const g = f.glow;
      for (let i = 0; i < pts.length; i += 4) {
        const p = f.view.project([pts[i], pts[i + 1], pts[i + 2]]);
        const w = pts[i + 3];
        g.fillStyle = grey(haveW ? 0.15 + 0.85 * Math.min(1, w / wMax) : 0.45);
        g.fillRect(p.x, p.y, 2.5, 2.5);
      }
    }
    try {
      drawArmGlow(f.glow, f.view, armPoints(forwardKinematics(s.q, ARM)));
    } catch {
      /* guarded above */
    }
  };
  const crisp = (f: StageFrame) => {
    const s = live.current;
    try {
      const F = forwardKinematics(s.q, ARM);
      drawArmCrisp(f.ctx, f.view, armPoints(F));
      if (s.showFrames) F.forEach((T: Mat, i: number) => drawTriad(f.ctx, f.view, T, i === F.length - 1 ? 0.16 : 0.1, { labels: i === F.length - 1, alpha: 0.9 }));
      const p = posOf(F[ARM.joints.length]);
      const pp = f.view.project(p);
      label(f.ctx, `(${p.map((v) => v.toFixed(2)).join(", ")})`, pp.x + 10, pp.y + 14, { alpha: 0.7 });
    } catch {
      /* guarded above */
    }
  };

  const sample = async () => {
    setWorkerErr(null);
    setProgress(0);
    try {
      const out = await worker.current!.call("workspace", { n: 30000, seed: (Math.random() * 1e9) | 0 }, (p) => setProgress(p as number));
      let wMax = 0;
      if (out.haveW) for (let i = 3; i < out.pts.length; i += 4) wMax = Math.max(wMax, out.pts[i]);
      setCloud({ pts: out.pts, haveW: out.haveW, wMax: wMax || 1 });
      setProgress(1);
    } catch (e) {
      if (!isNotYoursYet(e)) setWorkerErr(e instanceof Error ? e : new Error(String(e)));
      throw e;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl border border-rule">
        <Stage className="h-80 sm:h-[26rem]" camera={ARM_CAM} interaction="orbit" back={back} glow={glow} crisp={crisp} ariaLabel="The arm posed by the joint sliders" />
      </div>
      <Sheet className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {ARM.joints.map((j, i) => (
            <LabeledSlider
              key={j.name}
              label={`q${i + 1} · ${j.name}`}
              value={q[i]}
              min={j.limits[0]}
              max={j.limits[1]}
              onChange={(v) => setQ((old) => old.map((x, k) => (k === i ? v : x)))}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setQ(HOME)}>Home</Button>
          <Button variant="outline" onClick={() => setQ([0, 0, 0, 0, 0, 0])}>Straight up</Button>
          <Button variant="outline" onClick={() => setQ(ARM.joints.map((j) => j.limits[0] + Math.random() * (j.limits[1] - j.limits[0])))}>Random</Button>
          <label className="ml-auto flex min-h-11 items-center gap-3">
            <span className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Frames</span>
            <AnimatedSwitch checked={showFrames} onCheckedChange={setShowFrames} label="Show joint frames" />
          </label>
        </div>
      </Sheet>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1fr]">
        <Sheet>
          <MatrixGrid M={tool} digits={3} label="T_tool = forwardKinematics(q)[6]" />
        </Sheet>
        <Sheet className="flex flex-col gap-3">
          <Readout label="Reach used" value={`${((Math.hypot(tool[0][3], tool[1][3], tool[2][3] - 0.38) / REACH) * 100).toFixed(0)}%`} sub="distance from the shoulder / full reach" />
          <MorphButton onAction={sample} loadingLabel={`Sampling ${Math.round(progress * 100)}%`} successLabel="Cloud ready" errorLabel="Stub hit" className="w-full">
            Sample the workspace
          </MorphButton>
          {cloud && (
            <p className="text-xs leading-snug text-ink-soft">
              30,000 random poses. {cloud.haveW ? "Brighter = more manipulable (M3)." : "Shading by manipulability arrives with M3."}
            </p>
          )}
          {workerErr && <CoreError error={workerErr} />}
        </Sheet>
      </div>
      <Predict>
        Uniformly random joint angles. Is the cloud of tool positions uniform in space? Where will it be densest: near the
        shoulder, or out at full stretch? Guess, then sample.
      </Predict>
    </div>
  );
}

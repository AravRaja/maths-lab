"use client";

import { useEffect, useRef, useState } from "react";
import { isNotYoursYet } from "@/kit/not-yours-yet";
import { CorePanel, CoreError } from "@/kit/components/core-guard";
import { LineChart } from "@/kit/components/charts";
import { Sheet } from "@/kit/components/page-shell";
import { AnimatedSwitch } from "@/components/spectrumui/animated-switch";
import { forwardKinematics } from "../core/kinematics";
import { ARM, HOME, REACH } from "../lib/arm";
import { ikIterate } from "../lib/ik-loop";
import { Ry, lerp, type Mat, type Vec } from "../lib/linalg";
import { Stage, type StageFrame } from "./stage";
import { armPoints, drawArmCrisp, drawArmGlow, drawFloor, drawTarget, glowStatic, label } from "./scene";
import { GhostArmStage } from "./puppet-section";
import { useCores } from "./use-cores";
import { LabeledSlider, Predict, Readout, Segmented } from "./bits";

/*
 * M4: inverse kinematics. Two arms chase the same target with the user's dlsStep: one damped (λ from
 * the slider, solid), one undamped twin (λ = 0, dashed). Away from singularities they agree; near
 * one, the undamped twin's joint speed explodes. "Through the top" flies the target straight over
 * the base, where the arm is fully stretched.
 */

type Path = "follow" | "circle" | "over";
const DOWN: Mat = Ry(Math.PI); // tool z pointing at the floor

function scripted(path: Path, t: number): Vec {
  if (path === "circle") return [0.55 + 0.25 * Math.cos(t * 0.8), 0.45 * Math.sin(t * 0.8), 0.45 + 0.15 * Math.sin(t * 1.6)];
  // Over the top: a slow arc from in front, up through the stretched pose above the base, and down behind.
  const s = Math.sin(t * 0.35);
  const ang = s * 1.45;
  const r = REACH * 1.04;
  return [r * Math.sin(ang), 0.05, 0.38 + r * Math.cos(ang)];
}

export function ReachSection() {
  const a = useCores();
  const [lambda, setLambda] = useState(0.08);
  const [path, setPath] = useState<Path>("over");
  const [twin, setTwin] = useState(true);
  const [orient, setOrient] = useState(false);
  const [hist, setHist] = useState<{ damped: number[]; raw: number[] }>({ damped: [], raw: [] });
  const [stats, setStats] = useState({ err: 0, w: 0 });
  const [crash, setCrash] = useState<Error | null>(null);
  const st = useRef({
    qd: HOME.slice(),
    qr: HOME.slice(),
    target: [0.6, 0.2, 0.5] as Vec,
    manual: [0.6, 0.2, 0.5] as Vec,
    t: 0,
    damped: [] as number[],
    raw: [] as number[],
    err: 0,
    w: 0,
    glitch: 0,
  });
  const cfg = useRef({ lambda, path, twin, orient });
  useEffect(() => {
    cfg.current = { lambda, path, twin, orient };
  }, [lambda, path, twin, orient]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const s = st.current;
      setHist({ damped: s.damped.slice(), raw: s.raw.slice() });
      setStats({ err: s.err, w: s.w });
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  if (!a) return <div className="h-80 rounded-2xl border border-rule bg-sheet" />;
  const missing = a.forwardKinematics ?? a.geometricJacobian ?? a.dlsStep;
  if (missing) return <CorePanel error={missing} ghost={<GhostArmStage />} />;
  if (crash) return <CoreError error={crash} />;
  const canOrient = !a.so3Log;

  const step = (f: StageFrame) => {
    const s = st.current;
    const c = cfg.current;
    s.t += f.dt;
    const goal = c.path === "follow" ? s.manual : scripted(c.path, s.t);
    s.target = lerp(s.target, goal, 0.25);
    const tgt = { p: s.target, R: c.orient && canOrient ? DOWN : undefined };
    try {
      let spd = 0;
      let spr = 0;
      for (let k = 0; k < 2; k++) {
        const d = ikIterate(s.qd, tgt, { lambda: c.lambda, maxStep: 0.06 });
        s.qd = d.q;
        spd = Math.max(spd, d.speed);
        s.err = d.err;
        s.w = d.w;
        if (c.twin) {
          try {
            const r = ikIterate(s.qr, tgt, { lambda: 0, maxStep: 0.06, maxJoint: 0.9 });
            s.qr = r.q;
            spr = Math.max(spr, r.speed);
          } catch (e) {
            // λ = 0 exactly at a singularity: J Jᵀ can't be inverted. That's the point of the twin.
            if (isNotYoursYet(e)) throw e;
            spr = 2;
          }
        }
      }
      s.damped.push(spd);
      s.raw.push(c.twin ? Math.min(spr, 2) : 0);
      if (s.damped.length > 240) {
        s.damped.shift();
        s.raw.shift();
      }
      s.glitch += ((c.twin ? Math.min(1, spr / 0.6) : 0) - s.glitch) * 0.2;
    } catch (e) {
      setCrash(e instanceof Error ? e : new Error(String(e)));
    }
  };

  const back = (f: StageFrame) => drawFloor(f.ctx, f.view, { reach: REACH });
  const glow = (f: StageFrame) => {
    const s = st.current;
    try {
      if (cfg.current.twin) drawArmGlow(f.glow, f.view, armPoints(forwardKinematics(s.qr, ARM)), { level: 0.35, shadow: false });
      drawArmGlow(f.glow, f.view, armPoints(forwardKinematics(s.qd, ARM)));
      glowStatic(f.glow, f.width, f.height, s.glitch ** 2 * 0.6, Math.floor(f.t * 30));
    } catch {
      /* crash state handles it */
    }
  };
  const crisp = (f: StageFrame) => {
    const s = st.current;
    try {
      if (cfg.current.twin) drawArmCrisp(f.ctx, f.view, armPoints(forwardKinematics(s.qr, ARM)), { dashed: true, alpha: 0.55 });
      drawArmCrisp(f.ctx, f.view, armPoints(forwardKinematics(s.qd, ARM)));
      drawTarget(f.ctx, f.view, s.target, { label: cfg.current.path === "follow" ? "drag me" : undefined });
      label(f.ctx, `solid λ = ${cfg.current.lambda.toFixed(2)}${cfg.current.twin ? "   dashed λ = 0" : ""}`, 12, f.height - 16, { alpha: 0.7 });
    } catch {
      /* crash state handles it */
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl border border-rule">
        <Stage
          className="h-80 sm:h-[26rem]"
          camera={{ yaw: -1.35, pitch: 0.22, dist: 3.3, target: [0.1, 0, 0.72], fov: 0.75 }}
          interaction="target"
          planeCenter={[0.4, 0, 0.5]}
          onTarget={(p) => {
            st.current.manual = [p[0], p[1], Math.max(0.03, p[2])];
            setPath("follow");
          }}
          step={step}
          back={back}
          glow={glow}
          crisp={crisp}
          ariaLabel="Two arms reaching for a target, one damped and one not"
        />
      </div>
      <Sheet className="flex flex-col gap-3">
        <Segmented
          value={path}
          onChange={setPath}
          options={[
            { value: "over", label: "Over the top" },
            { value: "circle", label: "Circle" },
            { value: "follow", label: "Follow me" },
          ]}
        />
        <LabeledSlider label="Damping λ" value={lambda} min={0} max={0.4} step={0.005} onChange={setLambda} format={(v) => v.toFixed(3)} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex min-h-11 items-center gap-3">
            <AnimatedSwitch checked={twin} onCheckedChange={setTwin} label="Show the undamped twin" />
            <span className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Undamped twin</span>
          </label>
          <label className="flex min-h-11 items-center gap-3">
            <AnimatedSwitch checked={orient && canOrient} onCheckedChange={setOrient} disabled={!canOrient} label="Keep the tool pointing down" />
            <span className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">{canOrient ? "Tool points down (6-D)" : "Tool down needs so3Log()"}</span>
          </label>
        </div>
      </Sheet>
      <div className="grid grid-cols-2 gap-2">
        <Readout label="Task error" value={`${(stats.err * 1000).toFixed(1)} mm`} sub={orient && canOrient ? "position + weighted rotation" : "position only, 3 × 6 J"} />
        <Readout label="Manipulability" value={Number.isNaN(stats.w) ? "M3" : stats.w.toFixed(4)} sub="of the damped arm" />
      </div>
      <Sheet>
        <p className="type-narrow mb-2 text-xs tracking-[0.2em] text-ink-soft uppercase">Joint speed ‖δq‖ per step</p>
        <LineChart
          height={180}
          series={[
            { label: `λ = ${lambda.toFixed(2)}`, data: hist.damped.length ? hist.damped : [0], stroke: "solid" },
            ...(twin ? [{ label: "λ = 0", data: hist.raw.length ? hist.raw : [0], stroke: "dashed" as const }] : []),
          ]}
          xLabel="step"
          yLabel="rad"
        />
      </Sheet>
      <Predict>
        With λ = 0, what happens to ‖δq‖ as the target passes straight over the base? Now set λ = 0.3: the arm calms down,
        but what does it give up? Watch the task error, not just the arm.
      </Predict>
    </div>
  );
}

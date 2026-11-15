"use client";

import { useEffect, useRef, useState } from "react";
import { grey } from "@/kit/canvas";
import { isNotYoursYet } from "@/kit/not-yours-yet";
import { CorePanel, CoreError } from "@/kit/components/core-guard";
import { LineChart } from "@/kit/components/charts";
import { Ghost } from "@/kit/components/yours-to-write";
import { Sheet } from "@/kit/components/page-shell";
import { useWorker } from "@/kit/components/use-worker";
import { AnimatedSwitch } from "@/components/spectrumui/animated-switch";
import { MorphButton } from "@/components/spectrumui/morph-button";
import { kalmanPredict, kalmanUpdate } from "../core/kalman";
import { forwardKinematics } from "../core/kinematics";
import { ARM, HOME, REACH } from "../lib/arm";
import { ikIterate } from "../lib/ik-loop";
import { constantVelocity, firefly } from "../lib/tracker";
import { add, eye, matScale, symEig, type Mat, type Vec } from "../lib/linalg";
import { gaussian, rng } from "../lib/rng";
import type { handlers } from "../workers/kalman.worker";
import { Stage, type StageFrame } from "./stage";
import { armPoints, drawArmCrisp, drawArmGlow, drawEllipsoidCrisp, drawEllipsoidGlow, drawFloor, drawTarget, label, polyline } from "./scene";
import { ARM_CAM } from "./puppet-section";
import { useCores } from "./use-cores";
import { LabeledSlider, Predict, Readout } from "./bits";

/*
 * M6: catch the firefly. A camera sees the firefly's position at 40 Hz with Gaussian noise. The
 * user's Kalman filter (constant-velocity model) estimates position and velocity; the 3σ covariance
 * ellipsoid shows how sure it is, and a dotted line shows where it thinks the firefly is going.
 * Switch the camera off and watch the ellipsoid balloon. Once IK exists the arm reaches for the estimate.
 */

const DT = 1 / 40;
const LEAD = 0.15;

interface Track {
  t: number;
  acc: number;
  truth: Vec;
  x: Vec;
  P: Mat;
  meas: Vec[];
  truthTrail: Vec[];
  q: number[];
  errRaw: number[];
  errKf: number[];
  g: () => number;
}

function covAxes(P: Mat, k = 3): Vec[] {
  const pos = [0, 1, 2].map((i) => [0, 1, 2].map((j) => P[i][j]));
  const { values, vectors } = symEig(pos);
  return [0, 1, 2].map((c) => [vectors[0][c], vectors[1][c], vectors[2][c]].map((v) => v * k * Math.sqrt(Math.max(0, values[c]))));
}

export function CatchSection() {
  const a = useCores();
  const [sigma, setSigma] = useState(0.05);
  const [logQ, setLogQ] = useState(0.6);
  const [cameraOn, setCameraOn] = useState(true);
  const [showTruth, setShowTruth] = useState(true);
  const [hist, setHist] = useState<{ raw: number[]; kf: number[] }>({ raw: [], kf: [] });
  const [crash, setCrash] = useState<Error | null>(null);
  const st = useRef<Track>({
    t: 0,
    acc: 0,
    truth: firefly(0),
    x: [...firefly(0), 0, 0, 0],
    P: matScale(eye(6), 0.05),
    meas: [],
    truthTrail: [],
    q: HOME.slice(),
    errRaw: [],
    errKf: [],
    g: gaussian(rng(9)),
  });
  const cfg = useRef({ sigma, q: 10 ** logQ, cameraOn, showTruth });
  useEffect(() => {
    cfg.current = { sigma, q: 10 ** logQ, cameraOn, showTruth };
  }, [sigma, logQ, cameraOn, showTruth]);

  useEffect(() => {
    const id = window.setInterval(() => setHist({ raw: st.current.errRaw.slice(), kf: st.current.errKf.slice() }), 300);
    return () => window.clearInterval(id);
  }, []);

  if (!a) return <div className="h-80 rounded-2xl border border-rule bg-sheet" />;
  const missing = a.kalmanPredict ?? a.kalmanUpdate;
  if (missing) return <CorePanel error={missing} ghost={<Ghost label="firefly tracker" className="h-80" />} />;
  if (crash) return <CoreError error={crash} />;
  const armReady = !a.forwardKinematics && !a.geometricJacobian && !a.dlsStep;

  const step = (f: StageFrame) => {
    const s = st.current;
    const c = cfg.current;
    s.acc += f.dt;
    try {
      const { F, Q, H } = constantVelocity(3, DT, c.q);
      const R = matScale(eye(3), c.sigma ** 2);
      while (s.acc >= DT) {
        s.acc -= DT;
        s.t += DT;
        s.truth = firefly(s.t);
        s.truthTrail.push(s.truth);
        if (s.truthTrail.length > 120) s.truthTrail.shift();
        const p = kalmanPredict(s.x, s.P, F, Q);
        s.x = p.x;
        s.P = p.P;
        if (c.cameraOn) {
          const z = s.truth.map((v) => v + c.sigma * s.g());
          s.meas.push(z);
          if (s.meas.length > 60) s.meas.shift();
          const u = kalmanUpdate(s.x, s.P, z, H, R);
          s.x = u.x;
          s.P = u.P;
          s.errRaw.push(Math.hypot(z[0] - s.truth[0], z[1] - s.truth[1], z[2] - s.truth[2]));
        } else {
          s.errRaw.push(NaN);
        }
        s.errKf.push(Math.hypot(s.x[0] - s.truth[0], s.x[1] - s.truth[1], s.x[2] - s.truth[2]));
        if (s.errKf.length > 400) {
          s.errKf.shift();
          s.errRaw.shift();
        }
      }
      if (armReady) {
        const lead = add(s.x.slice(0, 3), s.x.slice(3, 6).map((v) => v * LEAD));
        for (let k = 0; k < 2; k++) s.q = ikIterate(s.q, { p: lead }, { lambda: 0.05, maxStep: 0.06 }).q;
      }
    } catch (e) {
      setCrash(e instanceof Error ? e : new Error(String(e)));
    }
  };

  const back = (f: StageFrame) => drawFloor(f.ctx, f.view, { reach: REACH });
  const glow = (f: StageFrame) => {
    const s = st.current;
    drawEllipsoidGlow(f.glow, f.view, s.x.slice(0, 3), covAxes(s.P), 0.3);
    if (armReady) {
      try {
        drawArmGlow(f.glow, f.view, armPoints(forwardKinematics(s.q, ARM)), { level: 0.7 });
      } catch {
        /* crash handled in step */
      }
    }
  };
  const crisp = (f: StageFrame) => {
    const s = st.current;
    const c = f.ctx;
    const v = f.view;
    if (cfg.current.showTruth && s.truthTrail.length > 1) {
      c.save();
      c.strokeStyle = grey(1, 0.25);
      c.setLineDash([1.5, 4]);
      polyline(c, v, s.truthTrail);
      c.stroke();
      c.restore();
      const tp = v.project(s.truth);
      c.fillStyle = grey(1, 0.5);
      c.fillRect(tp.x - 2, tp.y - 2, 4, 4);
    }
    s.meas.forEach((z, i) => {
      const p = v.project(z);
      const al = (i / s.meas.length) * 0.8;
      c.strokeStyle = grey(1, al);
      c.beginPath();
      c.moveTo(p.x - 2.5, p.y - 2.5);
      c.lineTo(p.x + 2.5, p.y + 2.5);
      c.moveTo(p.x + 2.5, p.y - 2.5);
      c.lineTo(p.x - 2.5, p.y + 2.5);
      c.stroke();
    });
    drawEllipsoidCrisp(c, v, s.x.slice(0, 3), covAxes(s.P), 0.6);
    // Where the filter thinks it is going: predict-only for half a second.
    try {
      const { F } = constantVelocity(3, DT, cfg.current.q);
      let x = s.x;
      let P = s.P;
      const ahead: Vec[] = [x.slice(0, 3)];
      for (let k = 0; k < 20; k++) {
        const p = kalmanPredict(x, P, F, matScale(eye(6), 0));
        x = p.x;
        P = p.P;
        ahead.push(x.slice(0, 3));
      }
      c.save();
      c.strokeStyle = grey(1, 0.8);
      c.setLineDash([4, 4]);
      polyline(c, v, ahead);
      c.stroke();
      c.restore();
    } catch {
      /* crash handled in step */
    }
    drawTarget(c, v, s.x.slice(0, 3), { style: "ring", size: 7, label: cfg.current.cameraOn ? "estimate" : "estimate (blind)" });
    if (armReady) {
      try {
        drawArmCrisp(c, v, armPoints(forwardKinematics(s.q, ARM)));
      } catch {
        /* crash handled in step */
      }
    }
    label(c, armReady ? "× measurement   ○ estimate   ┄ prediction" : "× measurement   ○ estimate   · arm joins once IK exists", 12, f.height - 16, { alpha: 0.65 });
    if (!cfg.current.cameraOn) label(c, "CAMERA OFF · predict only", f.width / 2, 18, { align: "center", alpha: 1 });
  };

  const tail = (xs: number[]) => xs.filter(Number.isFinite).slice(-200);
  const rms = (xs: number[]) => (xs.length ? Math.sqrt(xs.reduce((s, v) => s + v * v, 0) / xs.length) : 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl border border-rule">
        <Stage className="h-80 sm:h-[26rem]" camera={{ ...ARM_CAM, yaw: -1.1, dist: 2.2, target: [0.45, 0.05, 0.5] }} interaction="orbit" step={step} back={back} glow={glow} crisp={crisp} ariaLabel="A Kalman filter tracking a noisy target" />
      </div>
      <Sheet className="flex flex-col gap-2">
        <LabeledSlider label="Camera noise σ (m)" value={sigma} min={0.005} max={0.2} step={0.005} onChange={setSigma} format={(v) => v.toFixed(3)} />
        <LabeledSlider label="Process noise q" value={logQ} min={-2} max={3} step={0.05} onChange={setLogQ} format={(v) => (10 ** v).toPrecision(2)} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex min-h-11 items-center gap-3">
            <AnimatedSwitch checked={cameraOn} onCheckedChange={setCameraOn} label="Camera on" />
            <span className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Camera</span>
          </label>
          <label className="flex min-h-11 items-center gap-3">
            <AnimatedSwitch checked={showTruth} onCheckedChange={setShowTruth} label="Show the true path" />
            <span className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Show truth</span>
          </label>
        </div>
      </Sheet>
      <div className="grid grid-cols-2 gap-2">
        <Readout label="Raw camera error" value={`${(rms(tail(hist.raw)) * 1000).toFixed(0)} mm`} sub="RMS, last 5 s" />
        <Readout label="Filtered error" value={`${(rms(tail(hist.kf)) * 1000).toFixed(0)} mm`} sub="RMS, last 5 s" />
      </div>
      <Sheet>
        <p className="type-narrow mb-2 text-xs tracking-[0.2em] text-ink-soft uppercase">Error over the last 10 s (m)</p>
        <LineChart
          height={170}
          series={[
            { label: "camera", data: hist.raw.map((v) => (Number.isFinite(v) ? v : 0)), stroke: "dotted" },
            { label: "filter", data: hist.kf.length ? hist.kf : [0], stroke: "solid" },
          ]}
          xLabel="frame"
        />
      </Sheet>
      <TuningCurve sigma={sigma} logQ={logQ} />
      <Predict>
        Switch the camera off for two seconds. Which way does the ellipsoid stretch first, along the direction of motion or
        across it? Why? Then turn it back on and count frames until it shrinks.
      </Predict>
    </div>
  );
}

function TuningCurve({ sigma, logQ }: { sigma: number; logQ: number }) {
  const worker = useWorker<typeof handlers>(() => new Worker(new URL("../workers/kalman.worker.ts", import.meta.url)));
  const LOGS = Array.from({ length: 21 }, (_, i) => -2 + (i * 5) / 20);
  const [out, setOut] = useState<{ rmse: number[]; raw: number; sigma: number } | null>(null);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<Error | null>(null);

  const run = async () => {
    setErr(null);
    try {
      const r = await worker.current!.call("sweep", { sigma, qs: LOGS.map((l) => 10 ** l), runs: 12, steps: 500, dt: DT }, (p) => setProgress(p as number));
      setOut({ ...r, sigma });
    } catch (e) {
      if (!isNotYoursYet(e)) setErr(e instanceof Error ? e : new Error(String(e)));
      throw e;
    }
  };

  const best = out ? LOGS[out.rmse.indexOf(Math.min(...out.rmse))] : null;
  return (
    <Sheet className="flex flex-col gap-3">
      <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Tuning curve: RMS error vs process noise q</p>
      {out ? (
        <LineChart
          height={180}
          series={[
            { label: "filter", data: LOGS.map((l, i) => [l, out.rmse[i]] as [number, number]), stroke: "solid" },
            { label: "raw camera", data: LOGS.map((l) => [l, out.raw] as [number, number]), stroke: "dotted" },
            { label: "your q", data: [[logQ, 0], [logQ, out.raw]] as [number, number][], stroke: "dashed" },
          ]}
          xLabel="log₁₀ q"
          yLabel="m"
        />
      ) : (
        <LineChart ghost height={180} series={[]} />
      )}
      <MorphButton onAction={run} loadingLabel={`Sweeping ${Math.round(progress * 100)}%`} successLabel="Swept" className="w-full">
        Sweep q (252 noisy runs in a worker)
      </MorphButton>
      {out && best !== null && (
        <p className="text-xs leading-snug text-ink-soft">
          At σ = {out.sigma.toFixed(3)} m the best q is about {(10 ** best).toPrecision(2)}. Left of it the filter is too stubborn and lags the
          darts; right of it it trusts every noisy dot.
        </p>
      )}
      {err && <CoreError error={err} />}
    </Sheet>
  );
}

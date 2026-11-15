"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { grey } from "@/kit/canvas";
import { ditherField } from "@/kit/dither";
import { isNotYoursYet } from "@/kit/not-yours-yet";
import { CorePanel, CoreError } from "@/kit/components/core-guard";
import { Ghost } from "@/kit/components/yours-to-write";
import { Sheet } from "@/kit/components/page-shell";
import { useCanvas } from "@/kit/components/use-canvas";
import { useWorker } from "@/kit/components/use-worker";
import { Badge } from "@/components/ui/badge";
import { AnimatedSwitch } from "@/components/spectrumui/animated-switch";
import { forwardKinematics } from "../core/kinematics";
import { geometricJacobian, manipulability } from "../core/jacobian";
import { ARM, HOME, REACH, dance } from "../lib/arm";
import { velocityEllipsoid } from "../lib/ellipsoid";
import { add, matMul, matScale, matSub, posOf, rotOf, scale, transpose, type Mat, type Vec } from "../lib/linalg";
import type { handlers } from "../workers/arm.worker";
import { Stage, type StageFrame } from "./stage";
import { armPoints, drawArmCrisp, drawArmGlow, drawEllipsoidCrisp, drawEllipsoidGlow, drawFloor, label, line } from "./scene";
import { ARM_CAM, GhostArmStage } from "./puppet-section";
import { useCores } from "./use-cores";
import { LabeledSlider, MatrixGrid, Predict, Readout, Segmented } from "./bits";

/*
 * M3: what the Jacobian looks like. Pick a joint: its column is drawn as the line it spins about
 * and the velocity it gives the tool. The ellipsoid is Jv Jvᵀ. Below, a dithered map of
 * manipulability over (shoulder, elbow), computed in a worker; tap it to jump there.
 */

function fdJacobian(q: number[], h = 1e-6): Mat {
  const n = q.length;
  const J: Mat = Array.from({ length: 6 }, () => new Array(n).fill(0));
  const T0 = forwardKinematics(q, ARM)[n];
  const R0t = transpose(rotOf(T0));
  for (let i = 0; i < n; i++) {
    const qp = q.slice();
    const qm = q.slice();
    qp[i] += h;
    qm[i] -= h;
    const Tp = forwardKinematics(qp, ARM)[n];
    const Tm = forwardKinematics(qm, ARM)[n];
    const W = matMul(matScale(matSub(rotOf(Tp), rotOf(Tm)), 1 / (2 * h)), R0t);
    const dp = posOf(Tp).map((v, k) => (v - posOf(Tm)[k]) / (2 * h));
    [...dp, W[2][1], W[0][2], W[1][0]].forEach((v, r) => (J[r][i] = v));
  }
  return J;
}

function arrow(ctx: CanvasRenderingContext2D, f: StageFrame, from: Vec, to: Vec, width = 2) {
  const a = f.view.project(from);
  const b = f.view.project(to);
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  ctx.save();
  ctx.lineWidth = width;
  ctx.strokeStyle = grey(1);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.fillStyle = grey(1);
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x - 9 * Math.cos(ang - 0.4), b.y - 9 * Math.sin(ang - 0.4));
  ctx.lineTo(b.x - 9 * Math.cos(ang + 0.4), b.y - 9 * Math.sin(ang + 0.4));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function JacobianSection() {
  const a = useCores();
  const [q, setQ] = useState<number[]>(HOME);
  const [joint, setJoint] = useState("2");
  const [play, setPlay] = useState(true);
  const live = useRef({ q, joint, play, t0: 0 });
  useEffect(() => {
    live.current.q = q;
    live.current.joint = joint;
    live.current.play = play;
  }, [q, joint, play]);

  // While playing, the pose comes from the dance; mirror it into React a few times a second.
  useEffect(() => {
    if (!play) return;
    const id = window.setInterval(() => setQ(live.current.q.map((v) => +v.toFixed(3))), 250);
    return () => window.clearInterval(id);
  }, [play]);

  const info = useMemo(() => {
    if (!a || a.forwardKinematics || a.geometricJacobian) return null;
    try {
      const F = forwardKinematics(q, ARM);
      const J = geometricJacobian(F, ARM);
      const fd = fdJacobian(q);
      let gap = 0;
      J.forEach((r, i) => r.forEach((v, j) => (gap = Math.max(gap, Math.abs(v - fd[i][j])))));
      const { sigma } = velocityEllipsoid(J.slice(0, 3));
      let w: number | null = null;
      if (!a.manipulability) w = manipulability(J.slice(0, 3));
      return { J, gap, sigma, w, error: null };
    } catch (e) {
      return { error: e instanceof Error ? e : new Error(String(e)) } as const;
    }
  }, [a, q]);

  if (!a) return <div className="h-80 rounded-2xl border border-rule bg-sheet" />;
  const missing = a.forwardKinematics ?? a.geometricJacobian;
  if (missing) return <CorePanel error={missing} ghost={<GhostArmStage />} />;
  if (info?.error) return <CoreError error={info.error} />;

  const step = (f: StageFrame) => {
    const s = live.current;
    if (s.play) {
      s.t0 += f.dt;
      s.q = dance(s.t0 * 0.8 + 3);
    }
  };
  const back = (f: StageFrame) => drawFloor(f.ctx, f.view, { reach: REACH });
  const glow = (f: StageFrame) => {
    try {
      const F = forwardKinematics(live.current.q, ARM);
      const J = geometricJacobian(F, ARM);
      const { axes } = velocityEllipsoid(J.slice(0, 3), 0.3);
      drawEllipsoidGlow(f.glow, f.view, posOf(F[ARM.joints.length]), axes, 0.35);
      drawArmGlow(f.glow, f.view, armPoints(F));
    } catch {
      /* guarded */
    }
  };
  const crisp = (f: StageFrame) => {
    const s = live.current;
    const i = Number(s.joint) - 1;
    try {
      const F = forwardKinematics(s.q, ARM);
      const J = geometricJacobian(F, ARM);
      const tool = posOf(F[ARM.joints.length]);
      const { axes } = velocityEllipsoid(J.slice(0, 3), 0.3);
      // Ghost of where a small turn of joint i would take the arm.
      const q2 = s.q.slice();
      q2[i] += 0.3;
      drawArmCrisp(f.ctx, f.view, armPoints(forwardKinematics(q2, ARM)), { dashed: true, alpha: 0.35, rings: false });
      drawArmCrisp(f.ctx, f.view, armPoints(F));
      drawEllipsoidCrisp(f.ctx, f.view, tool, axes, 0.7);
      // Column i: the spin axis (angular rows) through joint i, and the tool velocity (linear rows).
      const pj = posOf(F[i]);
      const w = [J[3][i], J[4][i], J[5][i]];
      f.ctx.save();
      f.ctx.strokeStyle = grey(1, 0.7);
      f.ctx.setLineDash([7, 5]);
      line(f.ctx, f.view, add(pj, scale(w, -0.5)), add(pj, scale(w, 0.5)));
      f.ctx.restore();
      const v = [J[0][i], J[1][i], J[2][i]];
      arrow(f.ctx, f, tool, add(tool, scale(v, 0.35)), 2.5);
      const pv = f.view.project(add(tool, scale(v, 0.35)));
      label(f.ctx, `J col ${i + 1}`, pv.x + 8, pv.y);
      const pjj = f.view.project(pj);
      label(f.ctx, `axis ${i + 1}`, pjj.x + 10, pjj.y - 12, { alpha: 0.7 });
    } catch {
      /* guarded */
    }
  };

  const { J, gap, sigma, w } = info!;
  const cond = sigma[2] > 1e-9 ? sigma[0] / sigma[2] : Infinity;

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl border border-rule">
        <Stage className="h-80 sm:h-[26rem]" camera={ARM_CAM} interaction="orbit" step={step} back={back} glow={glow} crisp={crisp} ariaLabel="The arm with a Jacobian column drawn as an arrow" />
      </div>
      <Sheet className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Which column</span>
          <label className="flex min-h-11 items-center gap-3">
            <span className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Dance</span>
            <AnimatedSwitch checked={play} onCheckedChange={setPlay} label="Animate the pose" />
          </label>
        </div>
        <Segmented value={joint} onChange={setJoint} options={ARM.joints.map((_, i) => ({ value: String(i + 1), label: `q${i + 1}` }))} />
        <LabeledSlider
          label="Elbow q3 (0 = stretched)"
          value={q[2]}
          min={ARM.joints[2].limits[0]}
          max={ARM.joints[2].limits[1]}
          onChange={(v) => {
            setPlay(false);
            const nq = live.current.q.slice();
            nq[2] = v;
            live.current.q = nq;
            setQ(nq);
          }}
        />
      </Sheet>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Readout label="σ₁ σ₂ σ₃" value={sigma.map((v) => v.toFixed(2)).join(" ")} sub="singular values of Jv" />
        <Readout label="w = √det JvJvᵀ" value={w === null ? "M3" : w.toFixed(4)} sub={w === null ? "manipulability() next" : "zero = singular"} />
        <Readout label="σ₁ / σ₃" value={Number.isFinite(cond) ? cond.toFixed(1) : "∞"} sub="condition number" />
        <Readout
          label="vs finite diff"
          value={<span className="inline-flex items-center gap-2">{gap.toExponential(0)}<Badge variant={gap < 1e-5 ? "default" : "outline"}>{gap < 1e-5 ? "pass" : "off"}</Badge></span>}
          sub="max |J − J_fd|"
        />
      </div>
      <Sheet>
        <MatrixGrid M={J} digits={2} label="J(q): rows vx vy vz ωx ωy ωz, columns q1 … q6" />
      </Sheet>
      {a.manipulability ? (
        <CorePanel error={a.manipulability} ghost={<Ghost label="manipulability map" className="aspect-square w-full" />} />
      ) : (
        <ManipMap q={q} onPick={(q1, q2) => { setPlay(false); const nq = q.slice(); nq[1] = q1; nq[2] = q2; live.current.q = nq; setQ(nq); }} />
      )}
      <Predict>
        Slide the elbow and the wrist pitch to 0 so the whole arm is one straight line. Which way can the tool <em>not</em> move
        any more, and which singular value goes to zero? Why is the elbow alone not enough? Look at the ellipsoid before you look at the numbers.
      </Predict>
    </div>
  );
}

/** Dithered map of manipulability over (shoulder q2, elbow q3), from the worker. Tap to jump there. */
function ManipMap({ q, onPick }: { q: number[]; onPick: (q2: number, q3: number) => void }) {
  const worker = useWorker<typeof handlers>(() => new Worker(new URL("../workers/arm.worker.ts", import.meta.url)));
  const [map, setMap] = useState<{ values: Float32Array; res: number } | null>(null);
  const [err, setErr] = useState<Error | null>(null);
  const key = `${q[0].toFixed(1)},${q[3].toFixed(1)},${q[4].toFixed(1)},${q[5].toFixed(1)}`;
  const qRef = useRef(q);
  useEffect(() => {
    qRef.current = q;
  });

  useEffect(() => {
    let alive = true;
    const t = window.setTimeout(() => {
      worker.current
        ?.call("manipMap", { q: qRef.current, res: 96 })
        .then((m) => alive && setMap(m))
        .catch((e) => alive && !isNotYoursYet(e) && setErr(e));
    }, 120);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [key, worker]);

  const [lo1, hi1] = ARM.joints[1].limits;
  const [lo2, hi2] = ARM.joints[2].limits;
  const ref = useCanvas(
    ({ ctx, width, height }) => {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);
      if (map) {
        let mx = 0;
        for (const v of map.values) mx = Math.max(mx, v);
        const field = new Float32Array(map.values.length);
        for (let i = 0; i < field.length; i++) field[i] = Math.sqrt(map.values[i] / (mx || 1));
        const img = new ImageData(map.res, map.res);
        ditherField(field, map.res, map.res, img.data, [0, 0.3, 0.65, 1]);
        const off = new OffscreenCanvas(map.res, map.res);
        off.getContext("2d")!.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(off, 0, 0, width, height);
      }
      const x = ((q[1] - lo1) / (hi1 - lo1)) * width;
      const y = ((hi2 - q[2]) / (hi2 - lo2)) * height;
      ctx.strokeStyle = grey(0);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = grey(1);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 16, y);
      ctx.lineTo(x + 16, y);
      ctx.moveTo(x, y - 16);
      ctx.lineTo(x, y + 16);
      ctx.stroke();
      // With the wrist pitch straight, the stretched (elbow = 0) row is a ridge of zeros.
      if (Math.abs(q[3]) < 0.05) {
        const y0 = (hi2 / (hi2 - lo2)) * height;
        label(ctx, "elbow = 0", 6, y0 - 10, { alpha: 0.8 });
      }
    },
    { animate: false },
    [map, q[1], q[2], q[3]],
  );

  return (
    <Sheet className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Manipulability over shoulder × elbow</p>
        <p className="font-mono text-xs text-ink-soft">{map ? `${map.res}² poses` : "computing…"}</p>
      </div>
      <canvas
        ref={ref}
        className="aspect-square w-full cursor-crosshair touch-none rounded-xl border border-rule [image-rendering:pixelated]"
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const u = (e.clientX - r.left) / r.width;
          const v = (e.clientY - r.top) / r.height;
          onPick(lo1 + u * (hi1 - lo1), hi2 - v * (hi2 - lo2));
        }}
      />
      <div className="flex justify-between font-mono text-[0.65rem] text-ink-soft">
        <span>q2 = {lo1.toFixed(1)}</span>
        <span>shoulder →</span>
        <span>{hi1.toFixed(1)}</span>
      </div>
      {err && <CoreError error={err} />}
      <p className="text-xs leading-snug text-ink-soft">Dark = singular. Tap anywhere to move the arm there. The other four joints stay where they are.</p>
    </Sheet>
  );
}

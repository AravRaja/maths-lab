"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { grey } from "@/kit/canvas";
import { CorePanel, CoreError } from "@/kit/components/core-guard";
import { Sheet } from "@/kit/components/page-shell";
import { AnimatedSwitch } from "@/components/spectrumui/animated-switch";
import { rodrigues, so3Log, invertSE3 } from "../core/se3";
import { add, cross, det, eye, fromRp, matDist, matMul, matVec, norm, normalize, scale, transpose, type Mat, type Vec } from "../lib/linalg";
import { Stage, type StageFrame } from "./stage";
import { drawTriad, line, polyline, label } from "./scene";
import { useCores } from "./use-cores";
import { LabeledSlider, MatrixGrid, Predict, Readout } from "./bits";

/*
 * M1: spin a frame. The axis k, the angle θ, the swept cone that a perpendicular vector traces,
 * and the rotated frame R = rodrigues(k, θ). Then a rigid transform T = [R p], its closed-form
 * inverse, and their product (which should land exactly on the world frame).
 */

const CAM = { yaw: -0.7, pitch: 0.42, dist: 3.2, target: [0.3, 0, 0.1], fov: 0.7 };

function axisFrom(az: number, el: number): Vec {
  return [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)];
}

function sphereRings(): Vec[][] {
  const rings: Vec[][] = [];
  for (let i = 1; i < 6; i++) {
    const z = -1 + (2 * i) / 6;
    const r = Math.sqrt(1 - z * z);
    rings.push(Array.from({ length: 65 }, (_, k) => [r * Math.cos((k / 64) * 2 * Math.PI), r * Math.sin((k / 64) * 2 * Math.PI), z]));
  }
  for (let m = 0; m < 6; m++) {
    const a = (m / 6) * Math.PI;
    rings.push(Array.from({ length: 65 }, (_, k) => {
      const t = (k / 64) * 2 * Math.PI;
      return [Math.cos(a) * Math.sin(t), Math.sin(a) * Math.sin(t), Math.cos(t)];
    }));
  }
  return rings;
}
const RINGS = sphereRings();

function drawSphere(f: StageFrame) {
  const c = f.ctx;
  c.save();
  c.strokeStyle = grey(1, 0.09);
  c.lineWidth = 1;
  for (const r of RINGS) {
    polyline(c, f.view, r);
    c.stroke();
  }
  c.restore();
  drawTriad(c, f.view, eye(4), 0.45, { alpha: 0.35 });
}

export function FramesSection() {
  const a = useCores();
  const [az, setAz] = useState(0.6);
  const [el, setEl] = useState(0.7);
  const [theta, setTheta] = useState(1.6);
  const [px, setPx] = useState(1.1);
  const [spin, setSpin] = useState(true);
  const live = useRef({ theta, spin });
  useEffect(() => {
    live.current = { theta, spin };
  }, [theta, spin]);

  // Sync the animated angle back to the slider a few times a second.
  const anim = useRef(theta);
  useEffect(() => {
    if (!spin) return;
    const id = window.setInterval(() => setTheta(+anim.current.toFixed(2)), 200);
    return () => window.clearInterval(id);
  }, [spin]);

  const k = useMemo(() => axisFrom(az, el), [az, el]);

  const readout = useMemo(() => {
    if (!a || a.rodrigues) return null;
    try {
      const R = rodrigues(k, theta);
      const T = fromRp(R, [px, 0, 0.25]);
      let inv: { Ti: Mat; err: number } | null = null;
      if (!a.invertSE3) {
        const Ti = invertSE3(T);
        inv = { Ti, err: matDist(matMul(T, Ti), eye(4)) };
      }
      let log: Vec | null = null;
      if (!a.so3Log) log = so3Log(R);
      return { R, T, inv, log, orth: matDist(matMul(transpose(R), R), eye(3)), d: det(R), error: null as Error | null };
    } catch (e) {
      return { error: e instanceof Error ? e : new Error(String(e)) } as const;
    }
  }, [a, k, theta, px]);

  if (!a) return <div className="h-80 rounded-2xl border border-rule bg-sheet" />;
  if (a.rodrigues)
    return (
      <CorePanel
        error={a.rodrigues}
        ghost={<Stage className="h-80" camera={CAM} animate={false} crisp={drawSphere} />}
      />
    );
  if (readout?.error) return <CoreError error={readout.error} />;

  const glow = (f: StageFrame) => {
    const s = live.current;
    const th = s.spin ? (anim.current = 3.0 * Math.sin(f.t * 0.4 + 0.6)) : s.theta;
    // The swept cone: vector v ⟂ k rotating to R v.
    const v0 = normalize(cross(k, Math.abs(k[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
    const g = f.glow;
    const steps = 40;
    const pts = [f.view.project([0, 0, 0])];
    try {
      for (let i = 0; i <= steps; i++) pts.push(f.view.project(matVec(rodrigues(k, (th * i) / steps), v0)));
    } catch {
      return;
    }
    g.fillStyle = grey(0.42);
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.closePath();
    g.fill();
    // The disc the cone lives in.
    const disc: Vec[] = Array.from({ length: 49 }, (_, i) => matVec(rodrigues(k, (i / 48) * 2 * Math.PI), v0));
    g.fillStyle = grey(0.12);
    g.beginPath();
    disc.forEach((p3, i) => {
      const p = f.view.project(p3);
      if (i) g.lineTo(p.x, p.y);
      else g.moveTo(p.x, p.y);
    });
    g.fill();
  };

  const crisp = (f: StageFrame) => {
    drawSphere(f);
    const c = f.ctx;
    const s = live.current;
    const th = s.spin ? anim.current : s.theta;
    try {
      const R = rodrigues(k, th);
      // Axis line with an arrowhead.
      c.save();
      c.strokeStyle = grey(1, 0.8);
      c.setLineDash([6, 4]);
      c.lineWidth = 1;
      line(c, f.view, scale(k, -1.25), scale(k, 1.25));
      c.setLineDash([]);
      const tip = f.view.project(scale(k, 1.25));
      c.fillStyle = grey(1);
      c.beginPath();
      c.arc(tip.x, tip.y, 3.5, 0, Math.PI * 2);
      c.fill();
      label(c, "k", tip.x + 8, tip.y);
      c.restore();
      // Rotated frame at the origin, bold.
      drawTriad(c, f.view, fromRp(R, [0, 0, 0]), 0.9, { width: 2.2 });
      // Rigid transform T at p and its inverse.
      const T = fromRp(R, [px, 0, 0.25]);
      drawTriad(c, f.view, T, 0.35, { labels: false, width: 1.6 });
      const pT = f.view.project([T[0][3], T[1][3], T[2][3]]);
      label(c, "T", pT.x + 8, pT.y + 10);
      try {
        const Ti = invertSE3(T);
        drawTriad(c, f.view, Ti, 0.35, { labels: false, alpha: 0.55 });
        const pI = f.view.project([Ti[0][3], Ti[1][3], Ti[2][3]]);
        label(c, "T⁻¹", pI.x + 8, pI.y + 10, { alpha: 0.6 });
        c.save();
        c.strokeStyle = grey(1, 0.25);
        c.setLineDash([2, 4]);
        line(c, f.view, [0, 0, 0], [Ti[0][3], Ti[1][3], Ti[2][3]]);
        line(c, f.view, [0, 0, 0], [T[0][3], T[1][3], T[2][3]]);
        c.restore();
      } catch {
        /* invertSE3 still a stub: just T */
      }
      label(c, `θ = ${th.toFixed(2)} rad`, 12, f.height - 16, { alpha: 0.7 });
    } catch {
      /* drawn by the guard above */
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl border border-rule">
        <Stage className="h-80 sm:h-96" camera={CAM} interaction="orbit" glow={glow} crisp={crisp} ariaLabel="A rotating coordinate frame" />
      </div>
      <Sheet className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Spin θ automatically</span>
          <AnimatedSwitch checked={spin} onCheckedChange={setSpin} label="Spin automatically" />
        </div>
        <LabeledSlider label="θ (rad)" value={theta} min={-Math.PI} max={Math.PI} onChange={(v) => { setSpin(false); setTheta(v); }} />
        <LabeledSlider label="Axis azimuth" value={az} min={-Math.PI} max={Math.PI} onChange={setAz} />
        <LabeledSlider label="Axis elevation" value={el} min={-1.5} max={1.5} onChange={setEl} />
        <LabeledSlider label="Translation p_x (m)" value={px} min={0} max={1.6} onChange={setPx} />
      </Sheet>
      {readout && !readout.error && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Sheet className="flex flex-col gap-3">
            <MatrixGrid M={readout.R!} digits={3} label="R = rodrigues(k, θ)" />
            <div className="grid grid-cols-2 gap-2">
              <Readout label="det R" value={readout.d!.toFixed(6)} />
              <Readout label="‖RᵀR − I‖" value={readout.orth!.toExponential(1)} />
            </div>
            <Readout
              label="so3Log(R)"
              value={readout.log ? `${norm(readout.log).toFixed(3)} rad` : "M4"}
              sub={readout.log ? `axis ${normalize(readout.log).map((v) => v.toFixed(2)).join(" ")}` : "so3Log() is written in milestone 4"}
            />
          </Sheet>
          {readout.inv ? (
            <Sheet className="flex flex-col gap-3">
              <MatrixGrid M={readout.inv.Ti} digits={3} label="T⁻¹ = invertSE3(T)" />
              <Readout label="‖T T⁻¹ − I‖" value={readout.inv.err.toExponential(1)} sub="should be ~1e-16: the closed form is exact" />
              <Readout label="T⁻¹ moves the origin to" value={add([0, 0, 0], [readout.inv.Ti[0][3], readout.inv.Ti[1][3], readout.inv.Ti[2][3]]).map((v) => v.toFixed(2)).join(", ")} />
            </Sheet>
          ) : (
            <CorePanel error={a.invertSE3!} />
          )}
        </div>
      )}
      <Predict>
        Set θ = π, note R, then swing the axis to point the opposite way (azimuth + π, elevation negated). Does R change?
        Decide before you drag, then think about what that means for <code className="font-mono text-ink">so3Log</code> at π.
      </Predict>
    </div>
  );
}

"use client";

import { useRef } from "react";
import { grey } from "@/kit/canvas";
import { forwardKinematics } from "../core/kinematics";
import { geometricJacobian } from "../core/jacobian";
import { kalmanPredict, kalmanUpdate } from "../core/kalman";
import { ARM, GHOST_POSES, HOME, REACH, dance } from "../lib/arm";
import { ikIterate } from "../lib/ik-loop";
import { velocityEllipsoid } from "../lib/ellipsoid";
import { constantVelocity, firefly } from "../lib/tracker";
import { eye, lerp, matScale, posOf, type Mat, type Vec } from "../lib/linalg";
import { gaussian, rng } from "../lib/rng";
import { Stage, type StageFrame } from "./stage";
import { useCores } from "./use-cores";
import {
  armPoints,
  drawArmCrisp,
  drawArmGlow,
  drawEllipsoidCrisp,
  drawEllipsoidGlow,
  drawFloor,
  drawTarget,
  glowBackdrop,
  glowStatic,
  label,
} from "./scene";

/*
 * The signature visual. A dithered six-joint arm chases your pointer (or a wandering firefly) with
 * the user's IK, wearing its velocity ellipsoid. As it nears a singularity the ellipsoid flattens
 * into a disc and the picture breaks into static. Each written core upgrades the scene:
 *   nothing            ghost poses (plain numbers), drawn hatched
 *   forwardKinematics  the real arm, dancing in joint space
 *   + Jacobian         the ellipsoid and the singularity glitch
 *   + dlsStep          it chases the target
 *   + Kalman           it only sees the target through noise, and chases the filter's estimate
 */

const DT = 1 / 40;
const MEAS_SIGMA = 0.06;

export function Hero() {
  const a = useCores();
  const st = useRef({
    q: HOME.slice(),
    target: firefly(0),
    manual: null as Vec | null,
    wMax: 0.05,
    glitch: 0,
    kf: { x: [...firefly(0), 0, 0, 0], P: matScale(eye(6), 0.1) } as { x: Vec; P: Mat },
    meas: [] as Vec[],
    acc: 0,
    g: gaussian(rng(3)),
  });

  const fk = a && !a.forwardKinematics;
  const jac = fk && !a.geometricJacobian;
  const ik = jac && !a.dlsStep;
  const kalman = !!a && !a.kalmanPredict && !a.kalmanUpdate;

  const step = (f: StageFrame) => {
    const s = st.current;
    const truth = f.idle < 4 && s.manual ? s.manual : firefly(f.t);
    s.target = lerp(s.target, truth, 0.2);
    if (!fk) return;
    try {
      if (kalman) {
        // Camera at 40 Hz with Gaussian noise; filter on a constant-velocity model.
        s.acc += f.dt;
        const { F, Q, H } = constantVelocity(3, DT, 4);
        const R = matScale(eye(3), MEAS_SIGMA ** 2);
        while (s.acc >= DT) {
          s.acc -= DT;
          const z = s.target.map((v) => v + MEAS_SIGMA * s.g());
          s.meas.push(z);
          if (s.meas.length > 40) s.meas.shift();
          const p = kalmanPredict(s.kf.x, s.kf.P, F, Q);
          const u = kalmanUpdate(p.x, p.P, z, H, R);
          s.kf = { x: u.x, P: u.P };
        }
      }
      if (ik) {
        const goal = kalman ? s.kf.x.slice(0, 3) : s.target;
        for (let k = 0; k < 3; k++) s.q = ikIterate(s.q, { p: goal }, { lambda: 0.035, maxStep: 0.05 }).q;
      } else {
        s.q = dance(f.t * 1.3);
      }
    } catch {
      // A core that is written but broken: freeze the pose rather than kill the hero.
    }
  };

  const glow = (f: StageFrame) => {
    const s = st.current;
    const g = f.glow;
    glowBackdrop(g, f.width, f.height, 0.07);
    if (!fk) {
      // Ghost: blend between three hard-coded poses.
      const k = (f.t * 0.25) % GHOST_POSES.length;
      const i = Math.floor(k);
      const u = k - i;
      const e = u * u * (3 - 2 * u);
      const pts = GHOST_POSES[i].map((p, j) => lerp(p, GHOST_POSES[(i + 1) % GHOST_POSES.length][j], e));
      drawArmGlow(g, f.view, pts, { level: 0.45 });
      return;
    }
    try {
      const frames = forwardKinematics(s.q, ARM);
      const pts = armPoints(frames);
      if (jac) {
        const J = geometricJacobian(frames, ARM);
        const { axes, sigma } = velocityEllipsoid(J.slice(0, 3), 0.28);
        const w = sigma[0] * sigma[1] * sigma[2];
        s.wMax = Math.max(s.wMax * 0.999, w);
        const near = 1 - Math.min(1, sigma[2] / (0.12 * sigma[0] + 1e-9));
        s.glitch += (near - s.glitch) * 0.15;
        drawEllipsoidGlow(g, f.view, posOf(frames[ARM.joints.length]), axes, 0.32);
      }
      drawArmGlow(g, f.view, pts);
      glowStatic(g, f.width, f.height, s.glitch ** 2, Math.floor(f.t * 30));
    } catch {
      /* broken core: draw nothing extra */
    }
  };

  const back = (f: StageFrame) => drawFloor(f.ctx, f.view, { reach: REACH });

  const crisp = (f: StageFrame) => {
    const s = st.current;
    const c = f.ctx;
    const v = f.view;
    if (ik || !fk) drawTarget(c, v, s.target, { alpha: kalman ? 0.35 : 1, label: kalman ? undefined : "target" });
    if (kalman) {
      s.meas.forEach((z, i) => {
        const p = v.project(z);
        c.fillStyle = grey(1, (i / s.meas.length) * 0.7);
        c.fillRect(p.x - 1, p.y - 1, 2, 2);
      });
      drawTarget(c, v, s.kf.x.slice(0, 3), { style: "ring", size: 7, label: "estimate" });
    }
    if (!fk) {
      const k = (f.t * 0.25) % GHOST_POSES.length;
      const i = Math.floor(k);
      const u = k - i;
      const e = u * u * (3 - 2 * u);
      const pts = GHOST_POSES[i].map((p, j) => lerp(p, GHOST_POSES[(i + 1) % GHOST_POSES.length][j], e));
      drawArmCrisp(c, v, pts, { alpha: 0.55, dashed: true });
      label(c, a ? "GHOST POSE · forwardKinematics() is yours to write" : "loading", 12, f.height - 16, { alpha: 0.7 });
      return;
    }
    try {
      const frames = forwardKinematics(s.q, ARM);
      const pts = armPoints(frames);
      if (jac) {
        const J = geometricJacobian(frames, ARM);
        const { axes, sigma } = velocityEllipsoid(J.slice(0, 3), 0.28);
        drawEllipsoidCrisp(c, v, posOf(frames[ARM.joints.length]), axes, 0.75);
        const w = sigma[0] * sigma[1] * sigma[2];
        // Singularity meter, right edge.
        const hgt = Math.min(140, f.height * 0.45);
        const x = f.width - 16;
        const y0 = 14;
        c.strokeStyle = grey(1, 0.4);
        c.strokeRect(x - 3, y0, 6, hgt);
        const lvl = Math.min(1, w / (s.wMax || 1));
        c.fillStyle = grey(1);
        c.fillRect(x - 3, y0 + hgt * (1 - lvl), 6, hgt * lvl);
        label(c, `w ${w.toFixed(4)}`, x - 10, y0 + 6, { align: "right" });
        label(c, `σ ${sigma.map((q) => q.toFixed(2)).join(" ")}`, x - 10, y0 + 22, { align: "right", alpha: 0.6 });
        if (s.glitch > 0.6) label(c, "NEAR SINGULAR", f.width / 2, 18, { align: "center", alpha: 1 });
      }
      drawArmCrisp(c, v, pts);
      label(c, ik ? (kalman ? "chasing the Kalman estimate" : "tap or move to set the target") : jac ? "dlsStep() next: then it chases you" : "dancing in joint space · Jacobian next", 12, f.height - 16, { alpha: 0.6 });
    } catch (e) {
      label(c, `core threw: ${e instanceof Error ? e.message.slice(0, 60) : "error"}`, 12, f.height - 16);
    }
  };

  return (
    <Stage
      className="h-full touch-pan-y"
      camera={{ yaw: -0.9, pitch: 0.34, dist: 2.25, target: [0.3, 0, 0.5], fov: 0.75 }}
      autoRotate={0.06}
      interaction="target"
      planeCenter={[0.45, 0, 0.55]}
      onTarget={(p) => {
        // Keep the target roughly inside a ball a bit bigger than the reach, above the floor.
        const c = [0, 0, 0.38];
        const d = p.map((x, i) => x - c[i]);
        const n = Math.hypot(d[0], d[1], d[2]);
        const m = Math.min(1, (REACH * 1.15) / n);
        const q = c.map((x, i) => x + d[i] * m);
        q[2] = Math.max(0.05, q[2]);
        st.current.manual = q;
      }}
      step={step}
      back={back}
      glow={glow}
      crisp={crisp}
      ariaLabel="A dithered robot arm reaching for a target, with its velocity ellipsoid"
    />
  );
}

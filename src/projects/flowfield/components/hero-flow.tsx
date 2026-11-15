"use client";

import { useRef } from "react";
import { useCanvas } from "@/kit/components/use-canvas";
import { grey } from "@/kit/canvas";
import { fbm } from "@/kit/dither";
import { conditionalPath } from "../core/path";
import { marginalVelocity } from "../core/marginal";
import { eulerStep } from "../core/euler";
import { GLYPHS, glyphPoints } from "../lib/glyphs";
import { gaussVec, mulberry32 } from "../lib/rng";
import { makeView } from "../lib/view";
import { label, offscreen } from "./draw";
import { useFlowCores } from "./use-flow-cores";

/*
 * Signature visual. A thousand particles of Gaussian noise stream along a velocity field into a
 * maths glyph, hold, then run the ODE backwards and dissolve into noise before the next glyph.
 * What drives them depends on which cores are written:
 *   none                         → curl-noise drift (waiting)
 *   conditionalPath              → straight conditional lines, each particle paired with a data point
 *   + marginalVelocity + eulerStep → the exact marginal field, integrated with your Euler step
 * Tap or drag to stir: in the exact field, the flow pulls the particles back.
 */

const N = 850;
const DATA = 180;
const SIGMA = 0.04;
const T_FWD = 3.2;
const T_HOLD = 1.6;
const T_BACK = 2.4;

type Mode = "drift" | "lines" | "flow";
type Phase = "fwd" | "hold" | "back";

interface Sim {
  pos: Float32Array;
  x0: Float32Array;
  pick: Uint16Array;
  t: number;
  phase: Phase;
  hold: number;
  glyph: number;
  mode: Mode | null;
  broken: boolean;
}

function init(): Sim {
  const rng = mulberry32(42);
  const pos = new Float32Array(N * 2);
  const x0 = new Float32Array(N * 2);
  const pick = new Uint16Array(N);
  for (let i = 0; i < N; i++) {
    const g = gaussVec(rng, 2);
    x0[2 * i] = pos[2 * i] = g[0];
    x0[2 * i + 1] = pos[2 * i + 1] = g[1];
    pick[i] = Math.floor(rng() * DATA);
  }
  return { pos, x0, pick, t: 0, phase: "fwd", hold: 0, glyph: 0, mode: null, broken: false };
}

export function HeroFlow() {
  const cores = useFlowCores();
  const sim = useRef<Sim | null>(null);
  const rng = useRef(mulberry32(7));

  const ref = useCanvas(
    ({ ctx, width, height, t: now, dt, pointer }) => {
      if (dt > 0 && offscreen(ctx)) return;
      if (!sim.current) sim.current = init();
      const s = sim.current;
      const mode: Mode = !cores || cores.path || s.broken ? "drift" : cores.marginal || cores.euler ? "lines" : "flow";
      if (s.mode !== mode) {
        // Changing driver: restart from noise.
        s.mode = mode;
        s.t = 0;
        s.phase = "fwd";
        s.pos.set(s.x0);
      }
      const view = makeView(width, height, 2.05, 8);
      const data = glyphPoints(GLYPHS[s.glyph % GLYPHS.length], DATA, 5 + s.glyph);
      const step = Math.min(dt, 1 / 20);

      // Clock.
      let tPrev = s.t;
      if (s.phase === "fwd") {
        s.t = Math.min(1, s.t + step / T_FWD);
        if (s.t >= 1) { s.phase = "hold"; s.hold = 0; }
      } else if (s.phase === "hold") {
        s.hold += step;
        if (s.hold > T_HOLD) s.phase = "back";
        tPrev = s.t;
      } else {
        s.t = Math.max(0, s.t - step / T_BACK);
        if (s.t <= 0) {
          s.phase = "fwd";
          s.glyph++;
          const r = rng.current;
          for (let i = 0; i < N; i++) s.pick[i] = Math.floor(r() * DATA);
          if (mode !== "flow") s.pos.set(s.x0);
        }
      }

      // Move.
      try {
        if (mode === "flow" && s.phase !== "hold" && step > 0) {
          const v = (x: number[], tt: number) => marginalVelocity(x, tt, data, SIGMA);
          const dtt = s.t - tPrev;
          for (let i = 0; i < N; i++) {
            const nx = eulerStep(v, [s.pos[2 * i], s.pos[2 * i + 1]], tPrev, dtt);
            s.pos[2 * i] = nx[0];
            s.pos[2 * i + 1] = nx[1];
          }
        } else if (mode === "lines") {
          for (let i = 0; i < N; i++) {
            const p = conditionalPath([s.x0[2 * i], s.x0[2 * i + 1]], data[s.pick[i] % data.length], s.t, SIGMA);
            s.pos[2 * i] = p[0];
            s.pos[2 * i + 1] = p[1];
          }
        } else if (mode === "drift") {
          const k = now * 0.05;
          for (let i = 0; i < N; i++) {
            const x = s.pos[2 * i], y = s.pos[2 * i + 1];
            const e = 0.02;
            const n0 = fbm(x * 0.8 + 3, y * 0.8 + k, 9);
            const vx = (fbm(x * 0.8 + 3, y * 0.8 + k + e, 9) - n0) / e;
            const vy = -(fbm(x * 0.8 + 3 + e, y * 0.8 + k, 9) - n0) / e;
            s.pos[2 * i] = x + vx * step * 1.8;
            s.pos[2 * i + 1] = y + vy * step * 1.8;
            if (Math.abs(s.pos[2 * i]) > 2.6 || Math.abs(s.pos[2 * i + 1]) > 2.2) {
              s.pos[2 * i] = s.x0[2 * i];
              s.pos[2 * i + 1] = s.x0[2 * i + 1];
            }
          }
        }
      } catch {
        s.broken = true;
      }

      // Stir.
      if (pointer?.down && mode !== "lines") {
        const [px, py] = view.toWorld(pointer.x, pointer.y);
        for (let i = 0; i < N; i++) {
          const dx = s.pos[2 * i] - px, dy = s.pos[2 * i + 1] - py;
          const r2 = dx * dx + dy * dy;
          if (r2 < 0.3) {
            const f = (0.3 - r2) * 0.25;
            s.pos[2 * i] += dx * f * 4;
            s.pos[2 * i + 1] += dy * f * 4;
          }
        }
      }

      // Draw: fade for trails, then particles.
      ctx.fillStyle = dt === 0 ? grey(0) : grey(0, mode === "drift" ? 0.07 : 0.22);
      ctx.fillRect(0, 0, width, height);
      if (mode === "drift") {
        // Waiting: the glyph the particles will flow into, as a faint target, cycling.
        const g = Math.floor(now / 5) % GLYPHS.length;
        const ghost = glyphPoints(GLYPHS[g], DATA, 5 + g);
        const pulse = 0.022 + 0.012 * Math.sin(now * 1.3); // accumulates under the trail fade
        ctx.fillStyle = grey(1, pulse);
        for (const p of ghost) ctx.fillRect(view.x(p[0]) - 1.5, view.y(p[1]) - 1.5, 3, 3);
      }
      const size = width < 500 ? 1.3 : 1.6;
      ctx.fillStyle = grey(1, mode === "drift" ? 0.75 : 0.92);
      for (let i = 0; i < N; i++) {
        const x = view.x(s.pos[2 * i]), y = view.y(s.pos[2 * i + 1]);
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }

      // Readouts (drawn on a cleared band so the trails don't smear them).
      const tag = mode === "flow" ? `exact field · euler · ${GLYPHS[s.glyph % GLYPHS.length]}` : mode === "lines" ? "straight lines · M1" : "waiting for your cores";
      ctx.fillStyle = grey(0);
      ctx.fillRect(10, 10, 92, 16);
      ctx.fillRect(width - 14 - tag.length * 8.6, height - 26, tag.length * 8.6 + 6, 16);
      label(ctx, `t = ${s.t.toFixed(2)}`, 14, 13, "left", 0.9);
      label(ctx, tag, width - 14, height - 23, "right", 0.6);
    },
    { fps: 30 },
  );

  return <canvas ref={ref} aria-label="Particles of noise flowing into a maths glyph" className="block h-full w-full touch-none" />;
}

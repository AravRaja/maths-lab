"use client";

import { useEffect, useRef, useState } from "react";
import { useCanvas } from "@/kit/components/use-canvas";
import { grey } from "@/kit/canvas";
import { ditherField } from "@/kit/dither";
import { isNotYoursYet } from "@/kit/not-yours-yet";
import { buildGraph, compile, parse } from "@/projects/chainrule/lib/engine/expr";
import { runBackward } from "@/projects/chainrule/lib/engine/value";
import { rng } from "@/projects/chainrule/lib/engine/rng";

/**
 * The signature visual: a loss landscape, Bayer-dithered with crawling contour bands, and a swarm
 * of particles that slide downhill using ∇f from the user's autograd engine. With the cores still
 * stubs the particles are blind: they wander. Tap to drop a handful.
 */
export const HERO_EXPR =
  "0.18*(x^2 + y^2) - 1.5*exp(-1.4*((x - 1.1)^2 + (y - 0.5)^2)) - 1.1*exp(-2*((x + 1.2)^2 + (y + 0.6)^2)) + 0.35*tanh(2*x*y)";

const AST = parse(HERO_EXPR);
const F = compile(AST, ["x", "y"]);
const SPAN = 2.2; // y in [-SPAN, SPAN]; x scales with aspect
const PIXEL = 3;
const TONES = [0, 0.08, 0.17, 0.3, 0.46];

type P = { x: number; y: number; age: number; life: number };

/** ∇f at (x, y) through the user's engine. Throws NotYoursYet while the cores are stubs. */
function grad(x: number, y: number): [number, number] {
  const { root, leaves } = buildGraph(AST, { x, y });
  runBackward(root);
  return [leaves.x.grad, leaves.y.grad];
}

export function HeroSwarm() {
  const [live, setLive] = useState<boolean | null>(null);
  const liveRef = useRef<boolean | null>(null);
  const state = useRef<{
    w: number; h: number; field: Float32Array; lo: number; hi: number; img: ImageData; off: OffscreenCanvas;
    trail: OffscreenCanvas; ps: P[]; r: () => number;
  } | null>(null);

  useEffect(() => {
    let ok = false;
    try {
      grad(0.3, -0.2);
      ok = true;
    } catch (e) {
      // NotYoursYet = cores still stubs; anything else = written but broken. Either way the swarm stays blind.
      void isNotYoursYet(e);
    }
    liveRef.current = ok;
    // Reading the cores is a one-off external check on mount, so syncing it into state here is intended.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLive(ok);
  }, []);

  const ref = useCanvas(
    ({ ctx, width, height, t, dt, pointer }) => {
      const w = Math.max(8, Math.floor(width / PIXEL));
      const h = Math.max(8, Math.floor(height / PIXEL));
      const aspect = width / height;
      const toWorld = (u: number, v: number): [number, number] => [(u * 2 - 1) * SPAN * aspect, (1 - v * 2) * SPAN];
      const toScreen = (x: number, y: number): [number, number] => [((x / (SPAN * aspect) + 1) / 2) * width, ((1 - y / SPAN) / 2) * height];

      let s = state.current;
      if (!s || s.w !== w || s.h !== h) {
        const field = new Float32Array(w * h);
        let lo = Infinity, hi = -Infinity;
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
          const [x, y] = toWorld((i + 0.5) / w, (j + 0.5) / h);
          const v = F([x, y]);
          field[j * w + i] = v;
          lo = Math.min(lo, v); hi = Math.max(hi, v);
        }
        const r = rng(42);
        const n = Math.round(Math.min(520, Math.max(220, (width * height) / 260)));
        const ps: P[] = Array.from({ length: n }, () => spawn(r, aspect));
        ps.forEach((p) => (p.age = r() * p.life));
        s = state.current = { w, h, field, lo, hi, img: new ImageData(w, h), off: new OffscreenCanvas(w, h), trail: new OffscreenCanvas(Math.round(width), Math.round(height)), ps, r };
      }

      // Dithered landscape with contour bands crawling downhill.
      const shown = new Float32Array(s.field.length);
      const span = s.hi - s.lo || 1;
      for (let i = 0; i < shown.length; i++) {
        const v = (s.field[i] - s.lo) / span;
        const band = 0.5 + 0.5 * Math.sin(v * 46 + t * 1.6);
        shown[i] = Math.pow(v, 0.8) * 0.86 + band * 0.12;
      }
      ditherField(shown, w, h, s.img.data, TONES);
      s.off.getContext("2d")!.putImageData(s.img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(s.off, 0, 0, w * PIXEL, h * PIXEL);

      // Particles.
      const tc = s.trail.getContext("2d")!;
      if (s.trail.width !== Math.round(width) || s.trail.height !== Math.round(height)) {
        s.trail.width = Math.round(width);
        s.trail.height = Math.round(height);
      }
      tc.globalCompositeOperation = "destination-out";
      tc.fillStyle = "rgba(0,0,0,0.075)";
      tc.fillRect(0, 0, width, height);
      tc.globalCompositeOperation = "source-over";
      const isLive = liveRef.current === true;
      tc.strokeStyle = isLive ? grey(1, 0.9) : grey(0.92, 0.6);
      tc.lineWidth = isLive ? 1.3 : 1.1;
      tc.lineCap = "round";
      const step = Math.min(0.05, dt || 0.033);

      if (pointer?.down) {
        const [px, py] = [(pointer.x / width) * 2 - 1, 1 - (pointer.y / height) * 2];
        for (let k = 0; k < 4; k++) {
          const p = s.ps[Math.floor(s.r() * s.ps.length)];
          p.x = px * SPAN * aspect + (s.r() - 0.5) * 0.3;
          p.y = py * SPAN + (s.r() - 0.5) * 0.3;
          p.age = 0;
        }
      }

      tc.beginPath();
      for (const p of s.ps) {
        const [sx0, sy0] = toScreen(p.x, p.y);
        let vx = 0, vy = 0;
        if (isLive) {
          try {
            const [gx, gy] = grad(p.x, p.y);
            const m = Math.hypot(gx, gy);
            const cap = m > 3 ? 3 / m : 1;
            vx = -gx * cap * 1.25;
            vy = -gy * cap * 1.25;
          } catch {
            liveRef.current = false;
          }
          vx += (s.r() - 0.5) * 0.25;
          vy += (s.r() - 0.5) * 0.25;
        } else {
          // Blind: a slow curl-ish wander.
          vx = Math.sin(p.y * 1.7 + t * 0.4 + p.life) * 0.7 + (s.r() - 0.5) * 0.5;
          vy = Math.cos(p.x * 1.3 - t * 0.3) * 0.7 + (s.r() - 0.5) * 0.5;
        }
        p.x += vx * step;
        p.y += vy * step;
        p.age += step;
        const [sx1, sy1] = toScreen(p.x, p.y);
        tc.moveTo(sx0, sy0);
        tc.lineTo(sx1 + 0.01, sy1);
        if (p.age > p.life || Math.abs(p.x) > SPAN * aspect * 1.05 || Math.abs(p.y) > SPAN * 1.05) Object.assign(p, spawn(s.r, aspect));
      }
      tc.stroke();
      ctx.drawImage(s.trail, 0, 0, width, height);
    },
    { fps: 30 },
  );

  return (
    <div className="relative h-full w-full">
      <canvas ref={ref} aria-hidden className="block h-full w-full touch-none [image-rendering:pixelated]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-paper/90 to-transparent px-4 pt-10 pb-3">
        <p className="type-narrow text-[11px] leading-tight tracking-[0.18em] text-ink-soft uppercase">
          {live === null ? "probing cores" : live ? "∇f by your backprop · tap to drop" : "blind particles · ∇f is yours to write"}
        </p>
        <span className="type-narrow shrink-0 text-[11px] tracking-[0.18em] text-ink uppercase">{live ? "live" : "m1 + m2"}</span>
      </div>
    </div>
  );
}

function spawn(r: () => number, aspect: number): P {
  return { x: (r() * 2 - 1) * SPAN * aspect, y: (r() * 2 - 1) * SPAN, age: 0, life: 3 + r() * 5 };
}

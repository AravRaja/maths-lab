"use client";

import { useRef } from "react";
import { useCanvas } from "@/kit/components/use-canvas";
import { grey } from "@/kit/canvas";
import { fbm } from "@/kit/dither";
import { isNotYoursYet } from "@/kit/not-yours-yet";
import { betaUpdate } from "../core/beta";
import type { BetaParams } from "../core/types";
import { betaPdf } from "../lib/special";
import { mulberry32 } from "../lib/rng";

const RIDGES = 30;
const SAMPLES = 120;
const MAX_FLIPS = 72;

interface Snap {
  post: BetaParams | null;
  n: number;
  h: number;
}

interface State {
  rng: () => number;
  theta: number;
  cur: BetaParams;
  h: number;
  n: number;
  snaps: Snap[];
  acc: number;
  belief: boolean;
}

function fresh(rng: () => number): State {
  return { rng, theta: 0.18 + 0.64 * rng(), cur: { a: 1, b: 1 }, h: 0, n: 0, snaps: [], acc: 0, belief: true };
}

/** One flip through the user's betaUpdate. Falls back to "noise" mode while it is a stub. */
function flip(s: State) {
  const heads = s.rng() < s.theta ? 1 : 0;
  s.n++;
  s.h += heads;
  let post: BetaParams | null = null;
  try {
    post = betaUpdate(s.cur, heads, 1 - heads);
    s.cur = post;
    s.belief = true;
  } catch (e) {
    if (!isNotYoursYet(e)) throw e;
    s.belief = false;
  }
  s.snaps.push({ post, n: s.n, h: s.h });
  if (s.snaps.length > RIDGES) s.snaps.shift();
}

/**
 * The signature visual: an "Unknown Pleasures" stack of posteriors. Each ridge is the belief about a
 * hidden coin after one more flip, oldest at the back, newest (sharpest) at the front. While
 * betaUpdate() is a stub the ridges are prior noise; write it and the noise turns into belief.
 */
export function RidgeHero() {
  const st = useRef<State | null>(null);

  const ref = useCanvas(
    ({ ctx, width, height, t, dt, pointer }) => {
      if (!st.current) {
        const s = fresh(mulberry32(20261115));
        for (let i = 0; i < 52; i++) flip(s);
        st.current = s;
      }
      const s = st.current;
      // Flip cadence; hold the pointer down to flip faster.
      s.acc += dt * (pointer?.down ? 24 : 6);
      while (s.acc >= 1) {
        s.acc -= 1;
        if (s.n >= MAX_FLIPS) {
          // New hidden coin, flat prior again; old ridges scroll away behind the new ones.
          s.theta = 0.18 + 0.64 * s.rng();
          s.cur = { a: 1, b: 1 };
          s.n = 0;
          s.h = 0;
        }
        flip(s);
      }

      ctx.fillStyle = grey(0);
      ctx.fillRect(0, 0, width, height);

      const left = width * 0.1;
      const right = width * 0.9;
      const top = height * 0.2;
      const bottom = height * 0.9;
      const k = s.snaps.length;
      const gap = (bottom - top) / Math.max(1, RIDGES - 1);
      const amp = gap * 7.5;

      // Shapes first, so heights can be scaled against the sharpest visible posterior.
      const shapes: Float32Array[] = [];
      let peak = 1e-9;
      for (let i = 0; i < k; i++) {
        const sn = s.snaps[i];
        const arr = new Float32Array(SAMPLES + 1);
        for (let j = 0; j <= SAMPLES; j++) {
          const th = j / SAMPLES;
          let v: number;
          if (sn.post) v = Math.sqrt(betaPdf(th, sn.post.a, sn.post.b));
          else {
            const env = Math.exp(-(((th - 0.5) / 0.2) ** 2));
            v = env * (0.15 + 1.4 * fbm(th * 9 + i * 1.7, t * 0.9 + i * 0.37, 5) ** 3) + 0.04 * fbm(th * 40, i + t * 2, 9);
          }
          arr[j] = v;
          if (v > peak) peak = v;
        }
        shapes.push(arr);
      }

      // Truth marker behind everything (only once there is a belief to compare it with).
      const tx = left + (right - left) * s.theta;
      ctx.strokeStyle = grey(s.belief ? 0.35 : 0);
      ctx.setLineDash([1.5, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tx, top - gap * 2);
      ctx.lineTo(tx, bottom + 6);
      ctx.stroke();
      ctx.setLineDash([]);

      // Back to front: fill black underneath each ridge so nearer ridges hide farther ones.
      for (let i = 0; i < k; i++) {
        const slot = RIDGES - k + i;
        const base = top + slot * gap;
        const arr = shapes[i];
        const recency = (i + 1) / k;
        ctx.beginPath();
        ctx.moveTo(left, base);
        for (let j = 0; j <= SAMPLES; j++) {
          ctx.lineTo(left + ((right - left) * j) / SAMPLES, base - (arr[j] / peak) * amp);
        }
        ctx.lineTo(right, base);
        ctx.closePath();
        ctx.fillStyle = grey(0);
        ctx.fill();
        ctx.strokeStyle = grey(0.25 + 0.75 * recency);
        ctx.lineWidth = i === k - 1 ? 1.8 : 1.1;
        ctx.stroke();
      }

      // Labels.
      const newest = s.snaps[k - 1];
      ctx.fillStyle = grey(0.55);
      ctx.font = "600 10px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textBaseline = "top";
      ctx.fillText(s.belief ? "P(θ | FLIPS)" : "PRIOR NOISE", left, height * 0.06);
      if (!s.belief) {
        ctx.fillStyle = grey(0.4);
        ctx.fillText("write betaUpdate()", left, height * 0.06 + 14);
        ctx.fillStyle = grey(0.55);
      }
      ctx.textAlign = "right";
      if (newest) {
        const tails = newest.n - newest.h;
        ctx.fillText(`n ${newest.n}  ·  ${newest.h}H ${tails}T`, right, height * 0.06);
      }
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = grey(0.4);
      ctx.fillText("0", left, height - 8);
      ctx.textAlign = "right";
      ctx.fillText("1", right, height - 8);
      ctx.textAlign = "center";
      ctx.fillText(s.belief ? "true θ" : "θ", s.belief ? tx : (left + right) / 2, height - 8);
      ctx.textAlign = "left";
    },
    { fps: 30 },
  );

  return <canvas ref={ref} aria-label="A stack of posterior curves sharpening as coin flips arrive" className="block h-full w-full touch-none" />;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useCanvas } from "@/kit/components/use-canvas";
import { useWorker } from "@/kit/components/use-worker";
import { grey } from "@/kit/canvas";
import { isNotYoursYet } from "@/kit/not-yours-yet";
import { rankK } from "../core/lowrank";
import type { Matrix, SVD } from "../core/types";
import { layer } from "../lib/svd";
import { presetImage } from "../lib/images";
import type { handlers } from "../workers/rank.worker";
import { drawMatrix } from "./raster";
import { font } from "./canvas-font";

/*
 * The signature visual. A portrait is rebuilt from its strongest rank-one layers: k climbs
 * 1, 2, 3 … 128 and each new rank wipes down the frame, Bayer-dithered, while the singular
 * value "equaliser" on the right lights up the layers in use. Drag across it to scrub k.
 *
 * With rankK() still a stub, the hero shows the raw material instead: the rank-one layers
 * σ_i u_i v_iᵀ one at a time, the plaid pieces your sum will add up.
 */

const N = 128;
const KS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64, 96, 128];
const HOLD = 0.75; // seconds per rank
const WIPE = 0.35;
const LAYERS = 14;

type Mode = "loading" | "sum" | "layers";

export function RankHero() {
  const worker = useWorker<typeof handlers>(() => new Worker(new URL("../workers/rank.worker.ts", import.meta.url)));
  const img = useRef<Matrix | null>(null);
  const svdRef = useRef<SVD | null>(null);
  const frames = useRef<Float64Array[]>([]);
  const layers = useRef<Float64Array[]>([]);
  const logS = useRef<number[]>([]);
  const mode = useRef<Mode>("loading");
  const scrub = useRef<{ active: boolean; idx: number }>({ active: false, idx: 0 });
  const [, setReady] = useState(false);

  useEffect(() => {
    img.current = presetImage("portrait", N);
    let alive = true;
    const go = () => {
      const w = worker.current;
      if (!w || !img.current) return void setTimeout(go, 30);
      w.call("svd", { A: img.current }).then(({ svd: s }) => {
        if (!alive) return;
        svdRef.current = s;
        const top = Math.log10(s.S[0] || 1);
        logS.current = Array.from(s.S, (x) => Math.max(0, (Math.log10(Math.max(x, 1e-6)) - (top - 4)) / 4));
        layers.current = Array.from({ length: LAYERS }, (_, i) => robust(layer(s, i).data));
        try {
          frames.current = KS.map((k) => rankK(s, k).data);
          mode.current = "sum";
        } catch (e) {
          // NotYoursYet: rankK is still a stub. Anything else: written but broken. Either way, show the layers.
          void isNotYoursYet(e);
          mode.current = "layers";
        }
        setReady(true);
      }).catch(() => {});
    };
    go();
    return () => {
      alive = false;
    };
  }, [worker]);

  const ref = useCanvas(
    ({ ctx, width, height, t, pointer }) => {
      ctx.fillStyle = grey(0);
      ctx.fillRect(0, 0, width, height);
      const pad = Math.max(10, Math.round(height * 0.045));
      const side = Math.min(height - pad * 2, width * 0.72);
      const ix = pad, iy = (height - side) / 2;
      const px = side > 360 ? 3 : 2;
      const A = img.current;
      if (!A) return;
      const m = mode.current;

      // Which frame are we on?
      const per = m === "layers" ? 1.1 : HOLD;
      const count = m === "layers" ? LAYERS : KS.length;
      if (pointer?.down && pointer.x > ix + side) scrub.current = { active: true, idx: Math.floor(((pointer.y - iy) / side) * count) };
      else if (pointer?.down && pointer.x <= ix + side) scrub.current = { active: true, idx: Math.floor(((pointer.x - ix) / side) * count) };
      else scrub.current.active = false;
      const cycle = Math.floor(t / per);
      let idx = scrub.current.active ? Math.max(0, Math.min(count - 1, scrub.current.idx)) : cycle % (count + 3);
      const hold = idx >= count; // linger on the last frame
      if (hold) idx = count - 1;
      const phase = scrub.current.active || hold ? 1 : Math.min(1, (t - cycle * per) / WIPE);

      // Image area.
      if (m === "loading") {
        drawMatrix(ctx, A.data, N, N, ix, iy, side, side, { dither: true, cell: px, tones: [0, 0.18, 0.4] }, "hero0");
        label(ctx, ix + 10, iy + side - 12, "SVD · computing");
      } else {
        const cur = m === "sum" ? frames.current[idx] : layers.current[idx];
        const prev = m === "sum" ? frames.current[Math.max(0, idx - 1)] : layers.current[(idx + count - 1) % count];
        const range: [number, number] = [0, 1];
        const tones = m === "sum" ? [0, 0.3, 0.62, 1] : [0, 0.25, 0.55, 1];
        if (prev && phase < 1) drawMatrix(ctx, prev, N, N, ix, iy, side, side, { dither: true, cell: px, range, tones }, "heroP");
        // Wipe: the new frame is revealed top to bottom behind a bright scan line.
        const cut = Math.round(side * phase);
        ctx.save();
        ctx.beginPath();
        ctx.rect(ix, iy, side, cut);
        ctx.clip();
        drawMatrix(ctx, cur, N, N, ix, iy, side, side, { dither: true, cell: px, range, tones }, "heroC");
        ctx.restore();
        if (phase < 1) {
          ctx.fillStyle = grey(1, 0.9);
          ctx.fillRect(ix, iy + cut - 1, side, 2);
          ctx.fillStyle = grey(1, 0.12);
          ctx.fillRect(ix, iy + cut - 14, side, 12);
        }
        ctx.strokeStyle = grey(0.16);
        ctx.strokeRect(ix + 0.5, iy + 0.5, side - 1, side - 1);
        if (m === "layers") {
          const s = svdRef.current!;
          label(ctx, ix + 10, iy + side - 12, `layer ${idx + 1} · σ = ${s.S[idx].toFixed(2)}`, false);
        }
      }

      // Equaliser: one bar per singular value, log scale.
      const ex = ix + side + pad, ew = width - ex - pad;
      if (ew > 30) {
        const shown = Math.min(48, logS.current.length || 48);
        const bh = side / shown;
        const k = m === "sum" ? KS[idx] : -1;
        for (let i = 0; i < shown; i++) {
          const v = logS.current[i] ?? 0.15 + 0.1 * Math.sin(i * 0.7 + t * 3);
          const on = m === "sum" ? i < k : m === "layers" ? i === idx : false;
          ctx.fillStyle = on ? grey(1) : grey(m === "layers" && i < LAYERS ? 0.32 : 0.18);
          const len = Math.max(2, v * ew);
          ctx.fillRect(ex, iy + i * bh + bh * 0.18, len, Math.max(1, bh * 0.64));
        }
        // Readout.
        const big = Math.max(18, Math.min(44, ew * 0.3));
        font(ctx, big, 800, "expanded");
        ctx.textBaseline = "alphabetic";
        ctx.textAlign = "right";
        ctx.fillStyle = grey(1);
        const txt = m === "sum" ? `k=${String(KS[idx]).padStart(2, "0")}` : m === "layers" ? `σ${idx + 1}` : "…";
        ctx.fillText(txt, width - pad, iy + side - 4);
        font(ctx, 10, 500, "condensed");
        ctx.fillStyle = grey(0.55);
        const sub = m === "sum" ? `of ${N} layers` : m === "layers" ? "Σ is yours" : "";
        ctx.fillText(sub.toUpperCase(), width - pad, iy + side - big - 8);
        ctx.textAlign = "left";
      }
    },
    { fps: 30 },
  );

  return <canvas ref={ref} aria-label="A portrait rebuilt rank by rank from its singular value decomposition" className="block h-full w-full touch-none" />;
}

function label(ctx: CanvasRenderingContext2D, x: number, y: number, raw: string, upper = true) {
  font(ctx, 11, 500, "condensed");
  const text = upper ? raw.toUpperCase() : raw;
  const w = ctx.measureText(text).width;
  ctx.fillStyle = grey(0, 0.75);
  ctx.fillRect(x - 6, y - 13, w + 12, 19);
  ctx.fillStyle = grey(1);
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, x, y);
}

/** Map a signed layer into [0, 1] with its 3rd–97th percentiles at the ends, so a few bright pixels don't wash it out. */
function robust(d: Float64Array): Float64Array {
  const sorted = Float64Array.from(d).sort();
  const lo = sorted[Math.floor(sorted.length * 0.03)], hi = sorted[Math.floor(sorted.length * 0.97)];
  const s = 1 / (hi - lo || 1);
  return d.map((v) => Math.max(0, Math.min(1, (v - lo) * s)));
}

"use client";

import { useMemo, useRef, useState } from "react";
import { grey } from "@/kit";
import { CorePanel } from "@/kit/components/core-guard";
import { Ghost } from "@/kit/components/yours-to-write";
import { Sheet } from "@/kit/components/page-shell";
import { Switch } from "@/components/ui/switch";
import { firstMissing } from "../lib/gate";
import { useMind } from "../lib/store";
import { decode, type VaeWeights } from "../lib/vae";
import { SIDE } from "../lib/world";
import { brackets, label, paintFrame } from "./draw";
import { Readout, useLoopCanvas } from "./ui";

/*
 * Section 4: the latent space as a place. The background is an atlas of decoded frames on a grid;
 * drag the cursor and the big screen decodes wherever you stand. Decoding is plain plumbing
 * (σ of the decoder's logits), so this lights up as soon as the VAE is trained.
 */

const SPAN = 3;
const N = 9;

function atlas(vae: VaeWeights): Float32Array[] {
  const out: Float32Array[] = [];
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const z = [-SPAN + ((i + 0.5) * 2 * SPAN) / N, SPAN - ((j + 0.5) * 2 * SPAN) / N];
      out.push(decode(vae, z));
    }
  return out;
}

export function LatentWalk() {
  const blocked = firstMissing("m1-reparam", "m2-kl", "m3-elbo");
  const mind = useMind();
  const tiles = useMemo(() => (mind.vae ? atlas(mind.vae) : null), [mind.vae]);
  const cursor = useRef([0.4, -0.3]);
  const drag = useRef(false);
  const [auto, setAuto] = useState(true);
  const [z, setZ] = useState([0.4, -0.3]);
  const lastZ = useRef(0);
  const big = useRef(new Float32Array(SIDE * SIDE));

  const plane = useLoopCanvas((ctx, { width: W, height: H }, t) => {
    const vae = mind.vae;
    if (!vae || !tiles) return;
    if (auto && !drag.current) cursor.current = [2.2 * Math.sin(t * 0.31) * Math.cos(t * 0.07), 2.2 * Math.sin(t * 0.23 + 1)];
    const S = Math.min(W, H);
    const ox = (W - S) / 2, oy = (H - S) / 2;
    const X = (v: number) => ox + ((v + SPAN) / (2 * SPAN)) * S;
    const Y = (v: number) => oy + ((SPAN - v) / (2 * SPAN)) * S;
    ctx.fillStyle = grey(0);
    ctx.fillRect(0, 0, W, H);
    const ts = S / N;
    tiles.forEach((f, k) => paintFrame(ctx, f, SIDE, ox + (k % N) * ts + 1, oy + Math.floor(k / N) * ts + 1, ts - 2, { pixel: 2, gain: 0.45 }));
    // prior rings
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = grey(0.5);
    for (const k of [1, 2]) { ctx.beginPath(); ctx.arc(X(0), Y(0), (k * S) / (2 * SPAN), 0, Math.PI * 2); ctx.stroke(); }
    ctx.setLineDash([]);
    // cloud
    if (mind.cloud) {
      ctx.fillStyle = grey(1, 0.55);
      for (let i = 0; i < mind.cloud.length; i += 2) ctx.fillRect(X(mind.cloud[i]) - 0.75, Y(mind.cloud[i + 1]) - 0.75, 1.5, 1.5);
    }
    // cursor
    const [cx, cy] = cursor.current;
    const px = X(cx), py = Y(cy);
    ctx.strokeStyle = grey(1);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px, py, 10, 0, Math.PI * 2);
    ctx.moveTo(px - 16, py); ctx.lineTo(px - 6, py);
    ctx.moveTo(px + 6, py); ctx.lineTo(px + 16, py);
    ctx.moveTo(px, py - 16); ctx.lineTo(px, py - 6);
    ctx.moveTo(px, py + 6); ctx.lineTo(px, py + 16);
    ctx.stroke();
    label(ctx, "z₁ →", ox + S - 6, oy + S - 6, { size: 9, align: "right", level: 0.6 });
    label(ctx, "↑ z₂", ox + 6, oy + 14, { size: 9, level: 0.6 });
    if (t - lastZ.current > 0.15) {
      lastZ.current = t;
      setZ([cx, cy]);
    }
  });

  const screen = useLoopCanvas((ctx, { width: W, height: H }, t) => {
    const vae = mind.vae;
    ctx.fillStyle = grey(0);
    ctx.fillRect(0, 0, W, H);
    if (!vae) return;
    decode(vae, cursor.current, big.current);
    const s = Math.min(W, H) - 16;
    paintFrame(ctx, big.current, SIDE, (W - s) / 2, (H - s) / 2, s, { pixel: Math.max(2, Math.round(s / 80)), grain: 0.04, t });
    brackets(ctx, (W - s) / 2 - 4, (H - s) / 2 - 4, s + 8, s + 8, 10);
  });

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const S = Math.min(r.width, r.height);
    const ox = (r.width - S) / 2, oy = (r.height - S) / 2;
    const u = (e.clientX - r.left - ox) / S, v = (e.clientY - r.top - oy) / S;
    cursor.current = [Math.max(-SPAN, Math.min(SPAN, -SPAN + u * 2 * SPAN)), Math.max(-SPAN, Math.min(SPAN, SPAN - v * 2 * SPAN))];
  };

  if (!mind.vae) {
    if (blocked) return <CorePanel error={blocked} ghost={<Ghost label="decoded atlas" className="aspect-square w-full" />} />;
    return (
      <Ghost
        label="Train the eyes above · then walk here"
        className="aspect-[4/3] w-full rounded-2xl"
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[1.3fr_1fr]">
      <div className="overflow-hidden rounded-2xl border border-rule bg-paper">
        <canvas
          ref={plane}
          className="block aspect-square w-full touch-none"
          role="img"
          aria-label="Atlas of decoded frames across the latent plane, with a draggable cursor"
          onPointerDown={(e) => {
            drag.current = true;
            setAuto(false);
            e.currentTarget.setPointerCapture(e.pointerId);
            move(e);
          }}
          onPointerMove={(e) => drag.current && move(e)}
          onPointerUp={() => (drag.current = false)}
        />
      </div>
      <Sheet className="flex flex-col gap-4">
        <canvas ref={screen} className="block aspect-square w-full rounded-xl" role="img" aria-label="The frame decoded at the cursor" />
        <div className="grid grid-cols-2 gap-2">
          <Readout k="z₁" v={z[0].toFixed(2)} />
          <Readout k="z₂" v={z[1].toFixed(2)} />
        </div>
        <label className="flex min-h-11 items-center justify-between gap-3">
          <span className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Wander on its own</span>
          <Switch checked={auto} onCheckedChange={setAuto} />
        </label>
        <p className="text-xs text-ink-soft">
          The dashed rings are 1σ and 2σ of the prior. Step outside them and the decoder has never been asked to draw there.
        </p>
      </Sheet>
    </div>
  );
}

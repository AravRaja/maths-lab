"use client";

import { useState } from "react";
import { CoreError, CorePanel, useCore } from "@/kit/components/core-guard";
import { LineChart } from "@/kit/components/charts";
import { Sheet } from "@/kit/components/page-shell";
import { useCanvas } from "@/kit/components/use-canvas";
import { Slider } from "@/components/ui/slider";
import { grey } from "@/kit/canvas";
import { valueNoise } from "@/kit/dither";
import { clippedSurrogate } from "../core/surrogate";
import { useArena } from "../lib/store";
import { font } from "./scene";
import { Knob, num, Readout } from "./choice";

const R_MAX = 2;
const Y = 2.2;
const SAMPLES = 161;

/**
 * M4: the clipped surrogate drawn by the user's own clippedSurrogate(), for Â > 0 and Â < 0.
 * Flat (zero-gradient) stretches are found numerically and dithered. While the arena trains, the
 * last minibatch's probability ratios land on the curves as dust: watch it pile up at 1 ± ε.
 */
export function ClipLab() {
  const [eps, setEps] = useState(0.2);
  const [r, setR] = useState(1.35);
  const arena = useArena();
  const probe = useCore(() => clippedSurrogate(1, 1, eps), [eps]);

  if (probe.status === "missing")
    return (
      <CorePanel
        error={probe.missing}
        ghost={
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <LineChart ghost series={[]} height={180} />
            <LineChart ghost series={[]} height={180} />
          </div>
        }
      />
    );
  if (probe.status === "error") return <CoreError error={probe.error} />;

  const slope = (a: number) => (clippedSurrogate(r + 1e-6, a, eps) - clippedSurrogate(r - 1e-6, a, eps)) / 2e-6;
  const training = arena.ratios.length > 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Panel sign={1} eps={eps} r={r} ratios={arena.ratios} />
        <Panel sign={-1} eps={eps} r={r} ratios={arena.ratios} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Readout label="L(r), Â = +1" value={clippedSurrogate(r, 1, eps).toFixed(2)} />
        <Readout label="∂L/∂r, Â = +1" value={slope(1).toFixed(2)} />
        <Readout label="L(r), Â = −1" value={clippedSurrogate(r, -1, eps).toFixed(2)} />
        <Readout label="∂L/∂r, Â = −1" value={slope(-1).toFixed(2)} />
      </div>
      <Sheet className="flex flex-col gap-5">
        <Knob label="Ratio r = π/π_old" value={r.toFixed(2)}>
          <Slider min={0.05} max={1.95} step={0.01} value={r} aria-label="Probability ratio" onValueChange={(v) => setR(num(v))} />
        </Knob>
        <Knob label="Clip ε" value={eps.toFixed(2)}>
          <Slider min={0.02} max={0.6} step={0.01} value={eps} aria-label="Clip epsilon" onValueChange={(v) => setEps(num(v))} />
        </Knob>
        <p className="text-xs text-ink-soft">
          {training
            ? `Dust: ${arena.ratios.length / 2} samples from the arena's last update (ε = ${arena.clip}), ${arena.clipFrac !== null ? `${(arena.clipFrac * 100).toFixed(1)}% clipped` : ""}. Hollow = no gradient.`
            : "Train the agent in the arena below and its probability ratios will land on these curves."}
        </p>
      </Sheet>
    </div>
  );
}

function Panel({ sign, eps, r, ratios }: { sign: 1 | -1; eps: number; r: number; ratios: number[] }) {
  const ref = useCanvas(
    ({ ctx, width, height, t }) => {
      const pad = { l: 30, r: 10, t: 26, b: 22 };
      const sx = (x: number) => pad.l + (x / R_MAX) * (width - pad.l - pad.r);
      const sy = (y: number) => pad.t + ((Y - y) / (2 * Y)) * (height - pad.t - pad.b);
      ctx.clearRect(0, 0, width, height);

      // Flat stretches: where the user's curve has zero slope in r.
      const xs = Array.from({ length: SAMPLES }, (_, i) => 0.0001 + (i / (SAMPLES - 1)) * (R_MAX - 0.0002));
      const L = xs.map((x) => clippedSurrogate(x, sign, eps));
      for (let i = 0; i < SAMPLES - 1; i++) {
        const s = (L[i + 1] - L[i]) / (xs[i + 1] - xs[i]);
        if (Math.abs(s) < 1e-9) {
          const x0 = sx(xs[i]), x1 = sx(xs[i + 1]);
          for (let y = pad.t; y < height - pad.b; y += 3)
            for (let x = Math.floor(x0); x < x1; x += 3) if (((x + y) / 3) % 2 === 0) {
              ctx.fillStyle = grey(0.2);
              ctx.fillRect(x, y, 1, 1);
            }
        }
      }

      // Axes and the trust region.
      ctx.strokeStyle = grey(0.18);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.l, sy(0));
      ctx.lineTo(width - pad.r, sy(0));
      ctx.stroke();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = grey(0.45);
      for (const x of [1 - eps, 1 + eps]) {
        ctx.beginPath();
        ctx.moveTo(sx(x), pad.t);
        ctx.lineTo(sx(x), height - pad.b);
        ctx.stroke();
      }
      // Unclipped r·Â.
      ctx.strokeStyle = grey(0.4);
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(sx(0), sy(0));
      ctx.lineTo(sx(R_MAX), sy(R_MAX * sign));
      ctx.stroke();
      ctx.setLineDash([]);

      // The user's L^CLIP.
      ctx.strokeStyle = grey(1);
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      ctx.beginPath();
      xs.forEach((x, i) => (i ? ctx.lineTo(sx(x), sy(L[i])) : ctx.moveTo(sx(x), sy(L[i]))));
      ctx.stroke();

      // Dust from the last PPO update.
      for (let k = 0; k + 1 < ratios.length; k += 2) {
        const rr = ratios[k], a = ratios[k + 1];
        if (Math.sign(a) !== sign || rr <= 0 || rr >= R_MAX) continue;
        const y = clippedSurrogate(rr, sign, eps);
        const jitter = (valueNoise(k * 0.37, t * 0.8, 9) - 0.5) * 10;
        const flat = Math.abs(clippedSurrogate(rr + 1e-6, sign, eps) - clippedSurrogate(rr - 1e-6, sign, eps)) < 1e-12;
        ctx.beginPath();
        ctx.arc(sx(rr), sy(y) + jitter, 2, 0, Math.PI * 2);
        if (flat) {
          ctx.strokeStyle = grey(0.85);
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          ctx.fillStyle = grey(0.85);
          ctx.fill();
        }
      }

      // The handle at r, with its tangent.
      const y = clippedSurrogate(r, sign, eps);
      const s = (clippedSurrogate(r + 1e-6, sign, eps) - clippedSurrogate(r - 1e-6, sign, eps)) / 2e-6;
      ctx.strokeStyle = grey(1, 0.7);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx(r - 0.25), sy(y - 0.25 * s));
      ctx.lineTo(sx(r + 0.25), sy(y + 0.25 * s));
      ctx.stroke();
      ctx.fillStyle = grey(0);
      ctx.strokeStyle = grey(1);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx(r), sy(y), 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Labels.
      ctx.fillStyle = grey(1);
      ctx.font = font(600, 12);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(sign > 0 ? "Â > 0  · make this action likelier" : "Â < 0  · make it rarer", pad.l, 6);
      ctx.fillStyle = grey(0.55);
      ctx.font = font(500, 10);
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "center";
      ctx.fillText("1−ε", sx(1 - eps), height - 6);
      ctx.fillText("1+ε", sx(1 + eps), height - 6);
      ctx.fillText("0", sx(0), height - 6);
      ctx.fillText("2", sx(R_MAX), height - 6);
      ctx.textAlign = "right";
      ctx.fillText("r", width - pad.r, sy(0) - 4);
      ctx.fillText(`${Y.toFixed(0)}`, pad.l - 6, sy(2) + 4);
      ctx.fillText(`−${Y.toFixed(0)}`, pad.l - 6, sy(-2) + 4);
    },
    { fps: 30 },
    [sign, eps, r, ratios],
  );
  return (
    <canvas
      ref={ref}
      aria-label={`Clipped surrogate against the ratio r for ${sign > 0 ? "positive" : "negative"} advantage`}
      className="block aspect-[5/4] w-full rounded-2xl border border-rule bg-sheet"
    />
  );
}

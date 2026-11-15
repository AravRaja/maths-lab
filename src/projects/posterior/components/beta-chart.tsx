"use client";

import { useCanvas } from "@/kit/components/use-canvas";
import { grey } from "@/kit/canvas";
import { BAYER8 } from "@/kit/dither";
import type { BetaParams } from "../core/types";
import { betaPdf } from "../lib/special";
import { cn } from "@/lib/utils";

const N = 240;

/**
 * Posterior over θ with a Bayer-dithered fill, the prior dotted behind it, an optional ±2σ band,
 * a mean tick, a trail of earlier posteriors and the truth (once revealed).
 */
export function BetaChart({
  prior,
  post,
  mean,
  sd,
  truth,
  trail = [],
  ghost,
  className,
}: {
  prior: BetaParams;
  post: BetaParams | null;
  mean?: number | null;
  sd?: number | null;
  truth?: number | null;
  trail?: BetaParams[];
  ghost?: boolean;
  className?: string;
}) {
  const ref = useCanvas(
    ({ ctx, width, height }) => {
      ctx.clearRect(0, 0, width, height);
      const padL = 12, padR = 12, padT = 18, padB = 26;
      const iw = width - padL - padR;
      const ih = height - padT - padB;
      const curve = (p: BetaParams) => Array.from({ length: N + 1 }, (_, i) => betaPdf(i / N, p.a, p.b));
      const pc = curve(prior);
      const qc = post ? curve(post) : null;
      const top = Math.max(...pc.slice(2, -2), ...(qc ? qc.slice(2, -2) : []), 1.2) * 1.08;
      const sx = (th: number) => padL + th * iw;
      const sy = (v: number) => padT + ih - (Math.min(v, top) / top) * ih;

      // ±2σ band.
      if (mean != null && sd != null && Number.isFinite(sd)) {
        const a = Math.max(0, mean - 2 * sd), b = Math.min(1, mean + 2 * sd);
        ctx.fillStyle = grey(1, 0.05);
        ctx.fillRect(sx(a), padT, sx(b) - sx(a), ih);
        ctx.strokeStyle = grey(0.3);
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(sx(a), padT); ctx.lineTo(sx(a), padT + ih);
        ctx.moveTo(sx(b), padT); ctx.lineTo(sx(b), padT + ih);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Dithered fill under the posterior: brighter towards the peak.
      if (qc && !ghost) {
        const px = 2;
        const w = Math.floor(iw / px), h = Math.floor(ih / px);
        const img = ctx.createImageData(w, h);
        for (let x = 0; x < w; x++) {
          const v = qc[Math.round((x / (w - 1)) * N)];
          const yTop = h - (Math.min(v, top) / top) * h;
          for (let y = Math.max(0, Math.floor(yTop)); y < h; y++) {
            const frac = 1 - (y - yTop) / Math.max(1, h - yTop);
            const level = 0.12 + 0.55 * frac * (v / top);
            const on = level > BAYER8[(y & 7) * 8 + (x & 7)];
            const p = (y * w + x) * 4;
            img.data[p] = img.data[p + 1] = img.data[p + 2] = on ? 235 : 0;
            img.data[p + 3] = on ? 255 : 0;
          }
        }
        const off = new OffscreenCanvas(w, h);
        off.getContext("2d")!.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = 0.5;
        ctx.drawImage(off, padL, padT, w * px, h * px);
        ctx.globalAlpha = 1;
      }

      const path = (c: number[]) => {
        ctx.beginPath();
        c.forEach((v, i) => (i ? ctx.lineTo(sx(i / N), sy(v)) : ctx.moveTo(sx(0), sy(v))));
      };

      // Trail of earlier posteriors.
      trail.forEach((p, i) => {
        path(curve(p));
        ctx.strokeStyle = grey(0.15 + (0.25 * (i + 1)) / trail.length);
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Prior, dotted.
      path(pc);
      ctx.strokeStyle = grey(0.55);
      ctx.setLineDash([1.5, 4]);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);

      if (qc) {
        path(qc);
        ctx.strokeStyle = grey(ghost ? 0.5 : 1);
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (mean != null) {
        ctx.strokeStyle = grey(1);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx(mean), padT + ih + 2);
        ctx.lineTo(sx(mean), padT + ih + 9);
        ctx.stroke();
      }

      if (truth != null) {
        ctx.strokeStyle = grey(1);
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(sx(truth), padT - 6);
        ctx.lineTo(sx(truth), padT + ih);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = grey(1);
        ctx.font = "600 10px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.textAlign = truth > 0.8 ? "right" : "left";
        ctx.fillText(` true θ ${truth.toFixed(2)} `, sx(truth), padT - 6);
      }

      // Axis.
      ctx.strokeStyle = grey(0.15);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, padT + ih + 0.5);
      ctx.lineTo(padL + iw, padT + ih + 0.5);
      ctx.stroke();
      ctx.fillStyle = grey(0.55);
      ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textBaseline = "alphabetic";
      for (const v of [0, 0.25, 0.5, 0.75, 1]) {
        ctx.textAlign = v === 0 ? "left" : v === 1 ? "right" : "center";
        ctx.fillText(String(v), sx(v), height - 6);
      }
      ctx.textAlign = "left";
    },
    { animate: false },
    [prior.a, prior.b, post?.a, post?.b, mean, sd, truth, trail, ghost],
  );
  return <canvas ref={ref} aria-label="Posterior density over the coin's bias" className={cn("block h-64 w-full sm:h-72", className)} />;
}

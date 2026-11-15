"use client";

import { useMemo } from "react";
import { Sheet } from "@/kit/components/page-shell";
import { LineChart } from "@/kit/components/charts";
import { CoreError, CorePanel, runCore } from "@/kit/components/core-guard";
import { useCanvas } from "@/kit/components/use-canvas";
import { grey } from "@/kit/canvas";
import { Skeleton } from "@/components/ui/skeleton";
import { rankK } from "../core/lowrank";
import { energyCaptured, frobeniusError, tailEnergy } from "../core/error";
import type { Matrix, SVD } from "../core/types";
import { font } from "./canvas-font";
import { Kicker, Readout } from "./ui-bits";

/** Log-scale bar chart of σ_i. Bars up to k are ink; tap or drag to set k. */
function SpectrumBars({ S, k, setK }: { S: Float64Array; k: number; setK: (k: number) => void }) {
  const ref = useCanvas(
    ({ ctx, width, height, pointer }) => {
      const r = S.length;
      const padL = 34, padB = 22, padT = 8;
      const w = width - padL - 4, h = height - padB - padT;
      if (pointer?.down && pointer.x > padL) {
        const kk = Math.max(1, Math.min(r, Math.ceil(((pointer.x - padL) / w) * r)));
        if (kk !== k) setK(kk);
      }
      ctx.clearRect(0, 0, width, height);
      const pos = Array.from(S).filter((s) => s > 0);
      const top = Math.ceil(Math.log10(Math.max(...pos, 1e-9)));
      const bottom = Math.max(top - 6, Math.floor(Math.log10(Math.min(...pos, 1))));
      const y = (s: number) => padT + h * (1 - (Math.log10(Math.max(s, 10 ** bottom)) - bottom) / (top - bottom || 1));
      font(ctx, 10, 500, "condensed");
      ctx.fillStyle = grey(0.55);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let e = bottom; e <= top; e++) {
        const yy = y(10 ** e);
        ctx.fillStyle = grey(0.15);
        ctx.fillRect(padL, Math.round(yy), w, 1);
        ctx.fillStyle = grey(0.55);
        ctx.fillText(`1e${e}`, padL - 6, yy);
      }
      const bw = w / r;
      for (let i = 0; i < r; i++) {
        const yy = y(S[i]);
        ctx.fillStyle = i < k ? grey(1) : grey(0.3);
        ctx.fillRect(padL + i * bw + (bw > 3 ? 0.5 : 0), yy, Math.max(1, bw - (bw > 3 ? 1 : 0)), padT + h - yy);
      }
      // k cursor.
      const cx = padL + k * bw;
      ctx.fillStyle = grey(1);
      ctx.fillRect(Math.round(cx) - 1, padT, 2, h);
      ctx.textAlign = cx > width - 60 ? "right" : "left";
      ctx.textBaseline = "alphabetic";
      font(ctx, 12, 700, "expanded");
      ctx.fillText(`k = ${k}`, cx + (cx > width - 60 ? -6 : 6), padT + 14);
      font(ctx, 10, 500, "condensed");
      ctx.fillStyle = grey(0.55);
      ctx.textAlign = "left";
      ctx.fillText("σ₁", padL, height - 6);
      ctx.textAlign = "right";
      ctx.fillText(`σ${r}`, padL + w, height - 6);
    },
    { fps: 30 },
    [S, k],
  );
  return <canvas ref={ref} aria-label="singular values, log scale" className="block h-56 w-full cursor-crosshair touch-none sm:h-64" />;
}

const SAMPLE = 32;

export function SpectrumView({ A, svd, k, setK }: { A: Matrix; svd: SVD | null; k: number; setK: (k: number) => void }) {
  const energy = useMemo(() => {
    if (!svd) return null;
    return runCore(() => {
      const S = svd.S;
      const at = (target: number) => {
        for (let j = 0; j <= S.length; j++) if (energyCaptured(S, j) >= target) return j;
        return S.length;
      };
      return { now: energyCaptured(S, k), p90: at(0.9), p99: at(0.99), p999: at(0.999) };
    });
  }, [svd, k]);

  const curves = useMemo(() => {
    if (!svd) return null;
    return runCore(() => {
      const S = svd.S, r = S.length;
      const total = tailEnergy(S, 0) || 1;
      // Same k's for both curves, so any gap you see is real and not interpolation.
      const ks = Array.from(new Set(Array.from({ length: SAMPLE }, (_, i) => Math.round((i / (SAMPLE - 1)) * (r - 1)))));
      const predicted: [number, number][] = ks.map((j) => [j, Math.max(1e-6, tailEnergy(S, j) / total)]);
      const measured: [number, number][] = ks.map((j) => [j, Math.max(1e-6, frobeniusError(A, rankK(svd, j)) / total)]);
      return { predicted, measured, gap: Math.max(...measured.map(([j, e]) => Math.abs(e - tailEnergy(S, j) / total))) };
    });
  }, [svd, A]);

  if (!svd) return <Skeleton className="h-80 w-full rounded-2xl" />;

  const ghostChart = (
    <LineChart
      ghost
      series={[{ data: Array.from({ length: 30 }, (_, i) => Math.exp(-i / 6)) }]}
      height={220}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <Sheet className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <Kicker>Singular values · log scale</Kicker>
          <span className="font-mono text-xs tabular-nums text-ink-soft">
            σ₁/σₖ = {(svd.S[0] / Math.max(svd.S[k - 1], 1e-12)).toExponential(1)}
          </span>
        </div>
        <SpectrumBars S={svd.S} k={k} setK={setK} />
      </Sheet>

      {energy?.status === "ok" ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <Readout label="Energy kept" value={`${(100 * energy.value.now).toFixed(energy.value.now > 0.999 ? 2 : 1)}%`} sub={`at k = ${k}`} />
          <Readout label="90% at" value={`k=${energy.value.p90}`} />
          <Readout label="99% at" value={`k=${energy.value.p99}`} />
          <Readout label="99.9% at" value={`k=${energy.value.p999}`} />
        </div>
      ) : energy?.status === "missing" ? (
        <CorePanel error={energy.missing} />
      ) : energy?.status === "error" ? (
        <CoreError error={energy.error} />
      ) : null}

      <Sheet className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Kicker>Relative error ‖A − Aₖ‖ / ‖A‖ against k</Kicker>
          {curves?.status === "ok" && (
            <span className="font-mono text-xs tabular-nums text-ink-soft">max gap {curves.value.gap.toExponential(1)}</span>
          )}
        </div>
        {curves?.status === "ok" ? (
          <>
            <LineChart
              logY
              height={240}
              xLabel="k"
              series={[
                { label: "predicted from σ (tailEnergy)", data: curves.value.predicted, stroke: "solid" },
                { label: "measured (frobeniusError of rankK)", data: curves.value.measured, stroke: "dotted" },
              ]}
            />
            <p className="text-sm text-ink-soft">
              If the dotted line sits exactly on the solid one, you have just checked Eckart–Young on this picture.
            </p>
          </>
        ) : curves?.status === "missing" ? (
          <CorePanel error={curves.missing} ghost={ghostChart} />
        ) : curves?.status === "error" ? (
          <CoreError error={curves.error} />
        ) : null}
      </Sheet>
    </div>
  );
}

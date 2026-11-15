"use client";

import { useMemo, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { CoreError, CorePanel, runCore } from "@/kit/components/core-guard";
import { useCanvas } from "@/kit/components/use-canvas";
import { grey } from "@/kit/canvas";
import { rankK, storageCost } from "../core/lowrank";
import { frobeniusError } from "../core/error";
import type { Matrix, SVD } from "../core/types";
import { layer } from "../lib/svd";
import { drawMatrix, fit } from "./raster";
import { font } from "./canvas-font";
import { Field, Pills, Readout, sliderValue } from "./ui-bits";

type View = "dither" | "smooth" | "error";

/** The wipe viewer: original on the left of the divider, rank-k on the right. Drag to move it. */
function WipeCanvas({ A, Ak, k, view }: { A: Matrix; Ak: Matrix; k: number; view: View }) {
  const split = useRef(0.5);
  const residual = useMemo(() => {
    const d = new Float64Array(A.data.length);
    for (let i = 0; i < d.length; i++) d[i] = Math.min(1, Math.abs(A.data[i] - Ak.data[i]) * 4);
    return d;
  }, [A, Ak]);

  const ref = useCanvas(
    ({ ctx, width, height, pointer }) => {
      if (pointer?.down) split.current = Math.max(0, Math.min(1, pointer.x / width));
      ctx.fillStyle = grey(0);
      ctx.fillRect(0, 0, width, height);
      const box = fit(A.rows, A.cols, width, height);
      const opts = { dither: view === "dither", cell: 2, tones: [0, 0.3, 0.62, 1] };
      const cut = box.x + box.w * split.current;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, cut, height);
      ctx.clip();
      drawMatrix(ctx, A.data, A.rows, A.cols, box.x, box.y, box.w, box.h, opts, "wipeA");
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.rect(cut, 0, width - cut, height);
      ctx.clip();
      if (view === "error") drawMatrix(ctx, residual, A.rows, A.cols, box.x, box.y, box.w, box.h, { dither: true, cell: 2, tones: [0, 0.35, 1] }, "wipeE");
      else drawMatrix(ctx, Ak.data, A.rows, A.cols, box.x, box.y, box.w, box.h, opts, "wipeK");
      ctx.restore();
      // Divider with a grab handle.
      ctx.fillStyle = grey(1);
      ctx.fillRect(cut - 1, box.y, 2, box.h);
      ctx.beginPath();
      ctx.arc(cut, box.y + box.h / 2, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = grey(0);
      ctx.beginPath();
      ctx.moveTo(cut - 8, box.y + box.h / 2);
      ctx.lineTo(cut - 3, box.y + box.h / 2 - 5);
      ctx.lineTo(cut - 3, box.y + box.h / 2 + 5);
      ctx.moveTo(cut + 8, box.y + box.h / 2);
      ctx.lineTo(cut + 3, box.y + box.h / 2 - 5);
      ctx.lineTo(cut + 3, box.y + box.h / 2 + 5);
      ctx.fill();
      font(ctx, 11, 500, "condensed");
      chip(ctx, box.x + 8, box.y + 8, "ORIGINAL", "left");
      chip(ctx, box.x + box.w - 8, box.y + 8, view === "error" ? `|A − A${sub(k)}| × 4` : `RANK ${k}`, "right");
    },
    { fps: 30 },
    [A, Ak, view, residual, k],
  );

  return <canvas ref={ref} aria-label={`original against rank ${k}`} className="block aspect-square w-full cursor-ew-resize touch-none rounded-xl border border-rule" />;
}

const SUBS = "₀₁₂₃₄₅₆₇₈₉";
const sub = (n: number) => String(n).split("").map((d) => SUBS[+d]).join("");

function chip(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, align: "left" | "right") {
  const w = ctx.measureText(text).width + 12;
  const x0 = align === "left" ? x : x - w;
  ctx.fillStyle = grey(0, 0.8);
  ctx.fillRect(x0, y, w, 20);
  ctx.fillStyle = grey(1);
  ctx.textBaseline = "middle";
  ctx.fillText(text, x0 + 6, y + 10.5);
}

/** The first few rank-one layers, then "= A_k". Scaffolding: it only displays the factors. */
function LayerStrip({ svd, k, Ak }: { svd: SVD; k: number; Ak: Matrix | null }) {
  const n = 5;
  const tiles = useMemo(() => Array.from({ length: Math.min(n, svd.S.length) }, (_, i) => layer(svd, i)), [svd]);
  const ref = useCanvas(
    ({ ctx, width, height }) => {
      ctx.clearRect(0, 0, width, height);
      const slots = tiles.length + 1;
      const gap = 14;
      const s = Math.min(height - 18, (width - gap * (slots - 1)) / slots);
      const m = tiles[0].rows, c = tiles[0].cols;
      font(ctx, 10, 500, "condensed");
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      tiles.forEach((L, i) => {
        const x = i * (s + gap);
        drawMatrix(ctx, L.data, m, c, x, 0, s, s, { range: "symmetric", dither: true, cell: 2, tones: [0, 0.25, 0.55, 1] }, `layer${i}`);
        ctx.globalAlpha = i < k ? 1 : 0.3;
        ctx.strokeStyle = grey(i < k ? 1 : 0.3);
        ctx.strokeRect(x + 0.5, 0.5, s - 1, s - 1);
        ctx.globalAlpha = 1;
        ctx.fillStyle = grey(i < k ? 1 : 0.4);
        ctx.fillText(`σ${sub(i + 1)} ${svd.S[i].toFixed(1)}`, x + s / 2, s + 14);
        ctx.fillStyle = grey(0.5);
        ctx.fillText(i === tiles.length - 1 ? "…" : "+", x + s + gap / 2, s / 2 + 4);
      });
      const x = tiles.length * (s + gap);
      if (Ak) drawMatrix(ctx, Ak.data, Ak.rows, Ak.cols, x, 0, s, s, { dither: true, cell: 2 }, "layerSum");
      else {
        ctx.fillStyle = grey(0.06);
        ctx.fillRect(x, 0, s, s);
      }
      ctx.strokeStyle = grey(0.5);
      ctx.setLineDash(Ak ? [] : [3, 3]);
      ctx.strokeRect(x + 0.5, 0.5, s - 1, s - 1);
      ctx.setLineDash([]);
      ctx.fillStyle = grey(1);
      ctx.fillText(`= A${sub(k)}`, x + s / 2, s + 14);
      ctx.textAlign = "left";
    },
    { animate: false },
    [tiles, k, Ak],
  );
  return <canvas ref={ref} aria-label="the first rank-one layers" className="block aspect-[5/1] w-full" />;
}

export function Compressor({ A, svd, k, setK }: { A: Matrix; svd: SVD | null; k: number; setK: (k: number) => void }) {
  const [view, setView] = useState<View>("dither");
  const r = svd?.S.length ?? Math.min(A.rows, A.cols);
  const rec = useMemo(() => (svd ? runCore(() => rankK(svd, k)) : null), [svd, k]);
  const cost = useMemo(() => runCore(() => storageCost(A.rows, A.cols, k)), [A, k]);
  const err = useMemo(() => {
    if (rec?.status !== "ok") return null;
    const zero: Matrix = { rows: A.rows, cols: A.cols, data: new Float64Array(A.data.length) };
    return runCore(() => frobeniusError(A, rec.value) / (frobeniusError(A, zero) || 1));
  }, [A, rec]);
  const picks = useMemo(() => [1, 2, 5, 10, 20, 50, r].filter((x, i, a) => x <= r && a.indexOf(x) === i), [r]);

  const ghostView = (
    <div className="aspect-square w-full overflow-hidden rounded-xl">
      <StaticImage A={A} />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {!svd ? (
        <Skeleton className="aspect-square w-full rounded-xl" />
      ) : rec?.status === "missing" ? (
        <CorePanel error={rec.missing} ghost={ghostView} />
      ) : rec?.status === "error" ? (
        <CoreError error={rec.error} />
      ) : rec?.status === "ok" ? (
        <WipeCanvas A={A} Ak={rec.value} k={k} view={view} />
      ) : null}

      <Field label="Rank k" value={`${k} / ${r}`}>
        <Slider min={1} max={r} step={1} value={[k]} onValueChange={(v) => setK(sliderValue(v))} aria-label="rank k" />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Pills label="quick rank" value={k} options={picks} onChange={setK} render={(o) => (o === r ? "all" : o)} />
        <Pills label="view" value={view} options={["dither", "smooth", "error"] as View[]} onChange={setView} />
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Readout label="Layers" value={k} sub={`of ${r}`} />
        <Readout
          label="Stored"
          value={cost.status === "ok" ? `${((100 * cost.value) / (A.rows * A.cols)).toFixed(0)}%` : "—"}
          sub={cost.status === "ok" ? `${cost.value.toLocaleString()} numbers` : "storageCost()"}
        />
        <Readout
          label="Error"
          value={err?.status === "ok" ? `${(100 * err.value).toFixed(1)}%` : "—"}
          sub={err?.status === "ok" ? "‖A − Aₖ‖ / ‖A‖" : "frobeniusError()"}
        />
      </div>
      {cost.status === "missing" && <CorePanel error={cost.missing} />}

      {svd && (
        <div className="flex flex-col gap-2 border-t border-rule pt-4">
          <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">The layers, strongest first</p>
          <LayerStrip svd={svd} k={k} Ak={rec?.status === "ok" ? rec.value : null} />
        </div>
      )}
    </div>
  );
}

/** Plain dithered image, for ghosts. */
export function StaticImage({ A, className }: { A: Matrix; className?: string }) {
  const ref = useCanvas(
    ({ ctx, width, height }) => {
      ctx.clearRect(0, 0, width, height);
      const b = fit(A.rows, A.cols, width, height);
      drawMatrix(ctx, A.data, A.rows, A.cols, b.x, b.y, b.w, b.h, { dither: true, cell: 3, tones: [0, 0.4, 1] }, "static");
    },
    { animate: false },
    [A],
  );
  return <canvas ref={ref} aria-hidden className={className ?? "block h-full w-full"} />;
}

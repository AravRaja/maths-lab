"use client";

import { useMemo, useRef, useState } from "react";
import { Section, Sheet } from "@/kit/components/page-shell";
import { CoreError, CorePanel, runCore, type CoreResult } from "@/kit/components/core-guard";
import { useCanvas } from "@/kit/components/use-canvas";
import { grey } from "@/kit/canvas";
import { ditherField } from "@/kit/dither";
import { cholesky2, condition, marginal } from "../core/gaussian2d";
import type { Gauss2, Normal } from "../core/types";
import { gauss2Pdf, normalPdf } from "../lib/special";
import { mulberry32, normalSampler } from "../lib/rng";
import { Pills, Readout, SliderField, fmt } from "./controls";

const R = 4; // world is [-R, R]²
const N_SAMPLES = 1400;

export function GaussianSlice() {
  const [mean, setMean] = useState<[number, number]>([0.3, -0.2]);
  const [sx, setSx] = useState(1.3);
  const [sy, setSy] = useState(0.9);
  const [rho, setRho] = useState(0.75);
  const [axis, setAxis] = useState<0 | 1>(0);
  const [value, setValue] = useState(1.4);

  const g: Gauss2 = useMemo(() => ({ mean, cov: [[sx * sx, rho * sx * sy], [rho * sx * sy, sy * sy]] }), [mean, sx, sy, rho]);
  const z = useMemo(() => {
    const s = normalSampler(mulberry32(42));
    return Float32Array.from({ length: N_SAMPLES * 2 }, () => s());
  }, []);

  const chol = useMemo(() => runCore(() => cholesky2(g.cov)), [g]);
  const marg = useMemo(() => runCore(() => [marginal(g, 0), marginal(g, 1)] as [Normal, Normal]), [g]);
  const cond = useMemo(() => runCore(() => condition(g, axis, value)), [g, axis, value]);
  // Locus of conditional means: two points of a line, through the same core.
  const locus = useMemo(() => runCore(() => [condition(g, axis, -R), condition(g, axis, R)]), [g, axis]);

  const firstMissing = [cond, marg, chol].find((r): r is Extract<CoreResult<unknown>, { status: "missing" }> => r.status === "missing");
  const firstError = [cond, marg, chol, locus].find((r): r is Extract<CoreResult<unknown>, { status: "error" }> => r.status === "error");

  const other = axis === 0 ? "y" : "x";
  const obs = axis === 0 ? "x" : "y";

  return (
    <Section id="gaussian" index={2} kicker="Conditioning · marginals" title="Observe one, learn the other">
      <p className="mb-5 text-ink-soft">
        A 2D Gaussian as a dithered cloud. Drag the ring to move its mean, drag anywhere else to move the slice. Observing {obs}{" "}
        cuts the cloud along the line; what is left is a 1D Gaussian over {other}. The shadows on the edges are the marginals.
      </p>
      <Sheet className="flex flex-col gap-4">
        <GaussCanvas
          g={g}
          z={z}
          axis={axis}
          value={value}
          chol={chol.status === "ok" ? chol.value : null}
          marg={marg.status === "ok" ? marg.value : null}
          cond={cond.status === "ok" ? cond.value : null}
          locus={locus.status === "ok" ? locus.value : null}
          onMean={setMean}
          onValue={setValue}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Pills label="Observe" value={axis} options={[0, 1] as const} onChange={setAxis} render={(a) => (a === 0 ? "Observe x" : "Observe y")} />
          <span className="font-mono text-xs text-ink-soft tabular-nums">
            {obs} = {value.toFixed(2)}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <SliderField label="σx" value={sx} min={0.3} max={2} step={0.01} onChange={setSx} />
          <SliderField label="σy" value={sy} min={0.3} max={2} step={0.01} onChange={setSy} />
          <SliderField label="ρ" value={rho} min={-0.95} max={0.95} step={0.01} onChange={setRho} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Readout label={`E[${other} | ${obs}]`} value={cond.status === "ok" ? fmt(cond.value.mean, 2) : "–"} />
          <Readout label={`Var[${other} | ${obs}]`} value={cond.status === "ok" ? fmt(cond.value.variance, 3) : "–"} />
          <Readout label={`Var[${other}]`} value={marg.status === "ok" ? fmt(marg.value[1 - axis].variance, 3) : "–"} />
          <Readout
            label="Doubt removed"
            value={cond.status === "ok" && marg.status === "ok" ? `${Math.round(100 * (1 - cond.value.variance / marg.value[1 - axis].variance))}%` : "–"}
          />
        </div>
        {firstError ? <CoreError error={firstError.error} /> : firstMissing ? <CorePanel error={firstMissing.missing} /> : null}
      </Sheet>
    </Section>
  );
}

function GaussCanvas({
  g,
  z,
  axis,
  value,
  chol,
  marg,
  cond,
  locus,
  onMean,
  onValue,
}: {
  g: Gauss2;
  z: Float32Array;
  axis: 0 | 1;
  value: number;
  chol: Gauss2["cov"] | null;
  marg: [Normal, Normal] | null;
  cond: Normal | null;
  locus: Normal[] | null;
  onMean: (m: [number, number]) => void;
  onValue: (v: number) => void;
}) {
  const drag = useRef<"mean" | "slice" | null>(null);
  const buf = useRef<{ w: number; h: number; f: Float32Array; img: ImageData; off: OffscreenCanvas } | null>(null);

  const ref = useCanvas(
    ({ ctx, width, height }) => {
      const S = Math.min(width, height);
      const toX = (x: number) => ((x + R) / (2 * R)) * width;
      const toY = (y: number) => height - ((y + R) / (2 * R)) * height;
      const [[a, c], [, d]] = g.cov;
      const [mx, my] = g.mean;

      // Dithered density field.
      const px = 3;
      const w = Math.max(8, Math.floor(width / px)), h = Math.max(8, Math.floor(height / px));
      if (!buf.current || buf.current.w !== w || buf.current.h !== h)
        buf.current = { w, h, f: new Float32Array(w * h), img: new ImageData(w, h), off: new OffscreenCanvas(w, h) };
      const b = buf.current;
      const peak = gauss2Pdf(mx, my, mx, my, a, c, d);
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) {
          const x = -R + ((i + 0.5) / w) * 2 * R;
          const y = R - ((j + 0.5) / h) * 2 * R;
          b.f[j * w + i] = Math.pow(gauss2Pdf(x, y, mx, my, a, c, d) / peak, 0.6);
        }
      ditherField(b.f, w, h, b.img.data, [0, 0.16, 0.32, 0.5]);
      b.off.getContext("2d")!.putImageData(b.img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(b.off, 0, 0, w * px, h * px);

      // Grid.
      ctx.strokeStyle = grey(1, 0.06);
      ctx.lineWidth = 1;
      for (let k = -R + 1; k < R; k++) {
        ctx.beginPath();
        ctx.moveTo(toX(k), 0); ctx.lineTo(toX(k), height);
        ctx.moveTo(0, toY(k)); ctx.lineTo(width, toY(k));
        ctx.stroke();
      }

      // Samples x = μ + L z (the user's Cholesky).
      if (chol) {
        ctx.fillStyle = grey(1, 0.8);
        for (let i = 0; i < z.length; i += 2) {
          const x = mx + chol[0][0] * z[i] + chol[0][1] * z[i + 1];
          const y = my + chol[1][0] * z[i] + chol[1][1] * z[i + 1];
          ctx.fillRect(toX(x) - 0.75, toY(y) - 0.75, 1.5, 1.5);
        }
      }

      const mono = "11px ui-monospace, SFMono-Regular, Menlo, monospace";

      // Marginals as shadows along the bottom (x) and left (y) edges.
      if (marg) {
        const amp = S * 0.16;
        const pk0 = normalPdf(marg[0].mean, marg[0].mean, marg[0].variance);
        const pk1 = normalPdf(marg[1].mean, marg[1].mean, marg[1].variance);
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = grey(0.7);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i <= 160; i++) {
          const x = -R + (2 * R * i) / 160;
          const v = (normalPdf(x, marg[0].mean, marg[0].variance) / pk0) * amp;
          if (i) ctx.lineTo(toX(x), height - v); else ctx.moveTo(toX(x), height - v);
        }
        ctx.stroke();
        ctx.beginPath();
        for (let i = 0; i <= 160; i++) {
          const y = -R + (2 * R * i) / 160;
          const v = (normalPdf(y, marg[1].mean, marg[1].variance) / pk1) * amp;
          if (i) ctx.lineTo(v, toY(y)); else ctx.moveTo(v, toY(y));
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Regression line: where the conditional mean goes as the observation slides.
      if (locus) {
        ctx.strokeStyle = grey(1, 0.45);
        ctx.setLineDash([1.5, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (axis === 0) { ctx.moveTo(toX(-R), toY(locus[0].mean)); ctx.lineTo(toX(R), toY(locus[1].mean)); }
        else { ctx.moveTo(toX(locus[0].mean), toY(-R)); ctx.lineTo(toX(locus[1].mean), toY(R)); }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // The slice.
      ctx.strokeStyle = grey(1);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (axis === 0) { ctx.moveTo(toX(value), 0); ctx.lineTo(toX(value), height); }
      else { ctx.moveTo(0, toY(value)); ctx.lineTo(width, toY(value)); }
      ctx.stroke();

      // Conditional density along the slice, bulging off the line.
      if (cond) {
        const amp = S * 0.24;
        const pk = normalPdf(cond.mean, cond.mean, cond.variance);
        ctx.beginPath();
        for (let i = 0; i <= 200; i++) {
          const u = -R + (2 * R * i) / 200;
          const v = (normalPdf(u, cond.mean, cond.variance) / pk) * amp;
          const X = axis === 0 ? toX(value) + v : toX(u);
          const Y = axis === 0 ? toY(u) : toY(value) - v;
          if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
        }
        ctx.fillStyle = grey(1, 0.12);
        ctx.fill();
        ctx.strokeStyle = grey(1);
        ctx.lineWidth = 2;
        ctx.stroke();
        // Mean dot and ±2σ bar on the slice.
        const sd = Math.sqrt(cond.variance);
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.beginPath();
        if (axis === 0) { ctx.moveTo(toX(value), toY(cond.mean - 2 * sd)); ctx.lineTo(toX(value), toY(cond.mean + 2 * sd)); }
        else { ctx.moveTo(toX(cond.mean - 2 * sd), toY(value)); ctx.lineTo(toX(cond.mean + 2 * sd), toY(value)); }
        ctx.stroke();
        ctx.lineCap = "butt";
        const cx = axis === 0 ? toX(value) : toX(cond.mean);
        const cy = axis === 0 ? toY(cond.mean) : toY(value);
        ctx.fillStyle = grey(0);
        ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = grey(1); ctx.lineWidth = 2; ctx.stroke();
      }

      // Mean handle.
      ctx.strokeStyle = grey(1);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(toX(mx), toY(my), 11, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(toX(mx), toY(my), 2.5, 0, Math.PI * 2); ctx.fillStyle = grey(1); ctx.fill();

      ctx.font = mono;
      ctx.fillStyle = grey(0.6);
      ctx.textBaseline = "top";
      if (!chol) ctx.fillText("samples need cholesky2()", 8, 8);
      if (!cond) ctx.fillText("slice needs condition()", 8, 24);
      if (!marg) ctx.fillText("shadows need marginal()", 8, 40);
      ctx.textBaseline = "alphabetic";
    },
    { animate: false },
    [g, z, axis, value, chol, marg, cond, locus],
  );

  const toWorld = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2 * R - R, R - ((e.clientY - r.top) / r.height) * 2 * R] as [number, number];
  };
  const clamp = (v: number) => Math.max(-R + 0.2, Math.min(R - 0.2, v));

  return (
    <canvas
      ref={ref}
      aria-label="Two-dimensional Gaussian with a draggable mean and observation slice"
      className="block aspect-square w-full touch-none rounded-xl border border-rule bg-paper"
      onPointerDown={(e) => {
        const [x, y] = toWorld(e);
        const r = e.currentTarget.getBoundingClientRect();
        const pxPerUnit = r.width / (2 * R);
        const dist = Math.hypot(x - g.mean[0], y - g.mean[1]) * pxPerUnit;
        drag.current = dist < 26 ? "mean" : "slice";
        e.currentTarget.setPointerCapture(e.pointerId);
        if (drag.current === "slice") onValue(clamp(axis === 0 ? x : y));
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const [x, y] = toWorld(e);
        if (drag.current === "mean") onMean([clamp(x), clamp(y)]);
        else onValue(clamp(axis === 0 ? x : y));
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    />
  );
}

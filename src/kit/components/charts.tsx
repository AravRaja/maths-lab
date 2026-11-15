"use client";

import { useId, useMemo, useRef, useState, useLayoutEffect } from "react";
import { useCanvas } from "./use-canvas";
import { ditherField } from "@/kit/dither";
import { binSamples } from "@/kit/stats";

export { binSamples };
import { cn } from "@/lib/utils";

/*
 * Monochrome chart primitives. No colour: series are told apart by stroke style
 * (solid, dashed, dotted) and grey level. All take `ghost` to render a hatched
 * placeholder shape for "Yours to write" previews.
 */

export type StrokeStyle = "solid" | "dashed" | "dotted" | "soft";
const DASH: Record<StrokeStyle, string | undefined> = { solid: undefined, dashed: "6 5", dotted: "1.5 4", soft: undefined };

export interface Series {
  label?: string;
  /** y values (x = index) or [x, y] pairs. */
  data: number[] | [number, number][];
  stroke?: StrokeStyle;
}

function toPoints(d: Series["data"]): [number, number][] {
  return (d as (number | [number, number])[]).map((v, i) => (Array.isArray(v) ? v : [i, v]));
}

function niceTicks(lo: number, hi: number, n = 4): number[] {
  if (!isFinite(lo) || !isFinite(hi) || lo === hi) return [lo];
  const step0 = (hi - lo) / n;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toPrecision(10));
  return out;
}

function fmt(v: number): string {
  const a = Math.abs(v);
  if (a !== 0 && (a < 1e-3 || a >= 1e5)) return v.toExponential(0);
  return +v.toPrecision(3) + "";
}

const PAD = { l: 40, r: 10, t: 12, b: 26 };

/**
 * Track an element's CSS width so SVG charts render 1:1 (labels stay 11px on phones
 * instead of shrinking with a scaled viewBox). Falls back to 600 before mount.
 */
function useWidth<T extends Element>(fallback = 600) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(120, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function LineChart({
  series,
  height = 260,
  yDomain,
  xDomain,
  logY,
  ghost,
  xLabel,
  yLabel,
  className,
}: {
  series: Series[];
  height?: number;
  yDomain?: [number, number];
  xDomain?: [number, number];
  logY?: boolean;
  ghost?: boolean;
  xLabel?: string;
  yLabel?: string;
  className?: string;
}) {
  const H = height;
  const [box, W] = useWidth<HTMLElement>();
  const pts = useMemo(() => {
    const base = ghost
      ? [{ data: Array.from({ length: 60 }, (_, i) => Math.exp(-i / 14) + 0.06 * Math.sin(i / 2)) as number[], stroke: "dashed" as StrokeStyle }]
      : series;
    return base.map((s) => ({ ...s, p: toPoints(s.data).map(([x, y]) => [x, logY ? Math.log10(Math.max(y, 1e-12)) : y] as [number, number]) }));
  }, [series, ghost, logY]);

  const all = pts.flatMap((s) => s.p);
  const xs = xDomain ?? [Math.min(...all.map((p) => p[0])), Math.max(...all.map((p) => p[0]))];
  let ys = yDomain ? (logY ? (yDomain.map((v) => Math.log10(v)) as [number, number]) : yDomain) : [Math.min(...all.map((p) => p[1])), Math.max(...all.map((p) => p[1]))];
  if (ys[0] === ys[1]) ys = [ys[0] - 1, ys[1] + 1];
  const sx = (x: number) => PAD.l + ((x - xs[0]) / (xs[1] - xs[0] || 1)) * (W - PAD.l - PAD.r);
  const sy = (y: number) => H - PAD.b - ((y - ys[0]) / (ys[1] - ys[0] || 1)) * (H - PAD.t - PAD.b);
  const yt = niceTicks(ys[0], ys[1]);
  const xt = niceTicks(xs[0], xs[1], W < 420 ? 3 : 5);
  const hatch = useId();

  return (
    <figure ref={box} className={cn("w-full", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible" role="img" aria-label={series.map((s) => s.label).filter(Boolean).join(", ") || "line chart"}>
        <defs>
          <pattern id={hatch} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="var(--rule)" strokeWidth="2" />
          </pattern>
        </defs>
        {ghost && <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} fill={`url(#${hatch})`} />}
        {yt.map((v) => (
          <g key={`y${v}`}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(v)} y2={sy(v)} stroke="var(--rule)" />
            <text x={PAD.l - 8} y={sy(v)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--ink-soft)">
              {logY ? `1e${v}` : fmt(v)}
            </text>
          </g>
        ))}
        {xt.map((v) => (
          <text key={`x${v}`} x={sx(v)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--ink-soft)">
            {fmt(v)}
          </text>
        ))}
        {pts.map((s, i) => (
          <path
            key={i}
            d={s.p.filter((p) => isFinite(p[1])).map((p, j) => `${j ? "L" : "M"}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join("")}
            fill="none"
            stroke={s.stroke === "soft" || ghost ? "var(--ink-soft)" : "var(--ink)"}
            strokeWidth={i === 0 ? 2 : 1.5}
            strokeDasharray={DASH[s.stroke ?? (["solid", "dashed", "dotted"] as const)[i % 3]]}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {yLabel && (
          <text x={4} y={PAD.t} fontSize="11" fill="var(--ink-soft)" dominantBaseline="hanging">
            {yLabel}
          </text>
        )}
        {xLabel && (
          <text x={W - PAD.r} y={H - PAD.b - 6} fontSize="11" textAnchor="end" fill="var(--ink-soft)">
            {xLabel}
          </text>
        )}
      </svg>
      {series.some((s) => s.label) && !ghost && (
        <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
          {series.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-2">
              <svg width="22" height="6" aria-hidden>
                <line x1="1" y1="3" x2="21" y2="3" stroke={s.stroke === "soft" ? "var(--ink-soft)" : "var(--ink)"} strokeWidth="2" strokeDasharray={DASH[s.stroke ?? (["solid", "dashed", "dotted"] as const)[i % 3]]} />
              </svg>
              {s.label}
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  );
}

export function Histogram({
  samples,
  counts: countsProp,
  bins = 30,
  range,
  density,
  overlay,
  height = 220,
  ghost,
  className,
}: {
  /** Raw samples (binned here) or pre-computed `counts`. */
  samples?: ArrayLike<number>;
  counts?: number[];
  bins?: number;
  range?: [number, number];
  /** Normalise to a probability density (area 1). */
  density?: boolean;
  /** Optional curve drawn dashed on top, e.g. the true pdf: f(x) in the same units. */
  overlay?: (x: number) => number;
  height?: number;
  ghost?: boolean;
  className?: string;
}) {
  const H = height;
  const [box, W] = useWidth<HTMLDivElement>();
  const { counts, lo, hi } = useMemo(() => {
    if (ghost) return { counts: Array.from({ length: bins }, (_, i) => Math.exp(-(((i - bins / 2) / (bins / 6)) ** 2))), lo: -3, hi: 3 };
    if (countsProp) return { counts: countsProp, lo: range?.[0] ?? 0, hi: range?.[1] ?? countsProp.length };
    return binSamples(samples ?? [], bins, range);
  }, [samples, countsProp, bins, range, ghost]);
  const n = counts.length;
  const width = (hi - lo) / n;
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const vals = density && !ghost ? counts.map((c) => c / (total * width)) : counts;
  let top = Math.max(...vals, 1e-12);
  const curve = overlay && !ghost ? Array.from({ length: 121 }, (_, i) => { const x = lo + ((hi - lo) * i) / 120; return [x, overlay(x)] as const; }) : null;
  if (curve) top = Math.max(top, ...curve.map((c) => c[1]).filter(isFinite));
  const iw = W - PAD.l - PAD.r;
  const sx = (x: number) => PAD.l + ((x - lo) / (hi - lo)) * iw;
  const sy = (y: number) => H - PAD.b - (y / top) * (H - PAD.t - PAD.b);
  const bw = iw / n;

  return (
    <div ref={box} className={cn("w-full", className)}>
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="histogram">
      <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="var(--rule)" />
      {vals.map((v, i) => (
        <rect
          key={i}
          x={PAD.l + i * bw + 1}
          y={sy(v)}
          width={Math.max(1, bw - 2)}
          height={H - PAD.b - sy(v)}
          rx={Math.min(3, bw / 4)}
          fill={ghost ? "none" : "var(--ink)"}
          stroke={ghost ? "var(--ink-soft)" : "none"}
          strokeDasharray={ghost ? "3 3" : undefined}
        />
      ))}
      {curve && (
        <path d={curve.map((c, i) => `${i ? "L" : "M"}${sx(c[0]).toFixed(1)},${sy(c[1]).toFixed(1)}`).join("")} fill="none" stroke="var(--ink-soft)" strokeWidth="2" strokeDasharray="6 5" />
      )}
      {niceTicks(lo, hi, W < 420 ? 4 : 6).map((v) => (
        <text key={v} x={sx(v)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--ink-soft)">{fmt(v)}</text>
      ))}
      <text x={PAD.l - 8} y={sy(top)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--ink-soft)">{fmt(top)}</text>
    </svg>
    </div>
  );
}

/**
 * Grey-ramp heatmap on a canvas. `values` is row-major (rows x cols). Set `dither` for a
 * Bayer-dithered 1-bit look (very on-brand for value functions and attention maps).
 */
export function Heatmap({
  values,
  rows,
  cols,
  domain,
  dither,
  ghost,
  aspect = 1,
  onCell,
  className,
}: {
  values: ArrayLike<number>;
  rows: number;
  cols: number;
  domain?: [number, number];
  dither?: boolean;
  ghost?: boolean;
  /** height / width of the canvas. */
  aspect?: number;
  /** Called with the cell under the pointer (tap or hover). */
  onCell?: (cell: { row: number; col: number; value: number } | null) => void;
  className?: string;
}) {
  const ref = useCanvas(
    ({ ctx, width, height, pointer }) => {
      const field = new Float32Array(rows * cols);
      let lo = domain?.[0] ?? Infinity;
      let hi = domain?.[1] ?? -Infinity;
      if (!domain) for (let i = 0; i < field.length; i++) { const v = ghost ? 0 : values[i]; lo = Math.min(lo, v); hi = Math.max(hi, v); }
      for (let i = 0; i < field.length; i++) {
        const r = Math.floor(i / cols), c = i % cols;
        field[i] = ghost ? 0.5 + 0.5 * Math.sin(r * 0.5) * Math.cos(c * 0.5) : (values[i] - lo) / (hi - lo || 1);
      }
      ctx.clearRect(0, 0, width, height);
      if (dither) {
        // Upsample to ~3px cells then dither, so the pattern reads on phones.
        const px = 3;
        const w = Math.max(1, Math.floor(width / px)), h = Math.max(1, Math.floor(height / px));
        const up = new Float32Array(w * h);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) up[y * w + x] = field[Math.min(rows - 1, Math.floor((y / h) * rows)) * cols + Math.min(cols - 1, Math.floor((x / w) * cols))];
        const img = new ImageData(w, h);
        ditherField(up, w, h, img.data, ghost ? [0, 0.15] : [0, 0.45, 1]);
        const off = new OffscreenCanvas(w, h);
        off.getContext("2d")!.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(off, 0, 0, w * px, h * px);
      } else {
        const cw = width / cols, ch = height / rows;
        for (let i = 0; i < field.length; i++) {
          const g = Math.round((ghost ? 0.12 * field[i] : field[i]) * 255);
          ctx.fillStyle = `rgb(${g} ${g} ${g})`;
          ctx.fillRect((i % cols) * cw, Math.floor(i / cols) * ch, cw + 0.5, ch + 0.5);
        }
      }
      if (pointer && onCell && !ghost) {
        const col = Math.min(cols - 1, Math.floor((pointer.x / width) * cols));
        const row = Math.min(rows - 1, Math.floor((pointer.y / height) * rows));
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(col * (width / cols) + 0.75, row * (height / rows) + 0.75, width / cols - 1.5, height / rows - 1.5);
      }
    },
    { animate: !!onCell, fps: 30 },
    [values, rows, cols, domain, dither, ghost],
  );

  return (
    <canvas
      ref={ref}
      className={cn("block w-full touch-none rounded-xl border border-rule", className)}
      style={{ aspectRatio: `${1 / aspect}` }}
      onPointerMove={(e) => {
        if (!onCell) return;
        const r = e.currentTarget.getBoundingClientRect();
        const col = Math.min(cols - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * cols)));
        const row = Math.min(rows - 1, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * rows)));
        onCell({ row, col, value: values[row * cols + col] });
      }}
      onPointerLeave={() => onCell?.(null)}
    />
  );
}

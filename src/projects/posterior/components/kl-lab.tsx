"use client";

import { useEffect, useMemo, useState } from "react";
import { Section, Sheet } from "@/kit/components/page-shell";
import { CoreError, CorePanel, runCore } from "@/kit/components/core-guard";
import { Heatmap, LineChart } from "@/kit/components/charts";
import { useCanvas } from "@/kit/components/use-canvas";
import { useWorker } from "@/kit/components/use-worker";
import { grey } from "@/kit/canvas";
import { reviveError, type NotYoursYet } from "@/kit/not-yours-yet";
import { klNormal } from "../core/kl";
import { mcEstimate } from "../core/montecarlo";
import type { Normal } from "../core/types";
import { mixtureLogPdf, normalLogPdf, normalPdf } from "../lib/special";
import { mulberry32, normalSampler } from "../lib/rng";
import { KL_MIXTURE } from "../lib/targets";
import type { handlers } from "../workers/sampling.worker";
import { Readout, SliderField, fmt } from "./controls";

const G = 40;
const MU: [number, number] = [-4, 4];
const LOGSD: [number, number] = [Math.log(0.2), Math.log(3)];
const X: [number, number] = [-6, 6];

const cellMu = (c: number) => MU[0] + ((MU[1] - MU[0]) * c) / (G - 1);
const cellSd = (r: number) => Math.exp(LOGSD[1] - ((LOGSD[1] - LOGSD[0]) * r) / (G - 1));

export function KlLab() {
  const [mp, setMp] = useState(-0.8);
  const [sp, setSp] = useState(0.7);
  const [mq, setMq] = useState(1.2);
  const [sq, setSq] = useState(1.6);
  const p: Normal = useMemo(() => ({ mean: mp, variance: sp * sp }), [mp, sp]);
  const q: Normal = useMemo(() => ({ mean: mq, variance: sq * sq }), [mq, sq]);

  const kl = useMemo(() => runCore(() => [klNormal(p, q), klNormal(q, p)] as const), [p, q]);
  const land = useMemo(
    () =>
      runCore(() => {
        const out = new Float32Array(G * G);
        for (let r = 0; r < G; r++) for (let c = 0; c < G; c++) out[r * G + c] = Math.log1p(klNormal(p, { mean: cellMu(c), variance: cellSd(r) ** 2 }));
        return out;
      }),
    [p],
  );

  // Monte Carlo check of the closed form: samples from p, f = log p − log q.
  const mc = useMemo(
    () =>
      runCore(() => {
        const z = normalSampler(mulberry32(5));
        const vals = Float64Array.from({ length: 20000 }, () => {
          const x = p.mean + Math.sqrt(p.variance) * z();
          return normalLogPdf(x, p.mean, p.variance) - normalLogPdf(x, q.mean, q.variance);
        });
        const rows: { n: number; mean: number; se: number }[] = [];
        for (let n = 10; n <= vals.length; n = Math.ceil(n * 1.25)) {
          const e = mcEstimate(vals.subarray(0, n));
          rows.push({ n, mean: e.mean, se: e.stdErr });
        }
        return rows;
      }),
    [p, q],
  );

  const qCell = { r: Math.round(((LOGSD[1] - Math.log(sq)) / (LOGSD[1] - LOGSD[0])) * (G - 1)), c: Math.round(((mq - MU[0]) / (MU[1] - MU[0])) * (G - 1)) };
  const pCell = { r: Math.round(((LOGSD[1] - Math.log(sp)) / (LOGSD[1] - LOGSD[0])) * (G - 1)), c: Math.round(((mp - MU[0]) / (MU[1] - MU[0])) * (G - 1)) };

  return (
    <Section id="kl" index={5} kicker="KL divergence" title="A distance that isn't one">
      <p className="mb-5 text-ink-soft">
        KL(p‖q) is the average extra surprise from expecting q when the world is p. The dotted curve is the integrand
        p·log(p/q); its area is the divergence. Swap the roles and the number changes.
      </p>
      <Sheet className="flex flex-col gap-4">
        <TwoGauss p={p} q={q} />
        <div className="grid gap-3 sm:grid-cols-2">
          <SliderField label="p mean" value={mp} min={-3.5} max={3.5} step={0.05} onChange={setMp} />
          <SliderField label="p sd" value={sp} min={0.2} max={3} step={0.02} onChange={setSp} />
          <SliderField label="q mean" value={mq} min={-3.5} max={3.5} step={0.05} onChange={setMq} />
          <SliderField label="q sd" value={sq} min={0.2} max={3} step={0.02} onChange={setSq} />
        </div>
        {kl.status === "missing" ? (
          <CorePanel error={kl.missing} ghost={<div className="grid h-24 grid-cols-2 gap-2"><div className="rounded-xl border border-rule" /><div className="rounded-xl border border-rule" /></div>} />
        ) : kl.status === "error" ? (
          <CoreError error={kl.error} />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Readout label="KL(p‖q)" value={fmt(kl.value[0], 3)} sub="nats" />
            <Readout label="KL(q‖p)" value={fmt(kl.value[1], 3)} sub={`ratio ×${fmt(kl.value[1] / Math.max(1e-9, kl.value[0]), 2)}`} />
          </div>
        )}
      </Sheet>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Sheet className="flex flex-col gap-3">
          <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Landscape · KL(p‖q) over every q</p>
          {land.status === "missing" ? (
            <CorePanel error={land.missing} ghost={<Heatmap ghost values={[]} rows={G} cols={G} dither />} />
          ) : land.status === "error" ? (
            <CoreError error={land.error} />
          ) : (
            <MarkedHeatmap
              values={land.value}
              marks={[{ ...qCell, kind: "ring" }, { ...pCell, kind: "dot" }]}
              onCell={({ row, col }) => { setMq(+cellMu(col).toFixed(2)); setSq(+cellSd(row).toFixed(2)); }}
            />
          )}
          <p className="text-xs text-ink-soft">x: q mean (−4 to 4) · y: q sd (3 at top, 0.2 at the bottom, log scale). Dark is low. Tap to move q; the dot is p.</p>
        </Sheet>
        <Sheet className="flex flex-col gap-3">
          <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Check · Monte Carlo vs closed form</p>
          {mc.status === "missing" ? (
            <CorePanel error={mc.missing} ghost={<LineChart ghost series={[]} height={200} />} />
          ) : mc.status === "error" ? (
            <CoreError error={mc.error} />
          ) : (
            <LineChart
              height={200}
              series={[
                { label: "MC estimate", data: mc.value.map((r) => [Math.log10(r.n), r.mean] as [number, number]) },
                ...(kl.status === "ok" ? [{ label: "closed form", stroke: "dashed" as const, data: mc.value.map((r) => [Math.log10(r.n), kl.value[0]] as [number, number]) }] : []),
                {
                  // One dotted outline: along the upper edge, then back along the lower edge.
                  label: "±2 SE",
                  stroke: "dotted" as const,
                  data: [
                    ...mc.value.map((r) => [Math.log10(r.n), r.mean + 2 * (Number.isFinite(r.se) ? r.se : 0)] as [number, number]),
                    ...mc.value.map((r) => [Math.log10(r.n), r.mean - 2 * (Number.isFinite(r.se) ? r.se : 0)] as [number, number]).reverse(),
                  ],
                },
              ]}
              xLabel="log₁₀ n"
            />
          )}
        </Sheet>
      </div>

      <ModeSeeking />
    </Section>
  );
}

function MarkedHeatmap({
  values,
  marks,
  onCell,
}: {
  values: Float32Array;
  marks: { r: number; c: number; kind: "ring" | "dot" | "square" }[];
  onCell?: (cell: { row: number; col: number }) => void;
}) {
  return (
    <div
      className="relative"
      onPointerDown={(e) => {
        if (!onCell) return;
        const r = e.currentTarget.getBoundingClientRect();
        onCell({
          col: Math.min(G - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * G))),
          row: Math.min(G - 1, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * G))),
        });
      }}
    >
      <Heatmap values={values} rows={G} cols={G} dither />
      {marks.map((m, i) =>
        m.r < 0 || m.r >= G || m.c < 0 || m.c >= G ? null : (
          <span
            key={i}
            aria-hidden
            className={
              m.kind === "ring"
                ? "pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-paper/30"
                : m.kind === "square"
                  ? "pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-[4px] border-2 border-ink bg-paper"
                  : "pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-2 ring-paper"
            }
            style={{ left: `${((m.c + 0.5) / G) * 100}%`, top: `${((m.r + 0.5) / G) * 100}%` }}
          />
        ),
      )}
    </div>
  );
}

function TwoGauss({ p, q }: { p: Normal; q: Normal }) {
  const ref = useCanvas(
    ({ ctx, width, height }) => {
      ctx.fillStyle = grey(0);
      ctx.fillRect(0, 0, width, height);
      const padB = 22, padT = 12;
      const ih = height - padB - padT;
      const sx = (x: number) => ((x - X[0]) / (X[1] - X[0])) * width;
      const base = padT + ih * 0.72;
      const fp = (x: number) => normalPdf(x, p.mean, p.variance);
      const fq = (x: number) => normalPdf(x, q.mean, q.variance);
      const integrand = (x: number) => fp(x) * (normalLogPdf(x, p.mean, p.variance) - normalLogPdf(x, q.mean, q.variance));
      let top = 0, ilo = 0, ihi = 0;
      for (let i = 0; i <= 300; i++) {
        const x = X[0] + ((X[1] - X[0]) * i) / 300;
        top = Math.max(top, fp(x), fq(x));
        const v = integrand(x);
        ilo = Math.min(ilo, v); ihi = Math.max(ihi, v);
      }
      const s = (ih * 0.7) / Math.max(top, ihi, -ilo / 0.38);
      const sy = (v: number) => base - v * s;

      // Integrand: hatched signed area.
      ctx.beginPath();
      ctx.moveTo(sx(X[0]), base);
      for (let i = 0; i <= 300; i++) { const x = X[0] + ((X[1] - X[0]) * i) / 300; ctx.lineTo(sx(x), sy(integrand(x))); }
      ctx.lineTo(sx(X[1]), base);
      ctx.closePath();
      ctx.fillStyle = grey(1, 0.1);
      ctx.fill();
      ctx.setLineDash([1.5, 3]);
      ctx.strokeStyle = grey(0.8);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);

      const curve = (f: (x: number) => number) => {
        ctx.beginPath();
        for (let i = 0; i <= 300; i++) { const x = X[0] + ((X[1] - X[0]) * i) / 300; if (i) ctx.lineTo(sx(x), sy(f(x))); else ctx.moveTo(sx(x), sy(f(x))); }
      };
      curve(fp);
      ctx.strokeStyle = grey(1);
      ctx.lineWidth = 2.25;
      ctx.stroke();
      curve(fq);
      ctx.setLineDash([7, 5]);
      ctx.strokeStyle = grey(0.7);
      ctx.lineWidth = 1.75;
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = grey(0.25);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, base + 0.5); ctx.lineTo(width, base + 0.5); ctx.stroke();
      ctx.fillStyle = grey(0.55);
      ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textBaseline = "top";
      ctx.fillText("p solid · q dashed · p log(p/q) dotted", 6, 4);
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "center";
      for (let v = -6; v <= 6; v += 2) ctx.fillText(String(v), sx(v), height - 6);
      ctx.textAlign = "left";
    },
    { animate: false },
    [p, q],
  );
  return <canvas ref={ref} aria-label="Two Gaussians and the KL integrand" className="block h-56 w-full rounded-xl border border-rule sm:h-64" />;
}

const toLog = (v: Float32Array | null) => (v ? v.map((x) => Math.log1p(Math.max(0, x))) : null);

/** Fit one Gaussian to two bumps by minimising forward vs reverse KL (brute force, in the worker). */
function ModeSeeking() {
  const worker = useWorker<typeof handlers>(() => new Worker(new URL("../workers/sampling.worker.ts", import.meta.url)));
  const [res, setRes] = useState<Awaited<ReturnType<(typeof handlers)["klLandscape"]>> | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      worker.current
        ?.call("klLandscape", { p: KL_MIXTURE, mus: MU, logSds: LOGSD, grid: G, samples: 600, seed: 3 })
        .then(setRes)
        .catch(() => {});
    }, 200);
    return () => clearTimeout(id);
  }, [worker]);

  const missing = res?.missing ? (reviveError(res.missing) as NotYoursYet) : null;
  const best = (v: Float32Array | null) => {
    if (!v) return null;
    let k = 0;
    for (let i = 1; i < v.length; i++) if (v[i] < v[k]) k = i;
    return { r: Math.floor(k / G), c: k % G };
  };
  const bf = best(res?.forward ?? null);
  const br = best(res?.reverse ?? null);
  const fwd = useMemo(() => toLog(res?.forward ?? null), [res]);
  const rev = useMemo(() => toLog(res?.reverse ?? null), [res]);

  return (
    <Sheet className="mt-4 flex flex-col gap-4">
      <div>
        <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Mode-seeking vs mass-covering</p>
        <p className="mt-2 text-sm text-ink-soft">
          p has two bumps; q is one Gaussian. Every cell of each map is a Monte Carlo KL through your <code className="font-mono text-ink">mcEstimate()</code>,
          computed in a worker. The square marks each map&apos;s best q.
        </p>
      </div>
      {missing ? (
        <CorePanel error={missing} ghost={<div className="grid grid-cols-2 gap-2"><Heatmap ghost values={[]} rows={G} cols={G} dither /><Heatmap ghost values={[]} rows={G} cols={G} dither /></div>} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <p className="font-mono text-[11px] text-ink-soft">forward KL(p‖q)</p>
              {fwd ? <MarkedHeatmap values={fwd} marks={bf ? [{ ...bf, kind: "square" }] : []} /> : <Heatmap ghost values={[]} rows={G} cols={G} dither />}
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-mono text-[11px] text-ink-soft">reverse KL(q‖p)</p>
              {rev ? <MarkedHeatmap values={rev} marks={br ? [{ ...br, kind: "square" }] : []} /> : <Heatmap ghost values={[]} rows={G} cols={G} dither />}
            </div>
          </div>
          <Fits forward={bf} reverse={br} />
        </>
      )}
    </Sheet>
  );
}

function Fits({ forward, reverse }: { forward: { r: number; c: number } | null; reverse: { r: number; c: number } | null }) {
  const ref = useCanvas(
    ({ ctx, width, height }) => {
      ctx.fillStyle = grey(0);
      ctx.fillRect(0, 0, width, height);
      const base = height - 20;
      const sx = (x: number) => ((x - X[0]) / (X[1] - X[0])) * width;
      const pf = (x: number) => Math.exp(mixtureLogPdf(x, KL_MIXTURE));
      const fits: [string, ((x: number) => number) | null, number[] | undefined][] = [
        ["forward", forward ? (x) => normalPdf(x, cellMu(forward.c), cellSd(forward.r) ** 2) : null, [7, 5]],
        ["reverse", reverse ? (x) => normalPdf(x, cellMu(reverse.c), cellSd(reverse.r) ** 2) : null, [1.5, 3.5]],
      ];
      let top = 0;
      for (let i = 0; i <= 300; i++) {
        const x = X[0] + ((X[1] - X[0]) * i) / 300;
        top = Math.max(top, pf(x), ...fits.map(([, f]) => (f ? f(x) : 0)));
      }
      const sy = (v: number) => base - (v / top) * (height - 40);
      const draw = (f: (x: number) => number, dash: number[] | undefined, lvl: number, w: number) => {
        ctx.beginPath();
        for (let i = 0; i <= 300; i++) { const x = X[0] + ((X[1] - X[0]) * i) / 300; if (i) ctx.lineTo(sx(x), sy(f(x))); else ctx.moveTo(sx(x), sy(f(x))); }
        ctx.setLineDash(dash ?? []);
        ctx.strokeStyle = grey(lvl);
        ctx.lineWidth = w;
        ctx.stroke();
        ctx.setLineDash([]);
      };
      // p filled.
      ctx.beginPath();
      ctx.moveTo(sx(X[0]), base);
      for (let i = 0; i <= 300; i++) { const x = X[0] + ((X[1] - X[0]) * i) / 300; ctx.lineTo(sx(x), sy(pf(x))); }
      ctx.lineTo(sx(X[1]), base);
      ctx.fillStyle = grey(1, 0.14);
      ctx.fill();
      draw(pf, undefined, 1, 2);
      for (const [, f, dash] of fits) if (f) draw(f, dash, 0.85, 2);
      ctx.fillStyle = grey(0.55);
      ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textBaseline = "top";
      ctx.fillText("p filled · forward fit - - · reverse ···", 6, 4);
      ctx.textBaseline = "alphabetic";
    },
    { animate: false },
    [forward?.r, forward?.c, reverse?.r, reverse?.c],
  );
  return <canvas ref={ref} aria-label="The mixture and the two best single-Gaussian fits" className="block h-44 w-full rounded-xl border border-rule" />;
}

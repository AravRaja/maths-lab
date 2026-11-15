"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Play, RotateCcw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Section, Sheet } from "@/kit/components/page-shell";
import { LineChart } from "@/kit/components/charts";
import { CoreError, CorePanel, runCore } from "@/kit/components/core-guard";
import { useCanvas } from "@/kit/components/use-canvas";
import { useWorker } from "@/kit/components/use-worker";
import { useToast } from "@/kit/components/toast";
import { grey } from "@/kit/canvas";
import { isNotYoursYet, type NotYoursYet } from "@/kit/not-yours-yet";
import { CORES } from "../core";
import { rankK } from "../core/lowrank";
import type { Matrix, SVD } from "../core/types";
import { gapMatrix, raceSpectrum } from "../lib/spectra";
import { presetImage } from "../lib/images";
import { randn } from "../lib/rng";
import type { PowerFrame, handlers } from "../workers/rank.worker";
import { drawMatrix } from "./raster";
import { font } from "./canvas-font";
import { Field, Kicker, Readout, sliderValue } from "./ui-bits";
import { StaticImage } from "./compressor";

const M = 64, NC = 48, STEPS = 40;
const V0 = randn(NC, 2024);

const powerCores = CORES.filter((c) => c.milestone === "m4-power");
function missingPower(): NotYoursYet | null {
  for (const c of powerCores) {
    const r = runCore(c.probe);
    if (r.status === "missing") return r.missing;
  }
  return null;
}

/** v_t as a waveform against the true v_1 (dashed), plus the rank-one picture σ_t u_t v_tᵀ. */
function WaveCanvas({ frame, truth, t }: { frame: PowerFrame | null; truth: Float64Array; t: number }) {
  const outer = useMemo(() => {
    if (!frame) return null;
    const d = new Float64Array(M * NC);
    for (let i = 0; i < M; i++) for (let j = 0; j < NC; j++) d[i * NC + j] = frame.u[i] * frame.v[j];
    return d;
  }, [frame]);
  const ref = useCanvas(
    ({ ctx, width, height }) => {
      ctx.fillStyle = grey(0);
      ctx.fillRect(0, 0, width, height);
      const pad = 12;
      const sq = Math.min(height - pad * 2, width * 0.34);
      const wx = pad, ww = width - sq - pad * 3, mid = height / 2, amp = (height / 2 - pad) * 0.85;
      const scaleY = amp / Math.max(...Array.from(truth, Math.abs));
      const line = (v: ArrayLike<number>, sign: number) => {
        ctx.beginPath();
        for (let j = 0; j < NC; j++) {
          const x = wx + (j / (NC - 1)) * ww;
          const y = mid - sign * v[j] * scaleY;
          if (j) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.stroke();
      };
      ctx.strokeStyle = grey(0.18);
      ctx.beginPath();
      ctx.moveTo(wx, mid);
      ctx.lineTo(wx + ww, mid);
      ctx.stroke();
      // Start vector, faint.
      const n0 = Math.hypot(...V0);
      ctx.strokeStyle = grey(0.25);
      line(V0.map((x) => x / n0), 1);
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = grey(0.6);
      line(truth, 1);
      ctx.setLineDash([]);
      if (frame) {
        let d = 0;
        for (let j = 0; j < NC; j++) d += frame.v[j] * truth[j];
        ctx.strokeStyle = grey(1);
        ctx.lineWidth = 2;
        line(frame.v, d < 0 ? -1 : 1);
        ctx.lineWidth = 1;
      }
      const sx = width - sq - pad;
      if (outer) drawMatrix(ctx, outer, M, NC, sx, (height - sq) / 2, sq, sq, { range: "symmetric", dither: true, cell: 2, tones: [0, 0.25, 0.6, 1] }, "outer");
      ctx.strokeStyle = grey(0.25);
      ctx.strokeRect(sx + 0.5, (height - sq) / 2 + 0.5, sq - 1, sq - 1);
      font(ctx, 26, 800, "expanded");
      ctx.fillStyle = grey(1);
      ctx.fillText(`t=${String(t).padStart(2, "0")}`, wx, pad + 22);
      font(ctx, 10, 500, "condensed");
      ctx.fillStyle = grey(0.55);
      ctx.fillText("SOLID = vₜ · DASHED = v₁ · FAINT = v₀", wx, height - pad);
    },
    { animate: false },
    [frame, truth, t, outer],
  );
  return <canvas ref={ref} aria-label="power iteration converging" className="block h-56 w-full rounded-xl border border-rule sm:h-64" />;
}

export function PowerLab() {
  const toast = useToast();
  const worker = useWorker<typeof handlers>(() => new Worker(new URL("../workers/rank.worker.ts", import.meta.url)));
  const raceWorker = useWorker<typeof handlers>(() => new Worker(new URL("../workers/rank.worker.ts", import.meta.url)));
  const [rho, setRho] = useState(0.85);
  const [frames, setFrames] = useState<PowerFrame[]>([]);
  const [shown, setShown] = useState(0);
  const [running, setRunning] = useState(false);
  const [missing, setMissing] = useState<NotYoursYet | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [race, setRace] = useState<{ lib: Float64Array; mine: SVD & { iters: number[] }; tLib: number; tMine: number } | null>(null);
  const [racing, setRacing] = useState(false);
  const anim = useRef<number | null>(null);

  const stub = useMemo(() => missingPower(), []);
  const blocked = stub ?? missing;
  const { V } = useMemo(() => gapMatrix(M, NC, raceSpectrum(rho)), [rho]);
  const truth = V[0];
  const portrait = useMemo(() => presetImage("portrait", 96), []);

  useEffect(() => () => {
    if (anim.current) clearInterval(anim.current);
  }, []);

  const run = (r = rho) => {
    const w = worker.current;
    if (!w) return;
    w.restart();
    if (anim.current) clearInterval(anim.current);
    setFrames([]);
    setShown(0);
    setRunning(true);
    setError(null);
    const { A: Ar } = gapMatrix(M, NC, raceSpectrum(r));
    w.call("powerTrace", { A: Ar, steps: STEPS, v0: V0 })
      .then((fs) => {
        setFrames(fs);
        let i = 0;
        anim.current = window.setInterval(() => {
          i++;
          setShown(i);
          if (i >= fs.length) {
            clearInterval(anim.current!);
            anim.current = null;
            setRunning(false);
          }
        }, 110);
      })
      .catch((e: unknown) => {
        setRunning(false);
        if (isNotYoursYet(e)) setMissing(e);
        else if (!(e instanceof Error && e.message === "Worker terminated")) setError(e instanceof Error ? e : new Error(String(e)));
      });
  };

  const runRace = () => {
    const w = raceWorker.current;
    if (!w) return;
    setRacing(true);
    w.call("race", { A: portrait, k: 16 })
      .then((r) => {
        setRace(r);
        const worst = Math.max(...Array.from(r.lib, (s, i) => Math.abs(s - r.mine.S[i]) / s));
        toast({ title: "Your SVD finished", description: `16 singular values, worst relative error ${worst.toExponential(1)}.`, status: worst < 1e-6 ? "success" : "neutral" });
      })
      .catch((e: unknown) => {
        if (isNotYoursYet(e)) setMissing(e);
        else if (!(e instanceof Error && e.message === "Worker terminated")) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => setRacing(false));
  };

  const visible = frames.slice(0, shown);
  const frame = visible.length ? visible[visible.length - 1] : null;
  const conv = useMemo(() => {
    const sErr: [number, number][] = [];
    const ang: [number, number][] = [];
    for (const f of visible) {
      sErr.push([f.t, Math.max(1e-16, Math.abs(1 - f.sigma))]);
      let d = 0;
      for (let j = 0; j < NC; j++) d += f.v[j] * truth[j];
      ang.push([f.t, Math.max(1e-16, Math.sqrt(Math.max(0, 1 - d * d)))]);
    }
    return { sErr, ang };
  }, [visible, truth]);
  const rate = useMemo(() => {
    const a = conv.ang;
    if (a.length < 12) return null;
    const i0 = Math.floor(a.length / 3), i1 = a.length - 1;
    if (a[i1][1] < 1e-13) return null;
    return Math.pow(a[i1][1] / a[i0][1], 1 / (a[i1][0] - a[i0][0]));
  }, [conv]);

  const mineRec = useMemo(() => (race ? runCore(() => rankK(race.mine, 16)) : null), [race]);

  return (
    <Section id="power" index={5} kicker="Power iteration" title="Find σ₁ by hand">
      <p className="mb-5 text-ink-soft">
        No SVD allowed. Start from a random vector, multiply by AᵀA, normalise, repeat. The strongest direction wins, and how fast
        it wins depends only on the gap between σ₁ and σ₂. Set the gap, predict the rate, then run.
      </p>
      {blocked ? (
        <CorePanel
          error={blocked}
          ghost={<div className="h-72"><WaveCanvas frame={null} truth={truth} t={0} /></div>}
        />
      ) : error ? (
        <CoreError error={error} />
      ) : (
        <div className="flex flex-col gap-4">
          <Sheet className="flex flex-col gap-4">
            <WaveCanvas frame={frame} truth={truth} t={frame?.t ?? 0} />
            <Field label="Gap" value={`σ₂/σ₁ = ${rho.toFixed(2)}`}>
              <Slider min={0.5} max={0.98} step={0.01} value={[rho]} onValueChange={(v) => setRho(sliderValue(v))} onValueCommitted={(v) => frames.length && run(sliderValue(v))} aria-label="gap ratio" />
            </Field>
            <div className="flex flex-wrap gap-3">
              <Button className="min-h-11" onClick={() => run()} disabled={running}>
                {frames.length ? <RotateCcw className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
                {frames.length ? "Run again" : "Run 40 iterations"}
              </Button>
            </div>
          </Sheet>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <Readout label="Estimate" value={frame ? frame.sigma.toFixed(6) : "—"} sub="σₜ · true σ₁ = 1" />
            <Readout label="Angle shrinks ×" value={rate ? rate.toFixed(3) : "—"} sub={`per iteration · ρ = ${rho.toFixed(2)}`} />
          </div>
          <Sheet>
            <Kicker className="mb-3">Error against iteration, log scale</Kicker>
            <LineChart
              logY
              height={220}
              xLabel="iteration t"
              xDomain={[1, STEPS]}
              series={[
                { label: "sin ∠(vₜ, v₁)", data: conv.ang.length ? conv.ang : [[1, 1]], stroke: "solid" },
                { label: "|σₜ − σ₁|", data: conv.sErr.length ? conv.sErr : [[1, 1]], stroke: "dashed" },
              ]}
            />
          </Sheet>

          <Sheet className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Kicker>Your SVD · power + deflate, 16 times</Kicker>
                <p className="mt-1 text-sm text-ink-soft">On a 96 × 96 portrait, against the library.</p>
              </div>
              <Button variant="outline" className="min-h-11" onClick={runRace} disabled={racing}>
                <Zap className="size-4" aria-hidden /> {racing ? "Racing…" : "Race the library"}
              </Button>
            </div>
            {race && (
              <>
                <LineChart
                  logY
                  height={200}
                  xLabel="i"
                  series={[
                    { label: "library σᵢ", data: Array.from(race.lib, (s, i) => [i + 1, s] as [number, number]), stroke: "solid" },
                    { label: "your σᵢ", data: Array.from(race.mine.S, (s, i) => [i + 1, s] as [number, number]), stroke: "dotted" },
                  ]}
                />
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <Readout label="Library" value={`${race.tLib.toFixed(0)}ms`} sub="all 96" />
                  <Readout label="Yours" value={`${race.tMine.toFixed(0)}ms`} sub="top 16 only" />
                  <Readout label="Iters" value={race.mine.iters.reduce((a, b) => a + b, 0)} sub="total, all 16" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <figure className="flex flex-col gap-2">
                    <div className="aspect-square overflow-hidden rounded-xl border border-rule"><StaticImage A={portrait} /></div>
                    <figcaption className="type-narrow text-xs tracking-[0.15em] text-ink-soft uppercase">original</figcaption>
                  </figure>
                  <figure className="flex flex-col gap-2">
                    {mineRec?.status === "ok" ? (
                      <div className="aspect-square overflow-hidden rounded-xl border border-ink"><MatrixTile A={mineRec.value} /></div>
                    ) : mineRec?.status === "missing" ? (
                      <CorePanel error={mineRec.missing} />
                    ) : null}
                    <figcaption className="type-narrow text-xs tracking-[0.15em] text-ink-soft uppercase">rank 16 from your SVD</figcaption>
                  </figure>
                </div>
              </>
            )}
          </Sheet>
        </div>
      )}
    </Section>
  );
}

function MatrixTile({ A }: { A: Matrix }) {
  return <StaticImage A={A} />;
}

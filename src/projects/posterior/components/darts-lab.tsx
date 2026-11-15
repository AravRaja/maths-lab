"use client";

import { useRef, useState } from "react";
import { Play, Square } from "lucide-react";
import { Section, Sheet } from "@/kit/components/page-shell";
import { CorePanel } from "@/kit/components/core-guard";
import { LineChart } from "@/kit/components/charts";
import { useCanvas } from "@/kit/components/use-canvas";
import { useWorker } from "@/kit/components/use-worker";
import { useToast } from "@/kit/components/toast";
import { grey } from "@/kit/canvas";
import { isNotYoursYet, reviveError, type NotYoursYet } from "@/kit/not-yours-yet";
import type { DartsFrame, Estimator, handlers } from "../workers/sampling.worker";
import { Action, Pills, Readout } from "./controls";

const RUNS = 10;
const MAX_N = 120000;
const BUF = 360;

type Cp = DartsFrame["checkpoints"][number];

export function DartsLab() {
  const toast = useToast();
  const worker = useWorker<typeof handlers>(() => new Worker(new URL("../workers/sampling.worker.ts", import.meta.url)));
  const [estimator, setEstimator] = useState<Estimator>("darts");
  const [running, setRunning] = useState(false);
  const [n, setN] = useState(0);
  const [cps, setCps] = useState<Cp[]>([]);
  const [missing, setMissing] = useState<NotYoursYet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const board = useRef<{ off: OffscreenCanvas; mode: Estimator } | null>(null);
  const live = useRef<{ cps: Cp[]; seed: number; celebrated: boolean }>({ cps: [], seed: 1, celebrated: false });

  const clearBoard = (mode: Estimator) => {
    const off = new OffscreenCanvas(BUF, BUF);
    board.current = { off, mode };
  };

  const start = (mode = estimator) => {
    const w = worker.current;
    if (!w) return;
    w.restart();
    clearBoard(mode);
    live.current = { cps: [], seed: live.current.seed + 1, celebrated: false };
    setCps([]);
    setN(0);
    setMissing(null);
    setError(null);
    setRunning(true);
    w.call("darts", { seed: live.current.seed, estimator: mode, runs: RUNS, maxN: MAX_N }, (v) => {
      const f = v as DartsFrame;
      const b = board.current;
      if (b) {
        const c = b.off.getContext("2d")!;
        for (let i = 0; i < f.points.length; i += 2) {
          const x = f.points[i], y = f.points[i + 1];
          if (b.mode === "darts") {
            c.fillStyle = x * x + y * y <= 1 ? "rgb(255 255 255)" : "rgb(90 90 90)";
            c.fillRect(Math.floor(x * BUF), Math.floor((1 - y) * BUF), 1, 1);
          } else {
            c.fillStyle = "rgb(255 255 255 / 0.05)";
            c.fillRect(Math.floor(x * BUF), Math.floor((1 - y) * BUF), 1, Math.ceil(y * BUF));
          }
        }
      }
      if (f.missing) setMissing((m) => m ?? (reviveError(f.missing) as NotYoursYet));
      if (f.checkpoints.length) {
        live.current.cps = [...live.current.cps, ...f.checkpoints];
        setCps(live.current.cps);
        const last = f.checkpoints[f.checkpoints.length - 1];
        if (!live.current.celebrated && last.n > 5000 && Math.abs(last.means[0] - Math.PI) < 2e-3) {
          live.current.celebrated = true;
          toast({ title: "π to 3 decimals", description: `${last.means[0].toFixed(5)} after ${last.n.toLocaleString()} samples.`, status: "success" });
        }
      }
      setN(f.n);
    })
      .then(() => setRunning(false))
      .catch((e: unknown) => {
        if (e instanceof Error && e.message === "Worker terminated") return;
        if (isNotYoursYet(e)) setMissing(e);
        else setError(e instanceof Error ? e.message : String(e));
        setRunning(false);
      });
  };

  const stop = () => {
    worker.current?.restart();
    setRunning(false);
  };

  const last = cps[cps.length - 1];
  const est = last?.means[0];
  const se = last?.se;
  const digits = est === undefined ? 0 : Math.max(0, Math.floor(-Math.log10(Math.abs(est - Math.PI) + 1e-15)));

  return (
    <Section id="darts" index={3} kicker="Monte Carlo · standard error" title="Throw darts at π">
      <p className="mb-5 text-ink-soft">
        A quarter circle in a unit square covers π/4 of it. Throw uniform darts, count the hits, multiply by four. Ten
        independent runs race in a Web Worker; the band is ±1.96 standard errors from your <code className="font-mono text-ink">mcEstimate()</code>,
        and the chart zooms in as it tightens.
      </p>
      <Sheet className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Pills
            label="Estimator"
            value={estimator}
            options={["darts", "curve"] as const}
            onChange={(e) => {
              setEstimator(e);
              if (running) start(e);
            }}
            render={(e) => (e === "darts" ? "Hit or miss" : "Average 4/(1+x²)")}
          />
          {running ? (
            <Action onClick={stop}>
              <Square className="size-4" /> Stop
            </Action>
          ) : (
            <Action primary onClick={() => start()}>
              <Play className="size-4" /> {n ? "Again" : "Throw"}
            </Action>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Board board={board} mode={estimator} />
          <Convergence live={live} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Readout label="Samples" value={n.toLocaleString()} />
          <Readout label="Estimate" value={est === undefined ? "–" : est.toFixed(5)} />
          <Readout label="± 1.96 SE" value={se === undefined || !Number.isFinite(se) ? "–" : (1.96 * se).toFixed(5)} />
          <Readout label={<>Digits of <span className="normal-case">π</span></>} value={est === undefined ? "–" : digits} sub={est === undefined ? undefined : `err ${Math.abs(est - Math.PI).toExponential(1)}`} />
        </div>
        {error && <p className="rounded-xl border border-ink p-3 font-mono text-sm">{error}</p>}
        {missing && (
          <CorePanel
            error={missing}
            ghost={<LineChart ghost series={[]} height={180} />}
          />
        )}
      </Sheet>

      <Sheet className="mt-4 flex flex-col gap-3">
        <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">The 1/√n law, log-log</p>
        {cps.length > 4 ? (
          <LineChart
            height={200}
            logY
            series={[
              { label: "standard error", data: cps.filter((c) => Number.isFinite(c.se) && c.se > 0).map((c) => [Math.log10(c.n), c.se] as [number, number]) },
              {
                label: "slope −½",
                stroke: "dotted",
                data: cps.filter((c) => Number.isFinite(c.se)).map((c) => [Math.log10(c.n), cps[2].se * Math.sqrt(cps[2].n / c.n)] as [number, number]),
              },
            ]}
            xLabel="log₁₀ n"
          />
        ) : (
          <LineChart ghost series={[]} height={200} />
        )}
      </Sheet>
    </Section>
  );
}

function Board({ board, mode }: { board: React.RefObject<{ off: OffscreenCanvas; mode: Estimator } | null>; mode: Estimator }) {
  const ref = useCanvas(
    ({ ctx, width, height }) => {
      ctx.fillStyle = grey(0);
      ctx.fillRect(0, 0, width, height);
      const b = board.current;
      if (b) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(b.off, 0, 0, width, height);
      }
      ctx.strokeStyle = grey(1);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (mode === "darts") ctx.arc(0, height, width, -Math.PI / 2, 0);
      else for (let i = 0; i <= 100; i++) { const x = i / 100; const y = 1 / (1 + x * x); if (i) ctx.lineTo(x * width, (1 - y) * height); else ctx.moveTo(0, (1 - y) * height); }
      ctx.stroke();
      ctx.strokeStyle = grey(0.2);
      ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
    },
    { fps: 30 },
    [mode],
  );
  return <canvas ref={ref} aria-label="Darts landing in the unit square" className="block aspect-square w-full rounded-xl border border-rule [image-rendering:pixelated]" />;
}

function Convergence({ live }: { live: React.RefObject<{ cps: Cp[]; seed: number; celebrated: boolean }> }) {
  const zoom = useRef(1.2);
  const ref = useCanvas(
    ({ ctx, width, height }) => {
      ctx.fillStyle = grey(0);
      ctx.fillRect(0, 0, width, height);
      const L = live.current;
      const cps = L.cps;
      const padL = 8, padR = 8, padT = 22, padB = 22;
      const iw = width - padL - padR, ih = height - padT - padB;
      const lx0 = Math.log10(8), lx1 = Math.log10(MAX_N);
      const sx = (n: number) => padL + ((Math.log10(n) - lx0) / (lx1 - lx0)) * iw;
      const last = cps[cps.length - 1];
      const target = last && Number.isFinite(last.se) ? Math.max(0.003, Math.min(1.2, 7 * last.se)) : 1.2;
      zoom.current += (target - zoom.current) * 0.08;
      const half = zoom.current;
      const sy = (v: number) => padT + ih / 2 - ((v - Math.PI) / half) * (ih / 2);

      ctx.save();
      ctx.beginPath();
      ctx.rect(padL, padT, iw, ih);
      ctx.clip();
      // Band.
      if (cps.length > 1) {
        ctx.beginPath();
        cps.forEach((c, i) => { const y = sy(c.means[0] + 1.96 * (Number.isFinite(c.se) ? c.se : 9)); if (i) ctx.lineTo(sx(c.n), y); else ctx.moveTo(sx(c.n), y); });
        for (let i = cps.length - 1; i >= 0; i--) { const c = cps[i]; ctx.lineTo(sx(c.n), sy(c.means[0] - 1.96 * (Number.isFinite(c.se) ? c.se : 9))); }
        ctx.closePath();
        ctx.fillStyle = grey(1, 0.12);
        ctx.fill();
      }
      // Other runs.
      for (let r = RUNS - 1; r >= 0; r--) {
        ctx.beginPath();
        cps.forEach((c, i) => (i ? ctx.lineTo(sx(c.n), sy(c.means[r])) : ctx.moveTo(sx(c.n), sy(c.means[r]))));
        ctx.strokeStyle = r === 0 ? grey(1) : grey(0.3);
        ctx.lineWidth = r === 0 ? 2 : 1;
        ctx.stroke();
      }
      ctx.restore();
      // π line.
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = grey(0.7);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL, sy(Math.PI)); ctx.lineTo(padL + iw, sy(Math.PI)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = grey(0.55);
      ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textBaseline = "top";
      ctx.fillText(`π ± ${half < 0.01 ? half.toExponential(1) : half.toFixed(3)}`, padL, 4);
      ctx.textAlign = "right";
      ctx.fillText(`${RUNS} runs`, width - padR, 4);
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      ctx.fillText("n = 10", padL, height - 6);
      ctx.textAlign = "right";
      ctx.fillText(`${(MAX_N / 1000).toFixed(0)}k`, width - padR, height - 6);
      ctx.textAlign = "left";
    },
    { fps: 30 },
  );
  return <canvas ref={ref} aria-label="Running estimates of π converging, with error band" className="block aspect-square w-full rounded-xl border border-rule" />;
}

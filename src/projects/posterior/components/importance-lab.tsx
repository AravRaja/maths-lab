"use client";

import { useEffect, useState } from "react";
import { Section, Sheet } from "@/kit/components/page-shell";
import { CorePanel } from "@/kit/components/core-guard";
import { useCanvas } from "@/kit/components/use-canvas";
import { useWorker } from "@/kit/components/use-worker";
import { grey } from "@/kit/canvas";
import { reviveError, type NotYoursYet } from "@/kit/not-yours-yet";
import type { handlers } from "../workers/sampling.worker";
import { IS_TARGETS, type IsTargetName } from "../lib/targets";
import { mixtureLogPdf, normalPdf } from "../lib/special";
import { Pills, Readout, SliderField, fmtSmall } from "./controls";

type Result = Awaited<ReturnType<(typeof handlers)["importance"]>>;

const N = 3000;
const TRIALS = 160;
const TRIAL_N = 400;

const sd = (xs: number[]) => {
  const m = xs.reduce((s, v) => s + v, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, xs.length - 1));
};

export function ImportanceLab() {
  const worker = useWorker<typeof handlers>(() => new Worker(new URL("../workers/sampling.worker.ts", import.meta.url)));
  const [target, setTarget] = useState<IsTargetName>("tail");
  const [muQ, setMuQ] = useState<number>(IS_TARGETS.tail.q0.mu);
  const [sdQ, setSdQ] = useState<number>(IS_TARGETS.tail.q0.sd);
  const [res, setRes] = useState<Result | null>(null);
  const T = IS_TARGETS[target];

  useEffect(() => {
    const id = setTimeout(() => {
      const w = worker.current;
      if (!w) return;
      w.call("importance", { target, muQ, sdQ, n: N, trials: TRIALS, trialN: TRIAL_N, seed: 77 })
        .then(setRes)
        .catch(() => {});
    }, 60);
    return () => clearTimeout(id);
  }, [worker, target, muQ, sdQ]);

  const r = res;
  const missing = r?.missing ? (reviveError(r.missing) as NotYoursYet) : null;
  const naiveSd = r ? sd(r.naive) : null;
  const isSd = r?.trials ? sd(r.trials) : null;

  return (
    <Section id="importance" index={4} kicker="Importance sampling · ESS" title="Sample the wrong thing, on purpose">
      <p className="mb-5 text-ink-soft">
        Draw from a proposal q you can sample (dashed), then weight every sample by p/q so the pile averages like the target p
        (solid). Each tick is a sample; its height is its weight. Slide q around and watch the comb: when a few ticks carry
        everything, the effective sample size collapses.
      </p>
      <Sheet className="flex flex-col gap-4">
        <Pills
          label="Target"
          value={target}
          options={Object.keys(IS_TARGETS) as IsTargetName[]}
          onChange={(t) => {
            setTarget(t);
            setMuQ(IS_TARGETS[t].q0.mu);
            setSdQ(IS_TARGETS[t].q0.sd);
          }}
          render={(t) => IS_TARGETS[t].label}
        />
        <p className="text-sm text-ink-soft">{T.blurb}</p>
        <Comb target={target} muQ={muQ} sdQ={sdQ} r={r} />
        <div className="grid gap-3 sm:grid-cols-2">
          <SliderField label="Proposal mean μq" value={muQ} min={-4} max={6} step={0.05} onChange={setMuQ} />
          <SliderField label="Proposal sd σq" value={sdQ} min={0.2} max={3} step={0.02} onChange={setSdQ} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Readout label="ESS" value={r?.ess == null ? "–" : Math.round(r.ess).toLocaleString()} sub={r?.ess == null ? undefined : `${((100 * r.ess) / N).toFixed(1)}% of ${N}`} />
          <Readout label="IS estimate" value={fmtSmall(r?.est)} sub={T.normalised ? "ordinary: mean of w·f" : "self-normalised: Σ w̃ f"} />
          <Readout label="Truth" value={fmtSmall(T.truth)} />
          <Readout
            label="Spread cut"
            value={naiveSd && isSd ? `×${(naiveSd / isSd).toFixed(naiveSd / isSd >= 10 ? 0 : 1)}` : "–"}
            sub={naiveSd && isSd ? "plain sd ÷ IS sd" : undefined}
          />
        </div>
        {missing && <CorePanel error={missing} ghost={<div className="h-40" />} />}
      </Sheet>

      <Sheet className="mt-4 flex flex-col gap-3">
        <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">
          {TRIALS} repeats of {TRIAL_N} samples each
        </p>
        <Strip naive={r?.naive ?? null} trials={r?.trials ?? null} truth={T.truth} />
        <p className="text-sm text-ink-soft">
          Top row: plain Monte Carlo straight from p. Bottom row: importance sampling from your q. The dashed line is the truth;
          the tighter the row, the better the estimator.
        </p>
      </Sheet>
    </Section>
  );
}

function Comb({ target, muQ, sdQ, r }: { target: IsTargetName; muQ: number; sdQ: number; r: Result | null }) {
  const ref = useCanvas(
    ({ ctx, width, height }) => {
      const T = IS_TARGETS[target];
      const [lo, hi] = T.range;
      ctx.fillStyle = grey(0);
      ctx.fillRect(0, 0, width, height);
      const padB = 22, padT = 10;
      const ih = height - padB - padT;
      const sx = (x: number) => ((x - lo) / (hi - lo)) * width;
      const base = padT + ih;
      const p = (x: number) => Math.exp(mixtureLogPdf(x, T.p));
      const q = (x: number) => normalPdf(x, muQ, sdQ * sdQ);
      let top = 0;
      for (let i = 0; i <= 300; i++) { const x = lo + ((hi - lo) * i) / 300; top = Math.max(top, p(x), q(x)); }
      const sy = (v: number) => base - (v / top) * ih * 0.62;

      // Region f cares about (tail).
      if (T.threshold !== null) {
        ctx.fillStyle = grey(1, 0.05);
        ctx.fillRect(sx(T.threshold), padT, width - sx(T.threshold), ih);
        ctx.strokeStyle = grey(0.4);
        ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(sx(T.threshold), padT); ctx.lineTo(sx(T.threshold), base); ctx.stroke();
        ctx.setLineDash([]);
      }

      // Weight comb.
      if (r) {
        // Height is the weight relative to an even share (1/n): equal weights make a low, even fringe,
        // a degenerate pile makes a few full-height spikes.
        const show = Math.min(r.xs.length, 900);
        const n = r.xs.length;
        for (let i = 0; i < show; i++) {
          const x = r.xs[i];
          if (x < lo || x > hi) continue;
          const rel = r.w ? Math.min(1, (r.w[i] * n) / 6) : 0;
          const hgt = r.w ? Math.max(1, rel * ih * 0.95) : 6;
          ctx.fillStyle = r.w ? grey(0.35 + 0.65 * Math.sqrt(rel), 0.8) : grey(0.4);
          ctx.fillRect(sx(x), base - hgt, 1, hgt);
        }
      }

      const curve = (f: (x: number) => number) => {
        ctx.beginPath();
        for (let i = 0; i <= 300; i++) { const x = lo + ((hi - lo) * i) / 300; if (i) ctx.lineTo(sx(x), sy(f(x))); else ctx.moveTo(sx(x), sy(f(x))); }
      };
      curve(p);
      ctx.strokeStyle = grey(1);
      ctx.lineWidth = 2;
      ctx.stroke();
      curve(q);
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = grey(0.75);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = grey(0.2);
      ctx.beginPath(); ctx.moveTo(0, base + 0.5); ctx.lineTo(width, base + 0.5); ctx.stroke();
      ctx.fillStyle = grey(0.55);
      ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
      for (let v = Math.ceil(lo); v <= hi; v++) {
        if ((v - Math.ceil(lo)) % 2) continue;
        const x = sx(v);
        // Edge labels align inward so the minus sign isn't clipped by the canvas.
        ctx.textAlign = x < 14 ? "left" : x > width - 14 ? "right" : "center";
        ctx.fillText(String(v), Math.min(width - 2, Math.max(2, x)), height - 6);
      }
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(r && !r.w ? "weights need importanceWeights()" : "p solid · q dashed · ticks = weights", 6, 4);
      ctx.textBaseline = "alphabetic";
    },
    { animate: false },
    [target, muQ, sdQ, r],
  );
  return <canvas ref={ref} aria-label="Target and proposal densities with weighted samples" className="block h-60 w-full rounded-xl border border-rule sm:h-72" />;
}

function Strip({ naive, trials, truth }: { naive: number[] | null; trials: number[] | null; truth: number }) {
  const ref = useCanvas(
    ({ ctx, width, height }) => {
      ctx.fillStyle = grey(0);
      ctx.fillRect(0, 0, width, height);
      const all = [...(naive ?? []), ...(trials ?? []), truth];
      let lo = Math.min(...all), hi = Math.max(...all);
      const pad = (hi - lo) * 0.08 || Math.abs(truth) * 0.5 || 1;
      lo -= pad; hi += pad;
      const sx = (v: number) => 12 + ((v - lo) / (hi - lo)) * (width - 24);
      const rows: [string, number[] | null][] = [["plain", naive], ["IS", trials]];
      rows.forEach(([label, xs], k) => {
        const cy = height * (k === 0 ? 0.3 : 0.72);
        ctx.fillStyle = grey(0.5);
        ctx.font = "600 10px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.fillText(label.toUpperCase(), 12, cy - 18);
        if (!xs) {
          ctx.fillText(k === 1 ? "waiting on importanceWeights()" : "", 60, cy - 18);
          return;
        }
        xs.forEach((v, i) => {
          const j = (((i * 2654435761) >>> 0) / 4294967296 - 0.5) * 16;
          ctx.fillStyle = grey(k === 0 ? 0.55 : 1, 0.75);
          ctx.beginPath();
          ctx.arc(sx(v), cy + j, 2, 0, Math.PI * 2);
          ctx.fill();
        });
      });
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = grey(0.85);
      ctx.beginPath(); ctx.moveTo(sx(truth), 6); ctx.lineTo(sx(truth), height - 6); ctx.stroke();
      ctx.setLineDash([]);
    },
    { animate: false },
    [naive, trials, truth],
  );
  return <canvas ref={ref} aria-label="Spread of repeated estimates, plain versus importance sampling" className="block h-36 w-full rounded-xl border border-rule" />;
}

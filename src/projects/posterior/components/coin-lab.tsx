"use client";

import { useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCcw, Shuffle } from "lucide-react";
import { Section, Sheet } from "@/kit/components/page-shell";
import { CoreError, CorePanel, runCore } from "@/kit/components/core-guard";
import { LineChart } from "@/kit/components/charts";
import { HoldToConfirmButton } from "@/components/spectrumui/hold-to-confirm";
import { useToast } from "@/kit/components/toast";
import { betaMoments, betaUpdate, logEvidence } from "../core/beta";
import type { BetaParams } from "../core/types";
import { mulberry32 } from "../lib/rng";
import { BetaChart } from "./beta-chart";
import { Action, Pills, Readout, fmt } from "./controls";
import { cn } from "@/lib/utils";

const PRIORS = { flat: { a: 1, b: 1 }, jeffreys: { a: 0.5, b: 0.5 }, sceptic: { a: 20, b: 20 } } as const;
type PriorName = keyof typeof PRIORS;
const PRIOR_LABEL: Record<PriorName, string> = { flat: "Flat 1,1", jeffreys: "Jeffreys ½,½", sceptic: "Sceptic 20,20" };

/** Half the coins are fair, half are rigged with a random bias. Deterministic per coin number. */
function makeCoin(k: number) {
  const r = mulberry32(9001 + k * 31);
  const rigged = r() < 0.5 || k === 0;
  return { rigged, theta: rigged ? (r() < 0.5 ? 0.2 + 0.22 * r() : 0.58 + 0.22 * r()) : 0.5 };
}

/** Log-spaced prefix lengths for the "uncertainty vs n" chart. */
function prefixes(n: number) {
  const out: number[] = [];
  for (let v = 1; v <= n; v = Math.max(v + 1, Math.round(v * 1.15))) out.push(v);
  if (out[out.length - 1] !== n && n > 0) out.push(n);
  return out;
}

function verdict(log10bf: number) {
  const a = Math.abs(log10bf);
  const side = log10bf > 0 ? "rigged" : "fair";
  if (a < 0.5) return "Can't tell yet";
  if (a < 1) return `Leaning ${side}`;
  if (a < 2) return `Strong: ${side}`;
  return `Decisive: ${side}`;
}

export function CoinLab() {
  const toast = useToast();
  const [coin, setCoin] = useState(0);
  const [flips, setFlips] = useState<number[]>([]);
  const [priorName, setPriorName] = useState<PriorName>("flat");
  const [auto, setAuto] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const truth = useMemo(() => makeCoin(coin), [coin]);
  const prior = PRIORS[priorName];

  const flip = (k: number) => {
    // Event-time randomness is fine; render stays pure.
    setFlips((f) => [...f, ...Array.from({ length: k }, () => (Math.random() < truth.theta ? 1 : 0))].slice(-5000));
  };

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => {
      setFlips((f) => (f.length >= 5000 ? f : [...f, Math.random() < truth.theta ? 1 : 0]));
    }, 120);
    return () => clearInterval(id);
  }, [auto, truth.theta]);

  const h = useMemo(() => flips.reduce((s, f) => s + f, 0), [flips]);
  const n = flips.length;
  const t = n - h;

  const post = useMemo(() => runCore(() => betaUpdate(prior, h, t)), [prior, h, t]);
  const mom = useMemo(() => runCore(() => betaMoments(post.status === "ok" ? post.value : prior)), [post, prior]);
  const ev = useMemo(() => runCore(() => logEvidence(prior, h, t)), [prior, h, t]);

  // Earlier posteriors for the trail: every ~n/6 flips.
  const trail = useMemo(() => {
    if (post.status !== "ok" || n < 6) return [] as BetaParams[];
    const out: BetaParams[] = [];
    let hh = 0;
    const step = Math.max(1, Math.floor(n / 6));
    for (let i = 0; i < n; i++) {
      hh += flips[i];
      if ((i + 1) % step === 0 && i + 1 < n) {
        const r = runCore(() => betaUpdate(prior, hh, i + 1 - hh));
        if (r.status === "ok") out.push(r.value);
      }
    }
    return out.slice(-5);
  }, [flips, n, prior, post.status]);

  // Posterior sd after each prefix, through both cores.
  const sdCurve = useMemo(
    () =>
      runCore(() => {
        // Probe both cores first so an empty flip history still shows which one is missing.
        betaMoments(betaUpdate(prior, 0, 0));
        let hh = 0, i = 0;
        const out: [number, number][] = [];
        for (const k of prefixes(n)) {
          for (; i < k; i++) hh += flips[i];
          out.push([k, Math.sqrt(betaMoments(betaUpdate(prior, hh, k - hh)).variance)]);
        }
        return out;
      }),
    [flips, n, prior],
  );

  const log10bf = ev.status === "ok" ? (ev.value - n * Math.log(0.5)) / Math.LN10 : null;

  const newCoin = () => {
    setCoin((c) => c + 1);
    setFlips([]);
    setRevealed(false);
  };

  const reveal = () => {
    setRevealed(true);
    const guess = log10bf === null ? null : log10bf > 0;
    toast({
      title: truth.rigged ? `Rigged: θ = ${truth.theta.toFixed(2)}` : "Fair: θ = 0.50",
      description:
        guess === null
          ? "Write logEvidence() to get a verdict next time."
          : guess === truth.rigged
            ? `The evidence called it after ${n} flips.`
            : `The evidence was fooled after ${n} flips. Flip more?`,
      status: guess === null ? "neutral" : guess === truth.rigged ? "success" : "error",
    });
  };

  const sd = mom.status === "ok" ? Math.sqrt(mom.value.variance) : null;

  return (
    <Section id="coin" index={1} kicker="Bayes · Beta-Binomial" title="Is this coin rigged?">
      <p className="mb-5 text-ink-soft">
        Half the coins in this drawer are fair; the rest lean one way. Flip, and watch the belief about θ (the chance of heads)
        sharpen. Then let the evidence decide: fair coin or rigged one?
      </p>
      <Sheet className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Coin #{coin + 1}</p>
          <Pills label="Prior" value={priorName} options={Object.keys(PRIORS) as PriorName[]} onChange={setPriorName} render={(p) => PRIOR_LABEL[p]} />
        </div>

        {post.status === "missing" ? (
          <CorePanel error={post.missing} ghost={<BetaChart prior={prior} post={{ a: 9, b: 5 }} ghost />} />
        ) : post.status === "error" ? (
          <CoreError error={post.error} />
        ) : (
          <div className="overflow-hidden rounded-xl border border-rule bg-paper">
            <BetaChart prior={prior} post={post.value} mean={mom.status === "ok" ? mom.value.mean : null} sd={sd} truth={revealed ? truth.theta : null} trail={trail} />
          </div>
        )}

        <FlipStrip flips={flips} />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Action primary onClick={() => flip(1)}>Flip</Action>
          <Action onClick={() => flip(10)}>×10</Action>
          <Action onClick={() => flip(100)}>×100</Action>
          <Action onClick={() => setAuto((a) => !a)} label={auto ? "Stop auto-flipping" : "Auto-flip"}>
            {auto ? <Pause className="size-4" /> : <Play className="size-4" />} Auto
          </Action>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Readout label="Flips" value={n} sub={`${h}H ${t}T`} />
          <Readout label="Posterior" value={post.status === "ok" ? `β(${+post.value.a.toFixed(1)},${+post.value.b.toFixed(1)})` : "–"} />
          <Readout label={<>E[<span className="normal-case">θ</span>]</>} value={mom.status === "ok" ? fmt(mom.value.mean, 3) : "–"} sub={mom.status === "missing" ? "betaMoments()" : undefined} />
          <Readout label={<>sd[<span className="normal-case">θ</span>]</>} value={fmt(sd, 3)} sub={mom.status === "missing" ? "betaMoments()" : undefined} />
        </div>
        {mom.status === "missing" && post.status === "ok" && <CorePanel error={mom.missing} />}
      </Sheet>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Sheet className="flex flex-col gap-3">
          <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">The verdict · Bayes factor</p>
          {ev.status === "missing" ? (
            <CorePanel error={ev.missing} ghost={<BfMeter log10bf={0.8} ghost />} />
          ) : ev.status === "error" ? (
            <CoreError error={ev.error} />
          ) : (
            <>
              <p className="type-wide text-2xl leading-tight uppercase">{verdict(log10bf ?? 0)}</p>
              <BfMeter log10bf={log10bf ?? 0} />
              <p className="text-sm text-ink-soft">
                log₁₀ BF = <span className="font-mono text-ink">{fmt(log10bf, 2)}</span>: how much likelier the flips are if θ is unknown
                (with your prior) than if the coin is exactly fair.
              </p>
            </>
          )}
          <div className="mt-auto flex flex-col gap-2">
            <HoldToConfirmButton
              size="lg"
              label="Hold to reveal the coin"
              confirmedLabel="Revealed"
              icon={<span aria-hidden className="font-mono text-sm">θ</span>}
              onConfirm={reveal}
              disabled={revealed}
              className="w-full justify-center"
            />
            <div className="grid grid-cols-2 gap-2">
              <Action onClick={newCoin}>
                <Shuffle className="size-4" /> New coin
              </Action>
              <Action onClick={() => setFlips([])}>
                <RotateCcw className="size-4" /> Reset
              </Action>
            </div>
          </div>
        </Sheet>

        <Sheet className="flex flex-col gap-3">
          <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">How fast doubt shrinks</p>
          {sdCurve.status === "missing" ? (
            <CorePanel error={sdCurve.missing} ghost={<LineChart ghost series={[]} height={200} />} />
          ) : sdCurve.status === "error" ? (
            <CoreError error={sdCurve.error} />
          ) : sdCurve.value.length < 3 ? (
            <div className="flex h-[200px] items-center justify-center rounded-xl border border-dashed border-rule text-sm text-ink-soft">Flip a few more times.</div>
          ) : (
            <LineChart
              height={200}
              logY
              series={[
                { label: "posterior sd", data: sdCurve.value },
                { label: "0.5/√n", data: sdCurve.value.map(([k]) => [k, 0.5 / Math.sqrt(k)] as [number, number]), stroke: "dotted" },
              ]}
              xLabel="flips"
            />
          )}
        </Sheet>
      </div>
    </Section>
  );
}

function FlipStrip({ flips }: { flips: number[] }) {
  const last = flips.slice(-64);
  return (
    <div aria-label="Most recent flips: filled is heads, outlined is tails" className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1">
      {Array.from({ length: 64 }, (_, i) => {
        const f = last[i];
        return (
          <span
            key={i}
            className={cn(
              "aspect-square rounded-[3px] transition-colors",
              f === undefined ? "border border-dashed border-rule" : f === 1 ? "bg-ink" : "border border-ink-soft",
            )}
          />
        );
      })}
    </div>
  );
}

/** −3..3 log10 Bayes factor meter: fair on the left, rigged on the right. */
function BfMeter({ log10bf, ghost }: { log10bf: number; ghost?: boolean }) {
  const pos = Math.max(0, Math.min(1, (log10bf + 3) / 6));
  return (
    <div className={cn("flex flex-col gap-1", ghost && "opacity-60")}>
      <div className="relative h-8 rounded-lg border border-rule bg-[repeating-linear-gradient(90deg,var(--rule)_0_1px,transparent_1px_16.66%)]">
        <div className="absolute inset-y-0 left-1/2 w-px bg-ink-soft" />
        <div
          className="absolute inset-y-1 w-1.5 -translate-x-1/2 rounded-full bg-ink transition-[left] duration-300"
          style={{ left: `${pos * 100}%` }}
        />
      </div>
      <div className="type-narrow flex justify-between text-[11px] tracking-[0.2em] text-ink-soft uppercase">
        <span>Fair</span>
        <span>Rigged</span>
      </div>
    </div>
  );
}

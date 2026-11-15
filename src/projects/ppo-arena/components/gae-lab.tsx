"use client";

import { useMemo, useState } from "react";
import { CoreError, CorePanel, useCore } from "@/kit/components/core-guard";
import { LineChart } from "@/kit/components/charts";
import { Sheet } from "@/kit/components/page-shell";
import { Ghost } from "@/kit/components/yours-to-write";
import { Slider } from "@/components/ui/slider";
import { discountedReturns } from "../core/returns";
import { gae } from "../core/gae";
import { pilotRollout } from "../lib/pilot";
import { gaussian, mulberry32 } from "../lib/rng";
import { Knob, num, Readout } from "./choice";
import { RolloutStrip } from "./rollout-strip";

const std = (xs: number[]) => {
  const m = xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length || 1));
};

/**
 * M2: GAE on the same kind of rollout, with a deliberately imperfect critic
 * V̂ = (1 − bias)·G + noise, where G comes from the user's discountedReturns(). Tap a step to see
 * its credit kernel (γλ)^l light up the future it borrows from.
 */
export function GaeLab() {
  const [gamma, setGamma] = useState(0.97);
  const [lambda, setLambda] = useState(0.95);
  const [err, setErr] = useState(0.15);
  const [cursor, setCursor] = useState(30);
  const ro = useMemo(() => pilotRollout(200, 11), []);
  const noise = useMemo(() => {
    const rng = mulberry32(5);
    return ro.rewards.map(() => gaussian(rng));
  }, [ro]);

  const r = useCore(() => {
    const tailV = 1 / (1 - gamma);
    const G = discountedReturns(ro.rewards, ro.dones, gamma, tailV);
    const V = G.map((g, i) => (1 - 0.4 * err) * g + err * 3 * noise[i]);
    const last = (1 - 0.4 * err) * tailV;
    return {
      V,
      a0: gae(ro.rewards, V, ro.dones, gamma, 0, last),
      a: gae(ro.rewards, V, ro.dones, gamma, lambda, last),
      a1: gae(ro.rewards, V, ro.dones, gamma, 1, last),
    };
  }, [ro, gamma, lambda, err, noise]);

  const kernel = useMemo(() => {
    const out = new Array<number>(ro.rewards.length).fill(0);
    let w = 1;
    for (let k = cursor; k < out.length; k++) {
      out[k] = w;
      if (ro.dones[k]) break;
      w *= gamma * lambda;
    }
    return out;
  }, [ro, cursor, gamma, lambda]);

  if (r.status === "missing")
    return <CorePanel error={r.missing} ghost={<div className="flex flex-col gap-3 p-4"><Ghost label="credit kernel" className="h-16" /><LineChart ghost series={[]} height={200} /></div>} />;
  if (r.status === "error") return <CoreError error={r.error} />;

  const { a0, a, a1 } = r.value;
  const t = Math.min(cursor, a.length - 1);
  const credit = 1 / (1 - gamma * lambda);
  return (
    <div className="flex flex-col gap-4">
      <RolloutStrip
        values={a}
        overlay={kernel}
        starts={ro.starts}
        cursor={t}
        onCursor={setCursor}
        label="Advantages along the rollout, with the credit kernel of the selected step. Drag to pick a step."
      />
      <p className="type-narrow -mt-2 text-xs text-ink-soft">Top: (γλ)^l from the step you picked. Bottom: Â_t.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Readout label="δ_t  (λ = 0)" value={a0[t].toFixed(2)} />
        <Readout label="Â_t" value={a[t].toFixed(2)} />
        <Readout label="Credit 1/(1−γλ)" value={credit.toFixed(credit > 99 ? 0 : 1)} />
        <Readout label="Spread of Â" value={std(a).toFixed(2)} />
      </div>
      <Sheet>
        <LineChart
          height={220}
          xLabel="step t"
          yLabel="Â_t"
          series={[
            { label: `λ = ${lambda.toFixed(2)}`, data: a, stroke: "solid" },
            { label: "λ = 0 (δ_t)", data: a0, stroke: "dotted" },
            { label: "λ = 1 (G − V̂)", data: a1, stroke: "dashed" },
          ]}
        />
      </Sheet>
      <Sheet className="flex flex-col gap-5">
        <Knob label="λ" value={lambda.toFixed(2)}>
          <Slider min={0} max={1} step={0.01} value={lambda} aria-label="GAE lambda" onValueChange={(v) => setLambda(num(v))} />
        </Knob>
        <Knob label="Discount γ" value={gamma.toFixed(3)}>
          <Slider min={0.8} max={0.995} step={0.005} value={gamma} aria-label="Discount gamma" onValueChange={(v) => setGamma(num(v))} />
        </Knob>
        <Knob label="Critic error" value={err.toFixed(2)}>
          <Slider min={0} max={1} step={0.01} value={err} aria-label="How wrong the critic is" onValueChange={(v) => setErr(num(v))} />
        </Knob>
        <p className="text-xs text-ink-soft">
          The critic here is the true return shrunk by a bias and jittered by noise, both scaled by this slider. At 0 it is
          perfect for this rollout.
        </p>
      </Sheet>
    </div>
  );
}

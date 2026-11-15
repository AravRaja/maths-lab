"use client";

import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { CoreError, CorePanel, useCore } from "@/kit/components/core-guard";
import { LineChart } from "@/kit/components/charts";
import { Sheet } from "@/kit/components/page-shell";
import { Ghost } from "@/kit/components/yours-to-write";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { AnimatedSwitch } from "@/components/spectrumui/animated-switch";
import { discountedReturns } from "../core/returns";
import { brightness } from "../lib/env";
import { pilotRollout } from "../lib/pilot";
import { Choice, Knob, num, Readout } from "./choice";
import { RolloutStrip } from "./rollout-strip";
import { StillScene } from "./still-scene";

type RewardMode = "step" | "light";

/**
 * M1: a shaky controller's rollout (several episodes back to back, the last one cut off),
 * turned into return-to-go by the user's discountedReturns(). The ribbon is G_t; scrub it.
 */
export function ReturnsLab() {
  const [seed, setSeed] = useState(3);
  const [gamma, setGamma] = useState(0.97);
  const [mode, setMode] = useState<RewardMode>("step");
  const [boot, setBoot] = useState(false);
  const [cursor, setCursor] = useState(0);
  const ro = useMemo(() => pilotRollout(240, seed), [seed]);
  const rewards = useMemo(() => (mode === "step" ? ro.rewards : ro.states.map((s) => Number(brightness(s).toFixed(3)))), [ro, mode]);
  const lastValue = boot ? (mode === "step" ? 1 : 0.6) / (1 - gamma) : 0;
  const r = useCore(() => discountedReturns(rewards, ro.dones, gamma, lastValue), [rewards, ro, gamma, lastValue]);

  if (r.status === "missing")
    return <CorePanel error={r.missing} ghost={<div className="flex flex-col gap-3 p-4"><Ghost label="return ribbon" className="h-16" /><LineChart ghost series={[]} height={180} /></div>} />;
  if (r.status === "error") return <CoreError error={r.error} />;

  const G = r.value;
  const t = Math.min(cursor, G.length - 1);
  const ep = ro.starts.filter((s) => s <= t).length;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
        <StillScene state={ro.states[t]} caption={`EPISODE ${ep} · STEP ${t}`} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
          <Readout label="r_t" value={rewards[t].toFixed(2)} />
          <Readout label="G_t" value={G[t].toFixed(2)} />
          <Readout label="Horizon 1/(1−γ)" value={(1 / (1 - gamma)).toFixed(gamma > 0.99 ? 0 : 1)} />
          <Readout label="Episode ends" value={ro.dones[t] ? "here" : "later"} />
        </div>
      </div>
      <RolloutStrip values={G} starts={ro.starts} cursor={t} onCursor={setCursor} label="Return-to-go along the rollout. Drag to scrub." />
      <p className="type-narrow -mt-2 text-xs text-ink-soft">Brightness = G_t. Black gaps = episode ends.</p>
      <Sheet>
        <LineChart
          height={200}
          xLabel="step t"
          series={[
            { label: "G_t", data: G, stroke: "solid" },
            { label: "r_t", data: rewards, stroke: "dotted" },
          ]}
        />
      </Sheet>
      <Sheet className="flex flex-col gap-5">
        <Knob label="Discount γ" value={gamma.toFixed(3)}>
          <Slider min={0} max={0.995} step={0.005} value={gamma} aria-label="Discount gamma" onValueChange={(v) => setGamma(num(v))} />
        </Knob>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Choice
            label="Reward"
            value={mode}
            onChange={setMode}
            options={[
              { value: "step", label: "+1 a step" },
              { value: "light", label: "Flame brightness" },
            ]}
          />
          <Button variant="outline" className="min-h-11" onClick={() => { setSeed((s) => s + 1); setCursor(0); }}>
            <RefreshCw className="size-4" aria-hidden /> New rollout
          </Button>
        </div>
        <label className="flex min-h-11 items-center justify-between gap-4">
          <span>
            <span className="block text-sm">Bootstrap the cut-off episode</span>
            <span className="block text-xs text-ink-soft">The rollout stops mid-episode. Guess the rest with lastValue = r̄/(1−γ) instead of 0.</span>
          </span>
          <AnimatedSwitch checked={boot} onCheckedChange={setBoot} label="Bootstrap with lastValue" />
        </label>
      </Sheet>
    </div>
  );
}

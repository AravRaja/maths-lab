"use client";

import { useMemo, useState } from "react";
import { Heatmap, Histogram, LineChart } from "@/components/kit/charts";
import { Sheet } from "@/components/kit/page-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnimatedSwitch } from "@/components/spectrumui/animated-switch";

// Demo data only (scaffolding, not a core): a seeded RNG and Box-Muller normals.
function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => { a ^= a << 13; a >>>= 0; a ^= a >> 17; a ^= a << 5; a >>>= 0; return a / 4294967296; };
}

export function ChartsDemo() {
  const [dither, setDither] = useState(true);
  const [cell, setCell] = useState<{ row: number; col: number; value: number } | null>(null);
  const data = useMemo(() => {
    const r = rng(7);
    const normals = Array.from({ length: 4000 }, () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()));
    const train = Array.from({ length: 120 }, (_, i) => 2.2 * Math.exp(-i / 22) + 0.15 + 0.05 * (r() - 0.5));
    const val = Array.from({ length: 120 }, (_, i) => 2.3 * Math.exp(-i / 25) + 0.22 + 0.004 * Math.max(0, i - 70) + 0.04 * (r() - 0.5));
    const R = 24, C = 32;
    const heat = Array.from({ length: R * C }, (_, i) => { const y = Math.floor(i / C) / R - 0.5, x = (i % C) / C - 0.5; return Math.exp(-((x - 0.15) ** 2 + (y + 0.1) ** 2) * 12) + 0.6 * Math.exp(-((x + 0.25) ** 2 + (y - 0.2) ** 2) * 20); });
    return { normals, train, val, heat, R, C };
  }, []);

  return (
    <Tabs defaultValue="line">
      <TabsList className="w-full">
        <TabsTrigger value="line">Line</TabsTrigger>
        <TabsTrigger value="hist">Histogram</TabsTrigger>
        <TabsTrigger value="heat">Heatmap</TabsTrigger>
      </TabsList>
      <TabsContent value="line">
        <Sheet className="mt-3">
          <LineChart series={[{ label: "train loss", data: data.train }, { label: "val loss", data: data.val }]} xLabel="epoch" />
        </Sheet>
      </TabsContent>
      <TabsContent value="hist">
        <Sheet className="mt-3">
          <Histogram samples={data.normals} bins={40} range={[-4, 4]} density overlay={(x) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI)} />
          <p className="mt-2 text-xs text-ink-soft">4,000 Box-Muller samples, dashed: N(0, 1) density.</p>
        </Sheet>
      </TabsContent>
      <TabsContent value="heat">
        <Sheet className="mt-3 flex flex-col gap-3">
          <Heatmap values={data.heat} rows={data.R} cols={data.C} dither={dither} aspect={data.R / data.C} onCell={setCell} />
          <div className="flex min-h-11 items-center justify-between gap-3">
            <span className="font-mono text-xs text-ink-soft tabular-nums">
              {cell ? `[${cell.row}, ${cell.col}] = ${cell.value.toFixed(3)}` : "tap a cell"}
            </span>
            <label className="flex items-center gap-3 text-sm">
              Dither
              <AnimatedSwitch checked={dither} onCheckedChange={setDither} label="Dither heatmap" />
            </label>
          </div>
        </Sheet>
      </TabsContent>
      <div className="mt-3">
        <LineChart ghost series={[]} height={140} />
        <p className="mt-1 text-xs text-ink-soft">Every chart takes <code className="font-mono">ghost</code> for a placeholder shape.</p>
      </div>
    </Tabs>
  );
}

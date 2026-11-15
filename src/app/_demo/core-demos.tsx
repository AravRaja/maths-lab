"use client";

import { useState } from "react";
import { CoreStatus } from "@/components/kit/core-status";
import { CorePanel, CoreError, useCore } from "@/components/kit/core-guard";
import { Histogram } from "@/components/kit/charts";
import { useWorker } from "@/components/kit/use-worker";
import { useToast } from "@/components/kit/toast";
import { Sheet } from "@/components/kit/page-shell";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { MorphButton } from "@/components/spectrumui/morph-button";
import { isNotYoursYet, type NotYoursYet } from "@/lib/kit/not-yours-yet";
import { CORES } from "@/core";
import { softmax } from "@/core/softmax";
import type { handlers } from "@/workers/example.worker";

const LOGITS = [1.2, -0.4, 2.6, 0.3, 1.9, -1.1, 0.8];

export function CoreStatusDemo() {
  return <CoreStatus cores={CORES} />;
}

export function YoursToWriteDemo() {
  const [tau, setTau] = useState(1);
  const r = useCore(() => softmax(LOGITS, tau), [tau]);
  return (
    <div className="flex flex-col gap-4">
      <Sheet>
        <div className="mb-1 flex items-baseline justify-between">
          <span className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Temperature τ</span>
          <span className="type-wide text-2xl tabular-nums">{tau.toFixed(2)}</span>
        </div>
        <Slider min={0.05} max={4} step={0.05} value={tau} onValueChange={(v) => setTau(Array.isArray(v) ? v[0] : v)} />
      </Sheet>
      {r.status === "missing" ? (
        <CorePanel error={r.missing} ghost={<div className="p-4"><Histogram ghost bins={LOGITS.length} height={240} /></div>} />
      ) : r.status === "error" ? (
        <CoreError error={r.error} />
      ) : (
        <Sheet>
          <Histogram counts={r.value} range={[0, LOGITS.length]} />
        </Sheet>
      )}
    </div>
  );
}

export function WorkerDemo() {
  const worker = useWorker<typeof handlers>(() => new Worker(new URL("../../workers/example.worker.ts", import.meta.url)));
  const toast = useToast();
  const [progress, setProgress] = useState(0);
  const [counts, setCounts] = useState<number[] | null>(null);
  const [missing, setMissing] = useState<NotYoursYet | null>(null);

  const run = async () => {
    setProgress(0);
    try {
      const out = await worker.current!.call("sample", { logits: LOGITS, temperature: 1, n: 200_000 }, (p) => setProgress(Number(p)));
      setCounts(out);
      setMissing(null);
      setProgress(1);
      toast({ title: "200,000 samples drawn", description: "in a Web Worker", status: "success" });
    } catch (e) {
      if (isNotYoursYet(e)) {
        setMissing(e);
        toast({ title: `${e.fn}() is yours to write`, description: e.file, status: "neutral" });
        return;
      }
      throw e;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Sheet className="flex flex-col gap-4">
        <p className="text-sm text-ink-soft">
          Samples from softmax(logits) inside <code className="font-mono text-ink">src/workers/example.worker.ts</code>. A stub
          error thrown in the worker comes back as <code className="font-mono text-ink">NotYoursYet</code>.
        </p>
        <MorphButton onAction={run} loadingLabel="Sampling" successLabel="Done" size="lg" className="w-full">
          Draw 200k samples
        </MorphButton>
        <Progress value={progress * 100} />
      </Sheet>
      {missing && <CorePanel error={missing} />}
      {counts && !missing && (
        <Sheet>
          <Histogram counts={counts} range={[0, counts.length]} />
        </Sheet>
      )}
    </div>
  );
}

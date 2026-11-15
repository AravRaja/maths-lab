"use client";

import { useState } from "react";
import { CorePanel } from "@/kit/components/core-guard";
import { LineChart } from "@/kit/components/charts";
import { Sheet } from "@/kit/components/page-shell";
import { useToast } from "@/kit/components/toast";
import { useWorker } from "@/kit/components/use-worker";
import { MorphButton } from "@/components/spectrumui/morph-button";
import { Progress } from "@/components/ui/progress";
import { useAvailability } from "@/projects/say-and-reach/lib/arm/availability";
import type { EvalRow } from "@/projects/say-and-reach/lib/arm/evaluate";
import { GAMMA } from "@/projects/say-and-reach/lib/arm/evaluate";
import { usePolicies } from "@/projects/say-and-reach/lib/arm/store";
import { isNotYoursYet, type NotYoursYet } from "@/kit/not-yours-yet";
import type { handlers } from "@/projects/say-and-reach/workers/train.worker";

/*
 * M5: held-out evaluation. Commands here pair words the policies never heard together in
 * training. Success is sparse; the user's shapedRewards and discountedReturn turn each
 * rollout into a dense score, and the telescoping identity is checked live on episode one.
 */

const LABEL = { expert: "Expert", gaussian: "Gaussian", flow: "Flow" } as const;
const EPISODES = 30;

export function ScoreSection() {
  const avail = useAvailability();
  const policies = usePolicies();
  const worker = useWorker<typeof handlers>(() => new Worker(new URL("../workers/train.worker.ts", import.meta.url)));
  const toast = useToast();
  const [rows, setRows] = useState<EvalRow[] | null>(null);
  const [progress, setProgress] = useState(0);
  const [missing, setMissing] = useState<NotYoursYet | null>(null);

  const ghost = (
    <div className="flex flex-col gap-3 p-4">
      <LineChart ghost series={[]} height={160} />
    </div>
  );
  const blocker = avail?.ik ?? avail?.reward ?? missing;
  if (blocker) return <CorePanel error={blocker} ghost={ghost} />;

  const run = async () => {
    setProgress(0);
    try {
      const out = await worker.current!.call(
        "evaluate",
        { gaussian: policies.gaussian, flow: avail?.flow ? undefined : policies.flow, episodes: EPISODES, seed: 2026 },
        (p) => setProgress(Number(p)),
      );
      setRows(out);
      setProgress(1);
      toast({ title: "Scored on held-out commands", description: `${EPISODES} episodes per policy`, status: "success" });
    } catch (e) {
      if (isNotYoursYet(e)) {
        setMissing(e);
        return;
      }
      throw e;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Sheet className="flex flex-col gap-3">
        <p className="text-sm text-ink-soft">
          {EPISODES} fresh scenes, each with a command whose (object word, direction word) pairing never appeared in training. γ = {GAMMA}.
          {!policies.gaussian && !policies.flow && " Only the expert is scored until a head is trained."}
        </p>
        <MorphButton onAction={run} loadingLabel="Scoring" successLabel="Scored" size="lg" className="w-full">
          Run held-out evaluation
        </MorphButton>
        <Progress value={progress * 100} />
      </Sheet>

      {rows && (
        <>
          <div className="overflow-hidden rounded-2xl border border-rule">
            <table className="w-full text-left text-sm">
              <thead className="type-narrow bg-sheet text-[11px] tracking-[0.16em] text-ink-soft uppercase">
                <tr>
                  <th className="px-3 py-2 font-medium">Policy</th>
                  <th className="px-3 py-2 text-right font-medium">Success</th>
                  <th className="px-3 py-2 text-right font-medium">G</th>
                  <th className="px-3 py-2 text-right font-medium">G′ shaped</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {rows.map((r) => (
                  <tr key={r.mode}>
                    <td className="type-semi px-3 py-3">{LABEL[r.mode]}</td>
                    <td className="type-wide px-3 py-3 text-right text-lg tabular-nums">{Math.round(r.successRate * 100)}%</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">{r.ret.toFixed(3)}</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">{r.shaped.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Sheet>
              <p className="type-narrow mb-2 text-xs tracking-[0.2em] text-ink-soft uppercase">Shaped reward, episode 1</p>
              <LineChart series={rows.map((r) => ({ label: LABEL[r.mode], data: r.trace }))} height={170} xLabel="step" />
            </Sheet>
            <Sheet className="flex flex-col gap-2">
              <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Telescoping check, episode 1</p>
              <p className="text-sm text-ink-soft">G′ − G should equal γ^T Φ(s_T) − Φ(s_0), whatever the policy did in between.</p>
              <ul className="flex flex-col divide-y divide-rule">
                {rows.map((r) => (
                  <li key={r.mode} className="flex min-h-11 items-center justify-between gap-2 font-mono text-xs tabular-nums">
                    <span className="type-semi font-sans text-sm">{LABEL[r.mode]}</span>
                    <span>
                      {(r.check.Gs - r.check.G).toFixed(5)} vs {r.check.boundary.toFixed(5)}{" "}
                      {Math.abs(r.check.Gs - r.check.G - r.check.boundary) < 1e-6 ? "✓" : "✗"}
                    </span>
                  </li>
                ))}
              </ul>
            </Sheet>
          </div>
          <Sheet>
            <p className="type-narrow mb-2 text-xs tracking-[0.2em] text-ink-soft uppercase">Held-out commands</p>
            <ul className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
              {rows[0].results.slice(0, 12).map((c, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <span className="truncate">{c.text}</span>
                  <span className="shrink-0 font-mono text-xs text-ink-soft">{rows.map((r) => (r.results[i].success ? "●" : "○")).join(" ")}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-soft">● did it, ○ didn&apos;t; one mark per policy, in table order.</p>
          </Sheet>
        </>
      )}
    </div>
  );
}

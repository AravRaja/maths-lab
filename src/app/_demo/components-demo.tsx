"use client";

import { useState } from "react";
import { Sheet } from "@/components/kit/page-shell";
import { Stat } from "@/components/kit/stat";
import { Ghost } from "@/components/kit/yours-to-write";
import { useToast } from "@/components/kit/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { TextStates } from "@/components/spectrumui/text-states";
import { TiltCard } from "@/components/spectrumui/tilt-card";
import { BeamCard } from "@/components/spectrumui/beam-card";
import { KbdKey } from "@/components/spectrumui/kbd-key";
import { HoldToConfirmButton } from "@/components/spectrumui/hold-to-confirm";
import { SkeletonReveal } from "@/components/spectrumui/skeleton-reveal";
import { OrbitalText } from "@/components/spectrumui/orbital-text";
import { InlineCode } from "@/components/spectrumui/inline-code";
import { ThinkingDots } from "@/components/spectrumui/blocks/ai-assistants/thinking-dots";
import { CodeBlock } from "@/components/spectrumui/blocks/ai-assistants/code-block";
import { ChartEmpty } from "@/components/spectrumui/blocks/empty-states/chart-empty";

const PHASES = ["Rolling out", "Estimating advantages", "Stepping the policy", "Converged"];

export function ComponentsDemo() {
  const toast = useToast();
  const [episodes, setEpisodes] = useState(128);
  const [phase, setPhase] = useState(0);
  const [algo, setAlgo] = useState<string[]>(["reinforce"]);
  const [loading, setLoading] = useState(true);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Episodes" value={episodes} />
        <Stat label="Return" value={episodes / 37} decimals={2} />
      </div>
      <Sheet className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setEpisodes((e) => e + 64)}>+64 episodes</Button>
        <Button variant="outline" onClick={() => setPhase((p) => (p + 1) % PHASES.length)}>Next phase</Button>
        <Button variant="ghost" onClick={() => toast({ title: "Checkpoint saved", status: "success" })}>Toast</Button>
        <span className="type-semi flex min-h-11 items-center gap-3 text-sm">
          <TextStates text={PHASES[phase]} />
          {phase < PHASES.length - 1 && <ThinkingDots label="" />}
        </span>
      </Sheet>

      <Sheet className="flex flex-col gap-4">
        <ToggleGroup value={algo} onValueChange={(v) => v.length && setAlgo(v)} className="w-full">
          {["reinforce", "a2c", "ppo"].map((a) => (
            <ToggleGroupItem key={a} value={a} className="h-11 flex-1 uppercase">{a}</ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>written</Badge>
          <Badge variant="outline">yours to write</Badge>
          <Badge variant="secondary">milestone 2</Badge>
          <Tooltip>
            <TooltipTrigger render={<Badge variant="outline" />}>hover me</TooltipTrigger>
            <TooltipContent>Tooltips are ink on paper, inverted.</TooltipContent>
          </Tooltip>
        </div>
        <Separator />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex min-h-11 items-center gap-3 text-sm"><Switch defaultChecked /> shadcn switch</label>
          <span className="flex items-center gap-2 text-sm text-ink-soft">Press <KbdKey>R</KbdKey> to reset</span>
          <HoldToConfirmButton size="lg" label="Hold to reset" confirmedLabel="Reset" onConfirm={() => setEpisodes(0)} />
        </div>
      </Sheet>

      <div className="grid gap-4 sm:grid-cols-2">
        <TiltCard className="rounded-2xl border border-rule bg-sheet p-5" glareColor="rgba(255,255,255,0.25)">
          <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Tilt card</p>
          <p className="type-wide mt-2 text-3xl leading-none">∇θ J(θ)</p>
          <p className="mt-2 text-sm text-ink-soft">For hero stats and milestone cards.</p>
        </TiltCard>
        <BeamCard eyebrow="Beam card" title="Training live" description="A mono border beam for whatever is running right now." className="bg-sheet" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>shadcn card</CardTitle>
          <CardDescription>Themed with sheet, rule and ink-soft.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <SkeletonReveal
            loading={loading}
            skeleton={<div className="flex flex-col gap-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>}
          >
            <p className="text-sm">Revealed: E[R] = Σ π(a|s) Q(s,a), with <InlineCode>policy.ts</InlineCode> doing the work.</p>
          </SkeletonReveal>
          <Button variant="outline" onClick={() => setLoading((l) => !l)}>{loading ? "Reveal" : "Reset"}</Button>
        </CardContent>
      </Card>

      <div className="flex h-24 items-center justify-center overflow-hidden rounded-2xl border border-rule">
        <OrbitalText text="ORBIT" radius={14} />
      </div>

      <CodeBlock
        filename="src/core/softmax.ts"
        language="ts"
        code={`export function softmax(z: number[], temperature = 1): number[] {\n  throw notYoursYet({ file: FILE, fn: "softmax", milestone: "m1-softmax" });\n}`}
        className="max-w-none"
      />

      <ChartEmpty panelTitle="Episode return" meta="No runs yet" title="Nothing trained yet" description="Spectrum's chart empty state, for before the first run." loadLabel="Show sample" />

      <Ghost label="ghost block" className="h-24" />
    </div>
  );
}

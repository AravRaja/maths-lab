"use client";

import { useRef, useState } from "react";
import { Eye, RotateCcw } from "lucide-react";
import { grey, isNotYoursYet, type NotYoursYet } from "@/kit";
import { CorePanel, CoreError } from "@/kit/components/core-guard";
import { LineChart } from "@/kit/components/charts";
import { Sheet } from "@/kit/components/page-shell";
import { useToast } from "@/kit/components/toast";
import { useWorker } from "@/kit/components/use-worker";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { firstMissing } from "../lib/gate";
import { forgetMind, setMind, useMind } from "../lib/store";
import { SIDE, PIXELS } from "../lib/world";
import type { handlers, VaeFrame } from "../workers/train.worker";
import { paintFrame } from "./draw";
import { Field, Pills, Readout, useLoopCanvas } from "./ui";

/*
 * Section 3: train the eyes. A β-VAE (400 → 128 → 2 → 128 → 400) learns the ball's frames in a
 * Web Worker. Every probabilistic piece of the gradient is one of the user's cores.
 */

const BETAS = [0.25, 1, 4] as const;

export function Cloud({ cloud, pos, shade, className, ghost }: { cloud: Float32Array | null; pos: Float32Array | null; shade: "x" | "y"; className?: string; ghost?: boolean }) {
  const ref = useLoopCanvas((ctx, { width: W, height: H }, t) => {
    ctx.fillStyle = grey(0);
    ctx.fillRect(0, 0, W, H);
    const sc = Math.min(W, H) / 7;
    const X = (v: number) => W / 2 + v * sc;
    const Y = (v: number) => H / 2 - v * sc;
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = grey(0.3);
    for (const k of [1, 2, 3]) { ctx.beginPath(); ctx.arc(W / 2, H / 2, k * sc, 0, Math.PI * 2); ctx.stroke(); }
    ctx.setLineDash([]);
    if (ghost || !cloud || !pos) {
      ctx.fillStyle = grey(0.35);
      for (let i = 0; i < 300; i++) {
        const a = i * 2.399, rr = Math.sqrt(i / 300) * 2.2 * sc;
        ctx.fillRect(W / 2 + rr * Math.cos(a + t * 0.05), H / 2 + rr * Math.sin(a + t * 0.05), 2, 2);
      }
      return;
    }
    const n = cloud.length / 2;
    for (let i = 0; i < n; i++) {
      const v = shade === "x" ? pos[2 * i] : pos[2 * i + 1];
      ctx.fillStyle = grey(0.2 + 0.8 * v);
      ctx.fillRect(X(cloud[2 * i]) - 1.5, Y(cloud[2 * i + 1]) - 1.5, 3, 3);
    }
  }, 12);
  return <canvas ref={ref} className={className} role="img" aria-label="Where each frame lands in the 2-number latent space" />;
}

function Strip({ strip }: { strip: Float32Array | null }) {
  const ref = useLoopCanvas((ctx, { width: W, height: H }) => {
    ctx.fillStyle = grey(0);
    ctx.fillRect(0, 0, W, H);
    const n = 6;
    const gap = 6;
    const s = Math.min((W - gap * (n - 1)) / n, (H - gap) / 2);
    for (let k = 0; k < n; k++) {
      for (let row = 0; row < 2; row++) {
        const x = k * (s + gap);
        const y = row * (s + gap);
        if (strip) paintFrame(ctx, strip.subarray((row * n + k) * PIXELS, (row * n + k + 1) * PIXELS), SIDE, x, y, s, { pixel: 2 });
        else {
          ctx.strokeStyle = grey(0.2);
          ctx.setLineDash([3, 3]);
          ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
          ctx.setLineDash([]);
        }
      }
    }
  }, 10);
  return <canvas ref={ref} className="block aspect-[3/1] w-full" role="img" aria-label="Real frames (top) and the VAE's reconstructions (bottom)" />;
}

export function VaeSection() {
  const toast = useToast();
  const blocked = firstMissing("m1-reparam", "m2-kl", "m3-elbo");
  const mind = useMind();
  const [beta, setBeta] = useState<(typeof BETAS)[number]>(1);
  const [running, setRunning] = useState(false);
  const [frame, setFrame] = useState<VaeFrame | null>(null);
  const [hist, setHist] = useState<{ elbo: [number, number][]; kl: [number, number][] }>({ elbo: [], kl: [] });
  const [strip, setStrip] = useState<Float32Array | null>(null);
  const [cloud, setCloud] = useState<{ c: Float32Array; p: Float32Array } | null>(null);
  const [shade, setShade] = useState<"x" | "y">("x");
  const [missing, setMissing] = useState<NotYoursYet | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const last = useRef<{ c: Float32Array; p: Float32Array } | null>(null);
  const worker = useWorker<typeof handlers>(() => new Worker(new URL("../workers/train.worker.ts", import.meta.url)));

  const train = () => {
    const w = worker.current;
    if (!w) return;
    w.restart();
    setRunning(true);
    setMissing(null);
    setError(null);
    setHist({ elbo: [], kl: [] });
    setMind({ dyn: null }, false);
    w.call("trainVae", { beta }, (v) => {
      const f = v as VaeFrame;
      setFrame(f);
      setHist((h) => ({ elbo: [...h.elbo, [f.step, f.elbo] as [number, number]], kl: [...h.kl, [f.step, f.kl] as [number, number]] }));
      if (f.strip) setStrip(f.strip);
      if (f.cloud && f.cloudPos) {
        last.current = { c: f.cloud, p: f.cloudPos };
        setCloud(last.current);
      }
      if (f.weights) setMind({ vae: f.weights, dyn: null, cloud: f.cloud ?? last.current?.c ?? null, cloudPos: f.cloudPos ?? last.current?.p ?? null, source: "session" }, f.step === f.steps);
    })
      .then((weights) => {
        setRunning(false);
        setMind({ vae: weights, dyn: null, cloud: last.current?.c ?? null, cloudPos: last.current?.p ?? null, source: "session" });
        toast({ title: "It can see", description: "The VAE is trained. Walk its latent space below, then teach it to dream.", status: "success" });
      })
      .catch((e: unknown) => {
        setRunning(false);
        if (isNotYoursYet(e)) setMissing(e);
        else if (!(e instanceof Error && e.message === "Worker terminated")) setError(e instanceof Error ? e : new Error(String(e)));
      });
  };

  const stop = () => {
    worker.current?.restart();
    setRunning(false);
  };

  const gate = blocked ?? missing;
  if (gate)
    return (
      <CorePanel
        error={gate}
        ghost={
          <div className="flex flex-col gap-3 p-4">
            <LineChart ghost series={[]} height={180} />
            <Cloud cloud={null} pos={null} shade="x" ghost className="block aspect-square w-full rounded-xl" />
          </div>
        }
      />
    );

  const showCloud = cloud ?? (mind.cloud && mind.cloudPos ? { c: mind.cloud, p: mind.cloudPos } : null);

  return (
    <div className="flex flex-col gap-4">
      <Sheet className="flex flex-col gap-4">
        <Field label="β · weight on the KL" value={`β = ${beta}`}>
          <Pills label="beta" value={beta} options={BETAS} onChange={setBeta} disabled={running} />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          {running ? (
            <Button variant="outline" className="rounded-xl" onClick={stop}>Stop</Button>
          ) : (
            <Button className="rounded-xl" onClick={train}>
              <Eye className="size-4" /> {mind.vae ? "Retrain the eyes" : "Train the eyes"}
            </Button>
          )}
          {mind.vae && !running && (
            <Button
              variant="ghost"
              className="rounded-xl text-ink-soft"
              onClick={() => {
                forgetMind();
                setFrame(null);
                setStrip(null);
                setCloud(null);
                setHist({ elbo: [], kl: [] });
              }}
            >
              <RotateCcw className="size-4" /> Forget
            </Button>
          )}
          {mind.source === "restored" && !frame && <span className="text-xs text-ink-soft">Restored from this browser.</span>}
        </div>
        {frame && <Progress value={(100 * frame.step) / frame.steps} aria-label="training progress" />}
        <div className="grid grid-cols-3 gap-2">
          <Readout k="step" v={frame ? frame.step : "-"} />
          <Readout k="ELBO" v={frame ? frame.elbo.toFixed(1) : "-"} />
          <Readout k="KL · nats" v={frame ? frame.kl.toFixed(2) : "-"} />
        </div>
      </Sheet>
      {error && <CoreError error={error} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Sheet>
          <p className="type-narrow mb-2 text-xs tracking-[0.2em] text-ink-soft uppercase">ELBO per frame (nats)</p>
          {hist.elbo.length > 3 ? (
            <LineChart series={[{ label: "ELBO", data: hist.elbo.slice(2) }, { label: "KL", data: hist.kl.slice(2), stroke: "dashed" }]} height={200} xLabel="step" />
          ) : (
            <LineChart ghost series={[]} height={200} />
          )}
        </Sheet>
        <Sheet>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Latent cloud</p>
            <Pills label="shade by" value={shade} options={["x", "y"] as const} onChange={setShade} render={(v) => `shade ${v}`} />
          </div>
          <Cloud cloud={showCloud?.c ?? null} pos={showCloud?.p ?? null} shade={shade} className="block aspect-square w-full rounded-xl" />
          <p className="mt-2 text-xs text-ink-soft">Each dot is a frame, placed at its μ. Grey is the ball&apos;s true {shade}: the encoder was never told it.</p>
        </Sheet>
      </div>
      <Sheet>
        <p className="type-narrow mb-2 text-xs tracking-[0.2em] text-ink-soft uppercase">Real (top) · reconstructed from 2 numbers (bottom)</p>
        <Strip strip={strip} />
      </Sheet>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUp, EyeOff, Lock, Moon, Zap } from "lucide-react";
import { grey, isNotYoursYet, type NotYoursYet } from "@/kit";
import { CorePanel, CoreError } from "@/kit/components/core-guard";
import { LineChart } from "@/kit/components/charts";
import { Section, Sheet } from "@/kit/components/page-shell";
import { Ghost } from "@/kit/components/yours-to-write";
import { useToast } from "@/kit/components/toast";
import { useWorker } from "@/kit/components/use-worker";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { firstMissing } from "../lib/gate";
import { setMind, useMind } from "../lib/store";
import { LiveWorld } from "../lib/sim";
import { Dreamer } from "../lib/dreamer";
import { PIXELS, SIDE, type Action } from "../lib/world";
import type { DynFrame, handlers } from "../workers/train.worker";
import { brackets, label, paintFrame, paintStatic, phosphor } from "./draw";
import { Field, HoldButton, Readout, useLoopCanvas } from "./ui";

/*
 * Sections 5 and 6: teach the latent dynamics model (trained through the user's gaussianNLL),
 * then let it dream beside reality, and measure its surprise with diagGaussianKL.
 */

const HZ = 14;
const TRACE = 180;

function PathPreview({ real, dream }: { real?: number[][]; dream?: number[][] }) {
  const ref = useLoopCanvas((ctx, { width: W, height: H }) => {
    ctx.fillStyle = grey(0);
    ctx.fillRect(0, 0, W, H);
    const sc = Math.min(W, H) / 7;
    const X = (v: number) => W / 2 + v * sc;
    const Y = (v: number) => H / 2 - v * sc;
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = grey(0.25);
    for (const k of [1, 2]) { ctx.beginPath(); ctx.arc(W / 2, H / 2, k * sc, 0, Math.PI * 2); ctx.stroke(); }
    ctx.setLineDash([]);
    const path = (p: number[][] | undefined, dash: number[], level: number, w: number) => {
      if (!p?.length) return;
      ctx.setLineDash(dash);
      ctx.strokeStyle = grey(level);
      ctx.lineWidth = w;
      ctx.beginPath();
      p.forEach((z, i) => (i ? ctx.lineTo(X(z[0]), Y(z[1])) : ctx.moveTo(X(z[0]), Y(z[1]))));
      ctx.stroke();
      ctx.setLineDash([]);
    };
    path(real, [], 0.55, 1.5);
    path(dream, [5, 4], 1, 2);
    if (real?.[0]) {
      ctx.fillStyle = grey(1);
      ctx.beginPath();
      ctx.arc(X(real[0][0]), Y(real[0][1]), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    label(ctx, "real path", 10, H - 24, { size: 9, level: 0.55 });
    label(ctx, "dreamt path (dashed)", 10, H - 10, { size: 9, level: 1 });
  }, 10);
  return <canvas ref={ref} className="block aspect-square w-full rounded-xl" role="img" aria-label="Real latent path and the model's open-loop dream of it" />;
}

export function DreamLab() {
  const toast = useToast();
  const mind = useMind();
  const m4 = firstMissing("m4-dynamics");
  const m5 = firstMissing("m5-surprise");
  const [running, setRunning] = useState(false);
  const [frame, setFrame] = useState<DynFrame | null>(null);
  const [preview, setPreview] = useState<{ real?: number[][]; dream?: number[][]; drift?: number[] }>({});
  const [hist, setHist] = useState<[number, number][]>([]);
  const [missing, setMissing] = useState<NotYoursYet | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const worker = useWorker<typeof handlers>(() => new Worker(new URL("../workers/train.worker.ts", import.meta.url)));

  // Live theatre state
  const world = useRef<LiveWorld | null>(null);
  const dreamer = useRef<Dreamer | null>(null);
  const realPh = useRef(new Float32Array(PIXELS));
  const dreamPh = useRef(new Float32Array(PIXELS));
  const acc = useRef(0);
  const [closed, setClosed] = useState(false);
  const [locked, setLocked] = useState(false);
  const [held, setHeld] = useState<Action | null>(null);
  const [noise, setNoise] = useState(0);
  const curves = useRef<number[][]>([]);
  const [drift, setDrift] = useState<number[][]>([]);
  const trace = useRef<{ v: number | null; kick: boolean }[]>([]);
  const pendingKick = useRef(false);
  const [surp, setSurp] = useState<{ now: number | null; peak: number }>({ now: null, peak: 0 });
  const lastUi = useRef(0);

  const eyesClosed = closed || locked;

  useEffect(() => {
    if (!mind.vae) {
      dreamer.current = null;
      return;
    }
    world.current ??= new LiveWorld(23);
    dreamer.current = new Dreamer(mind.vae, mind.dyn);
    dreamer.current.see(world.current.frame);
  }, [mind.vae, mind.dyn]);

  useEffect(() => {
    const d = dreamer.current;
    if (!d) return;
    if (eyesClosed && d.dyn) {
      if (d.eyes === "open") curves.current = [...curves.current.slice(-2), []];
      d.close();
    } else d.open();
  }, [eyesClosed, mind.dyn]);

  useEffect(() => {
    if (dreamer.current) dreamer.current.noise = noise;
  }, [noise, mind.dyn]);

  const train = () => {
    const w = worker.current;
    if (!w || !mind.vae) return;
    w.restart();
    setRunning(true);
    setMissing(null);
    setError(null);
    setHist([]);
    w.call("trainDyn", { vae: mind.vae }, (v) => {
      const f = v as DynFrame;
      setFrame(f);
      setHist((h) => [...h, [f.step, f.loss] as [number, number]]);
      if (f.dream) setPreview({ real: f.real, dream: f.dream, drift: f.drift });
    })
      .then((weights) => {
        setRunning(false);
        setMind({ dyn: weights });
        toast({ title: "It can dream", description: "Hold “close its eyes” and watch it keep the ball going on its own.", status: "success" });
      })
      .catch((e: unknown) => {
        setRunning(false);
        if (isNotYoursYet(e)) setMissing(e);
        else if (!(e instanceof Error && e.message === "Worker terminated")) setError(e instanceof Error ? e : new Error(String(e)));
      });
  };

  const hold = (a: Action, down: boolean) => {
    if (world.current) world.current.manual = down ? a : null;
    setHeld(down ? a : null);
  };

  const kick = () => {
    world.current?.kick();
    pendingKick.current = true;
  };

  const theatre = useLoopCanvas((ctx, { width: W, height: H }, t, dt) => {
    const w = world.current;
    const d = dreamer.current;
    ctx.fillStyle = grey(0);
    ctx.fillRect(0, 0, W, H);
    if (!w || !d) return;
    acc.current += Math.min(dt, 0.25);
    while (acc.current > 1 / HZ) {
      acc.current -= 1 / HZ;
      const { action } = w.tick();
      d.advance(w.frame, action);
      if (d.eyes === "closed") {
        let e = 0;
        for (let i = 0; i < PIXELS; i++) e += Math.abs(d.frame[i] - w.frame[i]);
        const c = curves.current[curves.current.length - 1];
        if (c && c.length < 120) c.push(e / PIXELS);
      }
      trace.current.push({ v: d.eyes === "open" ? d.surprise : null, kick: pendingKick.current });
      pendingKick.current = false;
      if (trace.current.length > TRACE) trace.current.shift();
    }
    phosphor(realPh.current, w.frame, 0.68);
    phosphor(dreamPh.current, d.frame, 0.68);

    const gap = 12;
    const s = Math.floor(Math.min((W - gap - 8) / 2, H - 40));
    const x0 = Math.round((W - 2 * s - gap) / 2);
    const y0 = 22;
    const px = Math.max(2, Math.round(s / 70));
    paintFrame(ctx, realPh.current, SIDE, x0, y0, s, { pixel: px });
    brackets(ctx, x0 - 3, y0 - 3, s + 6, s + 6, 9);
    const x1 = x0 + s + gap;
    const isClosed = d.eyes === "closed";
    if (d.dyn || !isClosed) paintFrame(ctx, dreamPh.current, SIDE, x1, y0, s, { pixel: px, grain: isClosed ? 0.1 : 0.03, t });
    else paintStatic(ctx, x1, y0, s, t, px);
    brackets(ctx, x1 - 3, y0 - 3, s + 6, s + 6, 9, isClosed ? 1 : 0.55);
    label(ctx, "Reality", x0, 14, { level: 0.7, size: 9 });
    label(ctx, isClosed ? `Dream · ${d.dreaming} steps` : "Its view · eyes open", x1, 14, { level: isClosed ? 1 : 0.7, size: 9 });

    if (t - lastUi.current > 0.25) {
      lastUi.current = t;
      setDrift(curves.current.map((c) => c.slice()));
      const vals = trace.current.map((p) => p.v).filter((v): v is number => v !== null);
      setSurp({ now: d.surprise, peak: vals.length ? Math.max(...vals) : 0 });
    }
  });

  const surpriseCanvas = useLoopCanvas((ctx, { width: W, height: H }) => {
    ctx.fillStyle = grey(0);
    ctx.fillRect(0, 0, W, H);
    const tr = trace.current;
    const vals = tr.map((p) => p.v ?? 0);
    const top = Math.max(2, ...vals) * 1.1;
    const X = (i: number) => (i / (TRACE - 1)) * W;
    const Y = (v: number) => H - 14 - (Math.log1p(v) / Math.log1p(top)) * (H - 28);
    ctx.strokeStyle = grey(0.15);
    ctx.beginPath();
    ctx.moveTo(0, Y(0)); ctx.lineTo(W, Y(0));
    ctx.stroke();
    // closed-eye stretches as hatching
    tr.forEach((p, i) => {
      if (p.v === null) {
        ctx.fillStyle = grey(0.09);
        ctx.fillRect(X(i), 0, W / TRACE + 0.5, H);
      }
      if (p.kick) {
        ctx.strokeStyle = grey(0.6);
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(X(i), 0); ctx.lineTo(X(i), H);
        ctx.stroke();
        ctx.setLineDash([]);
        label(ctx, "kick", X(i) + 3, 10, { size: 8, level: 0.7 });
      }
    });
    ctx.strokeStyle = grey(1);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let pen = false;
    tr.forEach((p, i) => {
      if (p.v === null) { pen = false; return; }
      if (!pen) { ctx.moveTo(X(i), Y(p.v)); pen = true; } else ctx.lineTo(X(i), Y(p.v));
    });
    ctx.stroke();
    label(ctx, "KL(what it sees ‖ what it expected) · nats, log scale", 6, H - 2, { size: 8, level: 0.5 });
  }, 20);

  const needVae = !mind.vae;
  const gate = m4 ?? missing;

  return (
    <>
      <Section id="dream" index={5} kicker="Latent dynamics" title="Close its eyes">
        <p className="mb-5 text-ink-soft">
          A second small network reads two latents and an action and predicts a Gaussian over the next latent. It&apos;s trained
          by feeding its own guesses back in for up to 12 steps, scored at each step by your{" "}
          <code className="font-mono text-ink">gaussianNLL()</code>. Then it can run with no input at all.
        </p>
        {gate ? (
          <CorePanel error={gate} ghost={<div className="grid grid-cols-2 gap-3 p-4"><Ghost label="reality" className="aspect-square" /><Ghost label="dream" className="aspect-square" /></div>} />
        ) : needVae ? (
          <Ghost label="Train the eyes first (section 03)" className="aspect-[2/1] w-full rounded-2xl" />
        ) : (
          <div className="flex flex-col gap-4">
            <Sheet className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {running ? (
                  <Button variant="outline" className="rounded-xl" onClick={() => { worker.current?.restart(); setRunning(false); }}>Stop</Button>
                ) : (
                  <Button className="rounded-xl" onClick={train}>
                    <Moon className="size-4" /> {mind.dyn ? "Retrain the dreams" : "Teach it to dream"}
                  </Button>
                )}
                {frame && <span className="font-mono text-xs text-ink-soft tabular-nums">horizon {frame.horizon} · {Math.round(frame.stepsPerSec)} steps/s</span>}
              </div>
              {frame && <Progress value={(100 * frame.step) / frame.steps} aria-label="dynamics training progress" />}
              {(running || frame) && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="type-narrow mb-2 text-xs tracking-[0.2em] text-ink-soft uppercase">Rollout NLL per step · horizon grows</p>
                    {hist.length > 1 ? <LineChart series={[{ label: "−log N(z; m, e^s)", data: hist }]} height={180} xLabel="step" /> : <LineChart ghost series={[]} height={180} />}
                    <p className="type-narrow mt-4 mb-2 text-xs tracking-[0.2em] text-ink-soft uppercase">Held-out dream: pixel error vs steps</p>
                    {preview.drift ? <LineChart series={[{ label: "mean |dream − real|", data: preview.drift }]} height={140} xLabel="steps dreamt" /> : <LineChart ghost series={[]} height={140} />}
                  </div>
                  <PathPreview real={preview.real} dream={preview.dream} />
                </div>
              )}
            </Sheet>
            {error && <CoreError error={error} />}

            <div className="overflow-hidden rounded-2xl border border-rule bg-paper">
              <canvas ref={theatre} className="block aspect-[2/1.08] w-full" role="img" aria-label="Reality on the left; the model's view or dream on the right" />
            </div>
            <div className="flex flex-col gap-3">
              <HoldButton onHold={setClosed} held={eyesClosed} disabled={!mind.dyn} className="min-h-14 w-full text-base">
                <EyeOff className="size-5" /> {mind.dyn ? (eyesClosed ? "Dreaming…" : "Hold to close its eyes") : "Teach it to dream first"}
              </HoldButton>
              <div className="flex flex-wrap items-center gap-2">
                <HoldButton onHold={(d) => hold(1, d)} held={held === 1} ariaLabel="Hold to push left"><ArrowLeft className="size-4" /></HoldButton>
                <HoldButton onHold={(d) => hold(3, d)} held={held === 3} ariaLabel="Hold to jump"><ArrowUp className="size-4" /></HoldButton>
                <HoldButton onHold={(d) => hold(2, d)} held={held === 2} ariaLabel="Hold to push right"><ArrowRight className="size-4" /></HoldButton>
                <Button variant="outline" className="rounded-xl" onClick={kick}><Zap className="size-4" /> Kick</Button>
                <label className="ml-auto flex min-h-11 items-center gap-2">
                  <Lock className="size-4 text-ink-soft" />
                  <span className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Keep closed</span>
                  <Switch checked={locked} onCheckedChange={setLocked} disabled={!mind.dyn} />
                </label>
              </div>
              <p className="text-xs text-ink-soft">The arrows move the real ball, and the dream is told which action you took. It is never told about kicks.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Sheet>
                <Field label="Dream noise · temperature on ε" value={noise === 0 ? "mean only" : noise.toFixed(2)}>
                  <Slider min={0} max={1.5} step={0.05} value={noise} onValueChange={(v) => setNoise(Array.isArray(v) ? v[0] : v)} aria-label="dream noise" disabled={!mind.dyn} />
                </Field>
                <p className="mt-3 text-xs text-ink-soft">
                  Above 0 the dream samples each next latent with your <code className="font-mono text-ink">reparameterise()</code>, using the variance the model learned.
                </p>
              </Sheet>
              <Sheet>
                <p className="type-narrow mb-2 text-xs tracking-[0.2em] text-ink-soft uppercase">Drift while dreaming · last 3 dreams</p>
                {drift.some((c) => c.length > 1) ? (
                  <LineChart series={drift.filter((c) => c.length > 1).map((c, i, a) => ({ label: i === a.length - 1 ? "latest" : `${a.length - 1 - i} ago`, data: c, stroke: i === a.length - 1 ? "solid" : "soft" }))} height={150} xLabel="steps with eyes closed" yDomain={[0, 0.2]} />
                ) : (
                  <LineChart ghost series={[]} height={150} />
                )}
              </Sheet>
            </div>
          </div>
        )}
      </Section>

      <Section id="surprise" index={6} kicker="Surprise" title="Catch it off guard">
        <p className="mb-5 text-ink-soft">
          With its eyes open the model still predicts each next latent before it looks. The KL from what it then sees to what it
          expected is its surprise. Kick the ball and watch the spike.
        </p>
        {m5 ? (
          <CorePanel error={m5} ghost={<Ghost label="surprise trace" className="h-40 w-full" />} />
        ) : !mind.dyn ? (
          <Ghost label="Needs the dream model (section 05)" className="h-40 w-full rounded-2xl" />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="overflow-hidden rounded-2xl border border-rule bg-paper">
              <canvas ref={surpriseCanvas} className="block h-44 w-full" role="img" aria-label="Surprise over time, with kicks marked" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Readout k="now" v={surp.now === null ? "-" : surp.now.toFixed(2)} />
              <Readout k="peak · 13 s" v={surp.peak.toFixed(1)} />
              <Button variant="outline" className="h-full min-h-11 rounded-xl" onClick={kick}><Zap className="size-4" /> Kick</Button>
            </div>
          </div>
        )}
      </Section>
    </>
  );
}

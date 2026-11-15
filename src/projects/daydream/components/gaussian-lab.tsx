"use client";

import { useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { grey, isNotYoursYet, type NotYoursYet } from "@/kit";
import { CorePanel, CoreError } from "@/kit/components/core-guard";
import { Sheet } from "@/kit/components/page-shell";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { reparameterise, reparameteriseBackward } from "../core/reparam";
import { gaussianKL, gaussianKLGrad } from "../core/kl";
import { firstMissing } from "../lib/gate";
import { gaussVec, rng } from "../lib/rng";
import { label } from "./draw";
import { Field, Readout, useLoopCanvas } from "./ui";

/*
 * Section 2: a 2-D Gaussian you can push around with gradients that went *through a sample*.
 * Objective: E_ε ‖z − target‖² + β · KL(q ‖ N(0, I)), z = reparameterise(μ, logvar, ε).
 * The reconstruction term pulls the cloud onto the target and squeezes it; the prior pulls it home.
 */

const K = 32;
const LR = 0.04;
const SPAN = 3.2;

interface LabState {
  mu: number[];
  lv: number[];
  target: number[];
  trail: number[][];
  samples: number[][];
  grad: number[];
  loss: number;
  kl: number | null;
}

const fresh = (): LabState => ({ mu: [-1.6, 1.1], lv: [0, 0], target: [1.6, -0.9], trail: [], samples: [], grad: [0, 0], loss: 0, kl: null });

function GhostLab() {
  return (
    <svg viewBox="0 0 320 240" className="block h-auto w-full" aria-hidden>
      {[40, 80].map((r) => (
        <circle key={r} cx="160" cy="120" r={r} fill="none" stroke="var(--ink-soft)" strokeDasharray="4 5" />
      ))}
      <ellipse cx="110" cy="85" rx="34" ry="22" fill="none" stroke="var(--ink)" strokeWidth="2" />
      {Array.from({ length: 30 }, (_, i) => (
        <circle key={i} cx={110 + 28 * Math.cos(i * 2.4) * ((i % 5) / 5)} cy={85 + 18 * Math.sin(i * 2.4) * ((i % 4) / 4)} r="2" fill="var(--ink)" />
      ))}
      <path d="M215 150 l10 0 M220 145 l0 10" stroke="var(--ink)" strokeWidth="2" />
    </svg>
  );
}

export function GaussianLab() {
  const m1 = firstMissing("m1-reparam");
  const m2 = firstMissing("m2-kl");
  const st = useRef<LabState>(fresh());
  const r = useRef(rng(4));
  const [beta, setBeta] = useState(0.6);
  const [running, setRunning] = useState(true);
  const [view, setView] = useState({ loss: 0, kl: null as number | null, s1: 1, s2: 1 });
  const [error, setError] = useState<Error | null>(null);
  const [missing, setMissing] = useState<NotYoursYet | null>(null);
  const drag = useRef(false);
  const lastView = useRef(0);

  const ref = useLoopCanvas((ctx, { width: W, height: H }, t) => {
    const s = st.current;
    const sc = Math.min(W, H) / (2 * SPAN);
    const X = (v: number) => W / 2 + v * sc;
    const Y = (v: number) => H / 2 - v * sc;

    if (!m1 && running && !error) {
      try {
        const dmu = [0, 0], dlv = [0, 0];
        let loss = 0;
        const samples: number[][] = [];
        for (let k = 0; k < K; k++) {
          const eps = gaussVec(r.current, 2);
          const z = reparameterise(s.mu, s.lv, eps);
          samples.push(z);
          const dz = [2 * (z[0] - s.target[0]), 2 * (z[1] - s.target[1])];
          loss += ((z[0] - s.target[0]) ** 2 + (z[1] - s.target[1]) ** 2) / K;
          const g = reparameteriseBackward(s.lv, eps, dz);
          for (let i = 0; i < 2; i++) { dmu[i] += g.dmu[i] / K; dlv[i] += g.dlogvar[i] / K; }
        }
        let kl: number | null = null;
        const b = beta;
        if (!m2) {
          kl = gaussianKL(s.mu, s.lv);
          const g = gaussianKLGrad(s.mu, s.lv);
          for (let i = 0; i < 2; i++) { dmu[i] += b * g.dmu[i]; dlv[i] += b * g.dlogvar[i]; }
        }
        for (let i = 0; i < 2; i++) {
          s.mu[i] -= LR * dmu[i];
          s.lv[i] = Math.max(-7, Math.min(3, s.lv[i] - LR * dlv[i]));
        }
        s.grad = dmu;
        s.samples = samples;
        s.trail.push([...s.mu]);
        if (s.trail.length > 120) s.trail.shift();
        s.loss = loss;
        s.kl = kl;
      } catch (e) {
        if (isNotYoursYet(e)) setMissing(e);
        else setError(e instanceof Error ? e : new Error(String(e)));
      }
    }

    ctx.fillStyle = grey(0);
    ctx.fillRect(0, 0, W, H);
    // axes
    ctx.strokeStyle = grey(0.15);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, Y(0)); ctx.lineTo(W, Y(0));
    ctx.moveTo(X(0), 0); ctx.lineTo(X(0), H);
    ctx.stroke();
    // prior: 1σ, 2σ
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = grey(0.4);
    for (const k of [1, 2]) { ctx.beginPath(); ctx.arc(X(0), Y(0), k * sc, 0, Math.PI * 2); ctx.stroke(); }
    ctx.setLineDash([]);
    label(ctx, "prior N(0, I)", X(0) + 2 * sc * 0.72, Y(0) - 2 * sc * 0.72 - 4, { size: 9, level: 0.45 });

    // trail of μ
    ctx.strokeStyle = grey(0.35);
    ctx.beginPath();
    s.trail.forEach((p, i) => (i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))));
    ctx.stroke();

    // q: 1σ and 2σ ellipses
    const sd = s.lv.map((l) => Math.exp(0.5 * l));
    ctx.strokeStyle = grey(1);
    for (const k of [1, 2]) {
      ctx.lineWidth = k === 1 ? 2 : 1;
      ctx.globalAlpha = k === 1 ? 1 : 0.5;
      ctx.beginPath();
      ctx.ellipse(X(s.mu[0]), Y(s.mu[1]), Math.max(0.5, k * sd[0] * sc), Math.max(0.5, k * sd[1] * sc), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // samples
    ctx.fillStyle = grey(1);
    for (const z of s.samples) ctx.fillRect(X(z[0]) - 1.25, Y(z[1]) - 1.25, 2.5, 2.5);
    // gradient arrow (descent direction)
    const g = s.grad;
    const gl = Math.hypot(g[0], g[1]);
    if (gl > 1e-4) {
      const L = Math.min(60, 26 * Math.sqrt(gl));
      const ux = -g[0] / gl, uy = g[1] / gl;
      const ax = X(s.mu[0]), ay = Y(s.mu[1]);
      ctx.strokeStyle = grey(1);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax + ux * L, ay + uy * L);
      ctx.lineTo(ax + ux * (L - 6) - uy * 4, ay + uy * (L - 6) + ux * 4);
      ctx.moveTo(ax + ux * L, ay + uy * L);
      ctx.lineTo(ax + ux * (L - 6) + uy * 4, ay + uy * (L - 6) - ux * 4);
      ctx.stroke();
    }
    // target
    const tx = X(s.target[0]), ty = Y(s.target[1]);
    ctx.strokeStyle = grey(1);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tx - 8, ty); ctx.lineTo(tx + 8, ty);
    ctx.moveTo(tx, ty - 8); ctx.lineTo(tx, ty + 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(tx, ty, 12 + 2 * Math.sin(t * 3), 0, Math.PI * 2);
    ctx.stroke();
    label(ctx, "target · drag me", tx + 16, ty + 4, { size: 9, level: 0.6 });

    if (t - lastView.current > 0.2) {
      lastView.current = t;
      setView({ loss: s.loss, kl: s.kl, s1: sd[0], s2: sd[1] });
    }
  });

  const toWorld = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rc = e.currentTarget.getBoundingClientRect();
    const sc = Math.min(rc.width, rc.height) / (2 * SPAN);
    st.current.target = [(e.clientX - rc.left - rc.width / 2) / sc, -(e.clientY - rc.top - rc.height / 2) / sc];
  };

  const blocked = m1 ?? missing;
  if (blocked) return <CorePanel error={blocked} ghost={<GhostLab />} />;
  if (error) return <CoreError error={error} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl border border-rule bg-paper">
        <canvas
          ref={ref}
          className="block aspect-[4/3] w-full touch-none"
          role="img"
          aria-label="A 2-D Gaussian, its samples, the target and the prior"
          onPointerDown={(e) => {
            drag.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            toWorld(e);
          }}
          onPointerMove={(e) => drag.current && toWorld(e)}
          onPointerUp={() => (drag.current = false)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Readout k="E‖z − target‖²" v={view.loss.toFixed(2)} />
        <Readout k="KL to prior" v={view.kl === null ? "-" : view.kl.toFixed(2)} />
        <Readout k="σ₁" v={view.s1.toFixed(2)} />
        <Readout k="σ₂" v={view.s2.toFixed(2)} />
      </div>
      <Sheet className="flex flex-col gap-4">
        <Field label="β · how hard the prior pulls" value={m2 ? "needs gaussianKL" : beta.toFixed(2)}>
          <Slider min={0} max={4} step={0.05} value={beta} disabled={!!m2} onValueChange={(v) => setBeta(Array.isArray(v) ? v[0] : v)} aria-label="beta" />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => setRunning((x) => !x)}>
            {running ? <Pause className="size-4" /> : <Play className="size-4" />} {running ? "Pause" : "Run"}
          </Button>
          <Button variant="outline" className="rounded-xl" onClick={() => (st.current = { ...fresh(), target: st.current.target })}>
            <RotateCcw className="size-4" /> Reset
          </Button>
        </div>
        <p className="text-sm text-ink-soft">
          Every gradient here went through a random sample: 32 draws of ε per frame, pushed through your{" "}
          <code className="font-mono text-ink">reparameterise()</code> and back through{" "}
          <code className="font-mono text-ink">reparameteriseBackward()</code>. Slide β to 0 and watch what the cloud does without a prior.
        </p>
      </Sheet>
      {m2 && <CorePanel error={m2} />}
    </div>
  );
}

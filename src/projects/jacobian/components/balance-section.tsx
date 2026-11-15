"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { grey } from "@/kit/canvas";
import { ditherField } from "@/kit/dither";
import { isNotYoursYet } from "@/kit/not-yours-yet";
import { CorePanel, CoreError } from "@/kit/components/core-guard";
import { LineChart } from "@/kit/components/charts";
import { Sheet } from "@/kit/components/page-shell";
import { useCanvas } from "@/kit/components/use-canvas";
import { useWorker } from "@/kit/components/use-worker";
import { Button } from "@/components/ui/button";
import { MorphButton } from "@/components/spectrumui/morph-button";
import { riccatiStep, dlqr } from "../core/lqr";
import { CARTPOLE, cartPoleLinear, cartPoleStep, clampForce, wrapAngle } from "../lib/cartpole";
import { matDist, matMul, matSub, spectralRadius, type Mat, type Vec } from "../lib/linalg";
import type { handlers } from "../workers/lqr.worker";
import { label } from "./scene";
import { useCores } from "./use-cores";
import { LabeledSlider, Predict, Readout } from "./bits";

/*
 * M5: LQR balances a cart-pole. The page linearises the physics about upright and discretises it
 * (plumbing); the user's dlqr turns (A, B, Q, R) into the gain K; the full nonlinear physics runs
 * under u = −Kx with a force limit. Tap the scene to kick the pole. Beside it, the cost-to-go
 * xᵀPx sliced at (angle, angular velocity) as dithered contour bands, with the live state crawling
 * down into the bowl, and a worker-computed map of which kicks it can recover from.
 */

const DT = 0.02;
const LIN = cartPoleLinear(CARTPOLE, DT);
const TH_MAX = 0.5;
const W_MAX = 2.5;

function costMatrices(qAngle: number, rEffort: number): { Q: Mat; R: Mat } {
  return {
    Q: [
      [1, 0, 0, 0],
      [0, 0.1, 0, 0],
      [0, 0, qAngle, 0],
      [0, 0, 0, 0.1],
    ],
    R: [[rEffort]],
  };
}

const logSlider = (lo: number, hi: number) => ({
  to: (v: number) => Math.log10(v),
  from: (s: number) => 10 ** s,
  min: Math.log10(lo),
  max: Math.log10(hi),
});
const QS = logSlider(0.1, 300);
const RS = logSlider(0.005, 20);

interface Sim {
  x: Vec;
  u: number;
  trail: Vec[];
  fallen: number;
  acc: number;
}

export function BalanceSection() {
  const a = useCores();
  const [qAngle, setQAngle] = useState(10);
  const [rEffort, setREffort] = useState(0.1);
  const { Q, R } = useMemo(() => costMatrices(qAngle, rEffort), [qAngle, rEffort]);

  const conv = useMemo(() => {
    if (!a || a.riccatiStep) return null;
    try {
      let P = Q;
      const diffs: number[] = [];
      const kAngle: number[] = [];
      for (let i = 0; i < 400; i++) {
        const s = riccatiStep(P, LIN.A, LIN.B, Q, R);
        diffs.push(Math.max(1e-16, matDist(s.P, P)));
        kAngle.push(s.K[0][2]);
        P = s.P;
      }
      return { diffs, kAngle, error: null };
    } catch (e) {
      return { error: e instanceof Error ? e : new Error(String(e)) } as const;
    }
  }, [a, Q, R]);

  const lqr = useMemo(() => {
    if (!a || a.riccatiStep || a.dlqr) return null;
    try {
      const out = dlqr(LIN.A, LIN.B, Q, R);
      return { ...out, rho: spectralRadius(matSub(LIN.A, matMul(LIN.B, out.K))), error: null };
    } catch (e) {
      return { error: e instanceof Error ? e : new Error(String(e)) } as const;
    }
  }, [a, Q, R]);

  if (!a) return <div className="h-72 rounded-2xl border border-rule bg-sheet" />;
  if (a.riccatiStep) return <CorePanel error={a.riccatiStep} ghost={<CartScene K={null} />} />;
  if (conv?.error) return <CoreError error={conv.error} />;
  if (lqr?.error) return <CoreError error={lqr.error} />;

  return (
    <div className="flex flex-col gap-4">
      {lqr && !lqr.error ? (
        <>
          <CartScene K={lqr.K[0]} P={lqr.P} />
          <Sheet className="flex flex-col gap-2">
            <LabeledSlider label="Q angle weight" value={QS.to(qAngle)} min={QS.min} max={QS.max} onChange={(s) => setQAngle(QS.from(s))} format={(s) => QS.from(s).toPrecision(2)} />
            <LabeledSlider label="R effort weight" value={RS.to(rEffort)} min={RS.min} max={RS.max} onChange={(s) => setREffort(RS.from(s))} format={(s) => RS.from(s).toPrecision(2)} />
          </Sheet>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Readout label="K (x, ẋ)" value={`${lqr.K[0][0].toFixed(1)}, ${lqr.K[0][1].toFixed(1)}`} sub="N per m, N per m/s" />
            <Readout label="K (θ, θ̇)" value={`${lqr.K[0][2].toFixed(1)}, ${lqr.K[0][3].toFixed(1)}`} sub="N per rad, N per rad/s" />
            <Readout label="Iterations" value={lqr.iterations} sub="Riccati steps to converge" />
            <Readout label="ρ(A − BK)" value={lqr.rho.toFixed(4)} sub={lqr.rho < 1 ? "< 1: stable" : "≥ 1: unstable"} />
          </div>
          <Basin K={lqr.K[0]} />
        </>
      ) : (
        <CorePanel error={a.dlqr!} ghost={<CartScene K={null} />} />
      )}
      {conv && !conv.error && (
        <Sheet>
          <p className="type-narrow mb-2 text-xs tracking-[0.2em] text-ink-soft uppercase">Riccati iteration from P = Q: ‖P_k+1 − P_k‖</p>
          <LineChart height={180} logY series={[{ label: "‖ΔP‖", data: conv.diffs, stroke: "solid" }]} xLabel="iteration" />
          <p className="mt-2 text-xs text-ink-soft">
            The angle gain settles at K_θ = {conv.kAngle[conv.kAngle.length - 1].toFixed(2)} N/rad. Straight line on a log axis = linear convergence.
          </p>
        </Sheet>
      )}
      <Predict>
        Make R 100× bigger. Before you drag: does the cart move more or less to catch a kick, and does the region it can
        recover from (the map above) grow or shrink?
      </Predict>
    </div>
  );
}

/** The cart, the pole and the cost-to-go bowl. K = null: no controller (it falls, over and over). */
function CartScene({ K, P }: { K: number[] | null; P?: Mat }) {
  const sim = useRef<Sim>({ x: [0, 0, 0.15, 0], u: 0, trail: [], fallen: 0, acc: 0 });
  const kRef = useRef(K);
  useEffect(() => {
    kRef.current = K;
  }, [K]);
  const bowl = useRef<{ key: string; img: OffscreenCanvas } | null>(null);

  const kick = (dir: number) => {
    sim.current.x[3] += dir * 1.4;
    sim.current.fallen = 0;
  };

  const ref = useCanvas(
    ({ ctx, width, height, dt }) => {
      const s = sim.current;
      const k = kRef.current;
      s.acc += Math.min(dt, 0.1);
      while (s.acc >= DT) {
        s.acc -= DT;
        const xs = [s.x[0], s.x[1], wrapAngle(s.x[2]), s.x[3]];
        s.u = k ? clampForce(CARTPOLE, -(k[0] * xs[0] + k[1] * xs[1] + k[2] * xs[2] + k[3] * xs[3])) : 0;
        s.x = cartPoleStep(CARTPOLE, cartPoleStep(CARTPOLE, s.x, s.u, DT / 2), s.u, DT / 2);
        s.trail.push([wrapAngle(s.x[2]), s.x[3]]);
        if (s.trail.length > 160) s.trail.shift();
        const out = Math.abs(wrapAngle(s.x[2])) > 1.3 || Math.abs(s.x[0]) > CARTPOLE.rail || !s.x.every(Number.isFinite);
        if (out) s.fallen += DT;
        if (s.fallen > (k ? 0.8 : 1.6)) {
          s.x = [0, 0, (Math.random() - 0.5) * 0.4, 0];
          s.fallen = 0;
          s.trail = [];
        }
      }

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);
      const wide = width > 520 && P;
      const cw = wide ? width * 0.58 : width;
      const sceneH = wide || !P ? height : height * 0.58;

      // Scene: rail, cart, pole, force arrow, motion ghosts.
      const sc = Math.min(cw / (CARTPOLE.rail * 2 + 0.6), sceneH / 1.9);
      const y0 = sceneH * 0.8;
      const cx = (x: number) => cw / 2 + x * sc;
      ctx.strokeStyle = grey(1, 0.35);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx(-CARTPOLE.rail), y0 + 14);
      ctx.lineTo(cx(CARTPOLE.rail), y0 + 14);
      ctx.stroke();
      for (let m = -CARTPOLE.rail; m <= CARTPOLE.rail + 1e-9; m += 0.4) {
        ctx.fillStyle = grey(1, 0.3);
        ctx.fillRect(cx(m) - 0.5, y0 + 14, 1, 5);
      }
      const L = CARTPOLE.halfLength * 2 * sc;
      // Motion ghosts.
      s.trail.slice(-24).forEach((tr, i, arr) => {
        if (i % 4) return;
        ctx.strokeStyle = grey(1, 0.06 + (0.12 * i) / arr.length);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx(s.x[0]), y0);
        ctx.lineTo(cx(s.x[0]) + L * Math.sin(tr[0]), y0 - L * Math.cos(tr[0]));
        ctx.stroke();
      });
      const px = cx(s.x[0]);
      ctx.fillStyle = grey(0.1);
      ctx.strokeStyle = grey(1);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(px - 30, y0 - 12, 60, 24, 6);
      ctx.fill();
      ctx.stroke();
      for (const wx of [-18, 18]) {
        ctx.beginPath();
        ctx.arc(px + wx, y0 + 12, 4, 0, Math.PI * 2);
        ctx.fillStyle = grey(0);
        ctx.fill();
        ctx.stroke();
      }
      const th = s.x[2];
      const tx = px + L * Math.sin(th);
      const ty = y0 - L * Math.cos(th);
      ctx.lineCap = "round";
      ctx.lineWidth = 5;
      ctx.strokeStyle = grey(1);
      ctx.beginPath();
      ctx.moveTo(px, y0);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(tx, ty, 7, 0, Math.PI * 2);
      ctx.fillStyle = grey(1);
      ctx.fill();
      // Force arrow.
      if (Math.abs(s.u) > 0.05) {
        const len = (s.u / CARTPOLE.maxForce) * 70;
        ctx.strokeStyle = grey(1, 0.8);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, y0 + 30);
        ctx.lineTo(px + len, y0 + 30);
        ctx.lineTo(px + len - Math.sign(len) * 6, y0 + 25);
        ctx.moveTo(px + len, y0 + 30);
        ctx.lineTo(px + len - Math.sign(len) * 6, y0 + 35);
        ctx.stroke();
      }
      label(ctx, k ? `u = ${s.u.toFixed(1)} N` : "no controller: dlqr() is yours", 10, 14, { alpha: 0.75 });
      label(ctx, "tap left / right to kick", 10, 30, { alpha: 0.5 });

      // Cost-to-go bowl: V(θ, θ̇) = xᵀPx with x = [0, 0, θ, θ̇], banded and dithered.
      if (P) {
        const bx = wide ? cw + 8 : 0;
        const by = wide ? 0 : sceneH + 8;
        const bw = wide ? width - cw - 8 : width;
        const bh = wide ? height : height - sceneH - 8;
        const key = `${P[2][2]},${P[2][3]},${P[3][3]},${bw},${bh}`;
        const res = 3;
        const gw = Math.max(8, Math.floor(bw / res));
        const gh = Math.max(8, Math.floor(bh / res));
        if (!bowl.current || bowl.current.key !== key) {
          const field = new Float32Array(gw * gh);
          const vmax = P[2][2] * TH_MAX * TH_MAX + P[3][3] * W_MAX * W_MAX;
          for (let j = 0; j < gh; j++) {
            const w = W_MAX - (j / (gh - 1)) * 2 * W_MAX;
            for (let i = 0; i < gw; i++) {
              const t = -TH_MAX + (i / (gw - 1)) * 2 * TH_MAX;
              const V = P[2][2] * t * t + 2 * P[2][3] * t * w + P[3][3] * w * w;
              const n = Math.sqrt(Math.max(0, V) / vmax);
              const band = (n * 6) % 1;
              field[j * gw + i] = (1 - Math.min(1, n)) * 0.4 + (band < 0.1 ? 0.45 : 0);
            }
          }
          const img = new ImageData(gw, gh);
          ditherField(field, gw, gh, img.data, [0, 0.25, 0.55, 0.9]);
          const off = new OffscreenCanvas(gw, gh);
          off.getContext("2d")!.putImageData(img, 0, 0);
          bowl.current = { key, img: off };
        }
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 12);
        ctx.clip();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(bowl.current.img, bx, by, gw * res, gh * res);
        // Trail of the live state.
        const map = (t: number, w: number) => [bx + ((t + TH_MAX) / (2 * TH_MAX)) * bw, by + ((W_MAX - w) / (2 * W_MAX)) * bh];
        ctx.strokeStyle = grey(0);
        ctx.lineWidth = 4;
        ctx.beginPath();
        s.trail.forEach((tr, i) => {
          const [x, y] = map(tr[0], tr[1]);
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        });
        ctx.stroke();
        ctx.strokeStyle = grey(1);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        const last = s.trail[s.trail.length - 1];
        if (last) {
          const [x, y] = map(last[0], last[1]);
          ctx.fillStyle = grey(1);
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        label(ctx, "xᵀPx over θ × θ̇", bx + 8, by + 14, { alpha: 0.75 });
      }
    },
    { fps: 50 },
  );

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={ref}
        aria-label="A cart balancing a pole"
        className="h-[26rem] w-full touch-manipulation rounded-2xl border border-rule sm:h-80"
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          kick(e.clientX - r.left < r.width / 2 ? -1 : 1);
        }}
      />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => kick(-1)}>← Kick</Button>
        <Button variant="outline" onClick={() => kick(1)}>Kick →</Button>
      </div>
    </div>
  );
}

/** Which initial (θ, θ̇) the nonlinear cart-pole recovers from under the current K, with the force limit. */
function Basin({ K }: { K: number[] }) {
  const worker = useWorker<typeof handlers>(() => new Worker(new URL("../workers/lqr.worker.ts", import.meta.url)));
  const RES = 72;
  const [map, setMap] = useState<Float32Array | null>(null);
  const [forK, setForK] = useState<string>("");
  const [err, setErr] = useState<Error | null>(null);
  const kKey = K.map((v) => v.toFixed(2)).join(",");
  const thMax = 1.4;
  const wMax = 4;

  const run = async () => {
    setErr(null);
    try {
      const out = await worker.current!.call("basin", { K, res: RES, thMax, wMax, seconds: 6 }, (p) => setMap((p as { partial: Float32Array }).partial));
      setMap(out);
      setForK(kKey);
    } catch (e) {
      if (!isNotYoursYet(e)) setErr(e instanceof Error ? e : new Error(String(e)));
      throw e;
    }
  };

  const ref = useCanvas(
    ({ ctx, width, height }) => {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);
      if (map) {
        const img = new ImageData(RES, RES);
        ditherField(map, RES, RES, img.data, [0, 0.3, 0.65, 1]);
        const off = new OffscreenCanvas(RES, RES);
        off.getContext("2d")!.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(off, 0, 0, width, height);
      } else {
        ctx.fillStyle = grey(1, 0.05);
        for (let y = 0; y < height; y += 8) ctx.fillRect(0, y, width, 1);
      }
      ctx.strokeStyle = grey(1, 0.35);
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      label(ctx, `θ ∈ ±${thMax}`, width - 8, height - 12, { align: "right", alpha: 0.7 });
      label(ctx, `θ̇ ∈ ±${wMax}`, 8, 14, { alpha: 0.7 });
    },
    { animate: false },
    [map],
  );

  return (
    <Sheet className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Where can it recover from?</p>
        <p className="font-mono text-xs text-ink-soft">{forK && forK !== kKey ? "K changed: run again" : map ? `${RES}² starts, full nonlinear physics, ±${CARTPOLE.maxForce} N` : ""}</p>
      </div>
      <canvas ref={ref} className="aspect-[4/3] w-full rounded-xl border border-rule [image-rendering:pixelated]" />
      <MorphButton onAction={run} loadingLabel="Simulating" successLabel="Mapped" className="w-full">
        Map the region of attraction
      </MorphButton>
      {err && <CoreError error={err} />}
      <p className="text-xs leading-snug text-ink-soft">Bright = settles fast, grey = slowly, black = falls. The linear controller only knows about small angles, and the motor can only push so hard.</p>
    </Sheet>
  );
}

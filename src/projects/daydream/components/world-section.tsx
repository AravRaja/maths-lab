"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUp, Zap } from "lucide-react";
import { grey } from "@/kit";
import { Sheet } from "@/kit/components/page-shell";
import { Button } from "@/components/ui/button";
import { LiveWorld } from "../lib/sim";
import { ACTION_NAMES, PIXELS, SIDE, type Action } from "../lib/world";
import { brackets, label, paintFrame, phosphor } from "./draw";
import { HoldButton, Readout, useLoopCanvas } from "./ui";

/**
 * Section 1: the world itself. No cores needed. The ball, the controls, and the 400 numbers
 * that are all the model will ever get to see of it.
 */
export function WorldSection() {
  const world = useRef(new LiveWorld(11));
  const ph = useRef(new Float32Array(PIXELS));
  const acc = useRef(0);
  const strip = useRef<Float32Array[]>([]);
  const [held, setHeld] = useState<Action | null>(null);
  const [readout, setReadout] = useState({ x: 0, y: 0, vx: 0, vy: 0, a: 0 as Action });
  const lastReadout = useRef(0);

  const hold = (a: Action, down: boolean) => {
    world.current.manual = down ? a : null;
    setHeld(down ? a : null);
  };

  const big = useLoopCanvas((ctx, { width: W, height: H }, t, dt) => {
    const w = world.current;
    acc.current += Math.min(dt, 0.25);
    while (acc.current > 1 / 16) {
      acc.current -= 1 / 16;
      w.tick();
      if (w.t % 3 === 0) {
        strip.current.push(w.frame.slice());
        if (strip.current.length > 8) strip.current.shift();
      }
    }
    phosphor(ph.current, w.frame, 0.65);
    ctx.fillStyle = grey(0);
    ctx.fillRect(0, 0, W, H);
    const s = Math.min(W, H) - 24;
    const x = (W - s) / 2;
    const y = (H - s) / 2;
    paintFrame(ctx, ph.current, SIDE, x, y, s, { pixel: Math.max(2, Math.round(s / 90)) });
    brackets(ctx, x - 6, y - 6, s + 12, s + 12, 12);
    label(ctx, `action · ${ACTION_NAMES[w.action]}${w.manual === null ? " (autopilot)" : ""}`, x, y + s + 16, { size: 9, level: 0.5 });
    if (t - lastReadout.current > 0.25) {
      lastReadout.current = t;
      setReadout({ x: w.s.x, y: w.s.y, vx: w.s.vx, vy: w.s.vy, a: w.action });
    }
  });

  const pixels = useLoopCanvas((ctx, { width: W, height: H }) => {
    const f = world.current.frame;
    ctx.fillStyle = grey(0);
    ctx.fillRect(0, 0, W, H);
    const c = Math.min(W, H) / SIDE;
    for (let j = 0; j < SIDE; j++)
      for (let i = 0; i < SIDE; i++) {
        const v = f[j * SIDE + i];
        ctx.fillStyle = grey(0.06 + 0.94 * v);
        ctx.fillRect(i * c + 0.5, j * c + 0.5, c - 1, c - 1);
      }
  }, 16);

  const film = useLoopCanvas((ctx, { width: W, height: H }) => {
    ctx.fillStyle = grey(0);
    ctx.fillRect(0, 0, W, H);
    const n = 8;
    const gap = 4;
    const s = Math.min(H, (W - gap * (n - 1)) / n);
    strip.current.forEach((f, k) => paintFrame(ctx, f, SIDE, k * (s + gap), (H - s) / 2, s, { pixel: 2, gain: 0.4 + (0.6 * (k + 1)) / n }));
  }, 8);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[1.25fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-rule bg-paper">
          <canvas ref={big} className="block aspect-square w-full" aria-label="The ball in its box" role="img" />
        </div>
        <Sheet className="flex flex-col gap-4">
          <div>
            <p className="type-narrow mb-2 text-xs tracking-[0.2em] text-ink-soft uppercase">What the model sees</p>
            <canvas ref={pixels} className="block aspect-square w-full rounded-xl" aria-label="The same frame as a 20 by 20 grid of greys" role="img" />
            <p className="mt-2 text-xs text-ink-soft">
              {SIDE}×{SIDE} = {PIXELS} greys. No positions, no velocities, no physics: just this.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Readout k="x" v={readout.x.toFixed(2)} />
            <Readout k="y" v={readout.y.toFixed(2)} />
            <Readout k="vx" v={(readout.vx * 100).toFixed(1)} />
            <Readout k="vy" v={(readout.vy * 100).toFixed(1)} />
          </div>
        </Sheet>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <HoldButton onHold={(d) => hold(1, d)} held={held === 1} ariaLabel="Hold to push left"><ArrowLeft className="size-4" /> Left</HoldButton>
        <HoldButton onHold={(d) => hold(3, d)} held={held === 3} ariaLabel="Hold to jump"><ArrowUp className="size-4" /> Jump</HoldButton>
        <HoldButton onHold={(d) => hold(2, d)} held={held === 2} ariaLabel="Hold to push right">Right <ArrowRight className="size-4" /></HoldButton>
        <Button variant="outline" onClick={() => world.current.kick()} className="rounded-xl">
          <Zap className="size-4" /> Kick
        </Button>
      </div>
      <div>
        <p className="type-narrow mb-2 text-xs tracking-[0.2em] text-ink-soft uppercase">Last few frames, every third step</p>
        <canvas ref={film} className="block h-12 w-full" aria-hidden />
      </div>
    </div>
  );
}

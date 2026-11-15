"use client";

import { useEffect, useRef } from "react";
import { grey, startLoop } from "@/kit";
import { useMind } from "../lib/store";
import { LiveWorld } from "../lib/sim";
import { Dreamer } from "../lib/dreamer";
import { PIXELS, SIDE } from "../lib/world";
import { brackets, label, paintFrame, paintStatic, phosphor } from "./draw";
import { fitLayout } from "./ui";

/*
 * Signature visual: reality and the model's dream, side by side, on two dithered screens.
 * The eyes open and close on a rhythm; while they're closed the right screen is pure imagination.
 * Tap anywhere to kick the ball (an impulse the model never sees coming).
 */

const OPEN = 36;
const CLOSED = 80;
const STEP_HZ = 16;

export function DaydreamHero() {
  const ref = useRef<HTMLCanvasElement>(null);
  const mind = useMind();
  const mindRef = useRef(mind);
  useEffect(() => {
    mindRef.current = mind;
  });

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let size = fitLayout(canvas, ctx);
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);

    const world = new LiveWorld(7);
    const realPh = new Float32Array(PIXELS);
    const dreamPh = new Float32Array(PIXELS);
    let dreamer: Dreamer | null = null;
    let seen: { vae: unknown; dyn: unknown } = { vae: null, dyn: null };
    let acc = 0;
    let cycle = 0;
    let flash = 0;

    const onDown = () => {
      world.kick();
      flash = 1;
    };
    canvas.addEventListener("pointerdown", onDown);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const frame = (t: number, dt: number) => {
      if (!visible) return;
      size = fitLayout(canvas, ctx);
      const m = mindRef.current;
      if (m.vae !== seen.vae || m.dyn !== seen.dyn) {
        seen = { vae: m.vae, dyn: m.dyn };
        dreamer = m.vae ? new Dreamer(m.vae, m.dyn) : null;
        dreamer?.see(world.frame);
        cycle = 0;
      }

      acc += Math.min(dt, 0.25);
      while (acc > 1 / STEP_HZ) {
        acc -= 1 / STEP_HZ;
        const { action } = world.tick();
        if (dreamer) {
          cycle++;
          if (dreamer.dyn) {
            if (dreamer.eyes === "open" && cycle >= OPEN) { dreamer.close(); cycle = 0; }
            else if (dreamer.eyes === "closed" && cycle >= CLOSED) { dreamer.open(); cycle = 0; }
          }
          dreamer.advance(world.frame, action);
        }
      }
      phosphor(realPh, world.frame, 0.7);
      if (dreamer) phosphor(dreamPh, dreamer.frame, 0.7);

      const { width: W, height: H } = size;
      ctx.fillStyle = grey(0);
      ctx.fillRect(0, 0, W, H);

      // faint dot grid
      ctx.fillStyle = grey(0.14);
      for (let y = 8; y < H; y += 16) for (let x = 8; x < W; x += 16) ctx.fillRect(x, y, 1, 1);

      const pad = Math.max(12, W * 0.04);
      const gap = Math.max(10, W * 0.03);
      const top = 30;
      const bottom = 34;
      const s = Math.floor(Math.min((W - 2 * pad - gap) / 2, H - top - bottom));
      const x0 = Math.round((W - (2 * s + gap)) / 2);
      const y0 = Math.round(top + (H - top - bottom - s) / 2);
      const x1 = x0 + s + gap;
      const px = Math.max(2, Math.round(s / 64));

      paintFrame(ctx, realPh, SIDE, x0, y0, s, { pixel: px, gain: 1 + flash * 0.6 });
      brackets(ctx, x0 - 4, y0 - 4, s + 8, s + 8, 10, 0.5);

      const closed = dreamer?.eyes === "closed";
      if (dreamer) {
        paintFrame(ctx, dreamPh, SIDE, x1, y0, s, { pixel: px, gain: closed ? 1 : 0.85, grain: closed ? 0.18 : 0.05, t });
      } else {
        paintStatic(ctx, x1, y0, s, t, px, 0.6);
      }
      brackets(ctx, x1 - 4, y0 - 4, s + 8, s + 8, 10, closed ? 1 : 0.5);

      // Labels
      label(ctx, "Reality", x0, y0 - 12, { level: 0.75 });
      label(ctx, closed ? "Dream" : dreamer ? "Its view" : "Dream", x1, y0 - 12, { level: closed ? 1 : 0.75 });
      const by = y0 + s + 22;
      label(ctx, "20×20 · tap to kick", x0, by, { level: 0.45, size: 9 });
      const status = !m.vae
        ? "no mind yet"
        : !m.dyn
          ? "sees · can't dream yet"
          : closed
            ? `eyes shut · ${dreamer?.dreaming ?? 0} steps`
            : "eyes open · watching";
      label(ctx, status, x1, by, { level: closed ? 0.95 : 0.45, size: 9 });

      // The eye glyph between the screens
      const ex = x0 + s + gap / 2;
      const ey = y0 + s / 2;
      const lid = closed ? 0.08 : m.dyn ? Math.min(1, 0.25 + 0.75 * Math.min(1, cycle / 6)) : 1;
      ctx.strokeStyle = grey(closed ? 1 : 0.6);
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.ellipse(ex, ey, Math.min(7, gap / 2 - 1), 4.5 * lid + 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (!closed) {
        ctx.fillStyle = grey(0.9);
        ctx.beginPath();
        ctx.arc(ex, ey, 1.6 * lid + 0.2, 0, Math.PI * 2);
        ctx.fill();
      }

      flash *= 0.85;
      if (reduced) return false;
    };

    const loop = startLoop(frame, 30);
    return () => {
      loop.stop();
      io.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
    };
  }, []);

  return <canvas ref={ref} aria-label="Reality and the model's dream, side by side" role="img" className="block h-full w-full cursor-crosshair touch-manipulation" />;
}

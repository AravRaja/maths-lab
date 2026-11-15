"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useCanvas } from "@/kit/components/use-canvas";
import { Sheet } from "@/kit/components/page-shell";
import { KbdKey } from "@/components/spectrumui/kbd-key";
import { grey } from "@/kit/canvas";
import { ENV } from "../lib/env";
import { drawScene, font, LightBuffer, TorchRunner } from "./scene";
import { Choice } from "./choice";

type Speed = "0.25" | "0.5" | "1";

/**
 * Before any maths: hold the torch up yourself. Same physics, same reward (+1 a step), but a human
 * can also coast. It is hard at full speed, which is the point.
 */
export function PlaySection() {
  const buf = useRef(new LightBuffer());
  const runner = useRef(new TorchRunner(7));
  const held = useRef({ left: false, right: false });
  const [speed, setSpeed] = useState<Speed>("0.5");
  const speedRef = useRef(0.5);
  const [best, setBest] = useState(0);
  const [tries, setTries] = useState(0);
  const lastHist = useRef(0);
  const started = useRef(false);

  useEffect(() => {
    speedRef.current = Number(speed);
  }, [speed]);

  const ref = useCanvas(
    ({ ctx, width, height, t, dt }) => {
      const r = runner.current;
      if (held.current.left || held.current.right) started.current = true;
      if (started.current) r.update(dt, () => {
        const { left, right } = held.current;
        const force = left === right ? 0 : left ? -ENV.forceMag : ENV.forceMag;
        return { action: force > 0 ? 1 : 0, force };
      }, speedRef.current);
      if (r.episodes !== lastHist.current) {
        lastHist.current = r.episodes;
        const last = r.history[r.history.length - 1];
        setTries(r.episodes);
        setBest((b) => Math.max(b, last));
      }
      ctx.fillStyle = grey(0);
      ctx.fillRect(0, 0, width, height);
      const { left, right } = held.current;
      drawScene(ctx, { x: 0, y: 0, w: width, h: height }, r.s, buf.current, {
        t,
        dark: r.dark,
        pixel: 3,
        seed: 2,
        push: left === right ? null : { dir: left ? -1 : 1, p: 1 },
      });
      ctx.fillStyle = grey(1);
      ctx.font = font(600, 28);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(String(r.steps), 14, 12);
      if (!started.current) {
        ctx.textAlign = "center";
        ctx.font = font(600, 12);
        ctx.fillStyle = grey(1, 0.6 + 0.4 * Math.sin(t * 3));
        ctx.fillText("HOLD A BUTTON TO START", width / 2, height * 0.86);
      }
    },
    { fps: 60 },
  );

  useEffect(() => {
    const set = (e: KeyboardEvent, v: boolean) => {
      // Only steal the arrow keys while the game is on screen.
      const box = ref.current?.getBoundingClientRect();
      if (v && (!box || box.bottom < 0 || box.top > window.innerHeight)) return;
      if (e.key === "ArrowLeft" || e.key === "a") held.current.left = v;
      else if (e.key === "ArrowRight" || e.key === "d") held.current.right = v;
      else return;
      if (v) e.preventDefault();
    };
    const down = (e: KeyboardEvent) => set(e, true);
    const up = (e: KeyboardEvent) => set(e, false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [ref]);

  const hold = (side: "left" | "right") => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      held.current[side] = true;
    },
    onPointerUp: () => (held.current[side] = false),
    onPointerCancel: () => (held.current[side] = false),
    onPointerLeave: () => (held.current[side] = false),
  });

  return (
    <div className="flex flex-col gap-4">
      <canvas ref={ref} aria-label="Your torch cart" className="block aspect-[16/10] w-full touch-none rounded-2xl border border-rule [image-rendering:pixelated]" />
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          aria-label="Push left"
          {...hold("left")}
          className="flex min-h-16 touch-none items-center justify-center gap-2 rounded-2xl border border-rule bg-sheet select-none active:bg-ink active:text-paper"
        >
          <ArrowLeft className="size-6" aria-hidden />
          <span className="type-narrow text-xs tracking-[0.2em] uppercase">Hold</span>
        </button>
        <button
          type="button"
          aria-label="Push right"
          {...hold("right")}
          className="flex min-h-16 touch-none items-center justify-center gap-2 rounded-2xl border border-rule bg-sheet select-none active:bg-ink active:text-paper"
        >
          <span className="type-narrow text-xs tracking-[0.2em] uppercase">Hold</span>
          <ArrowRight className="size-6" aria-hidden />
        </button>
      </div>
      <Sheet className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-6">
          <div>
            <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Your best</p>
            <p className="type-wide text-3xl tabular-nums">{best}</p>
          </div>
          <div>
            <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Tries</p>
            <p className="type-wide text-3xl tabular-nums">{tries}</p>
          </div>
          <div>
            <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">Max</p>
            <p className="type-wide text-3xl tabular-nums text-ink-soft">{ENV.maxSteps}</p>
          </div>
        </div>
        <Choice
          label="Game speed"
          value={speed}
          onChange={setSpeed}
          options={[
            { value: "0.25", label: "¼×" },
            { value: "0.5", label: "½×" },
            { value: "1", label: "1×" },
          ]}
        />
      </Sheet>
      <p className="hidden items-center gap-2 text-sm text-ink-soft sm:flex">
        Or use <KbdKey keyName="ArrowLeft">←</KbdKey> <KbdKey keyName="ArrowRight">→</KbdKey>. The agent only ever gets full left or full right,
        fifty times a second, and never coasts.
      </p>
      <p className="text-sm text-ink-soft sm:hidden">The agent only ever gets full left or full right, fifty times a second, and never coasts.</p>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { useCanvas } from "@/kit/components/use-canvas";
import { grey } from "@/kit/canvas";
import { getArena, useArena } from "../lib/store";
import type { AgentWeights } from "../lib/agent";
import { drawScene, font, layout, LightBuffer, TorchRunner, type Decide } from "./scene";
import { agentDecide, pilotDecide } from "./runtime";

/**
 * The signature visual: one torchbearer in the dark, the only light its own flame. Flown by a
 * hand-tuned controller until the user's PPO agent exists, then by the agent, live, as it trains.
 * Tap either side to shove the cart.
 */
export function TorchHero() {
  const buf = useRef(new LightBuffer());
  const runner = useRef(new TorchRunner(42));
  const ctrl = useRef<{ w: AgentWeights | null; d: Decide }>({ w: null, d: pilotDecide });
  const best = useRef(0);
  const arena = useArena();
  const [flash, setFlash] = useState<string | null>(null);
  const [agentFlying, setAgentFlying] = useState(false);
  const flown = arena.weights && agentFlying ? `your PPO agent · iteration ${arena.iter}` : "a hand-tuned controller";

  const ref = useCanvas(
    ({ ctx, width, height, t, dt }) => {
      const a = getArena();
      if (a.weights !== ctrl.current.w) {
        ctrl.current = { w: a.weights, d: (a.weights && agentDecide(a.weights, runner.current.rng, false)) || pilotDecide };
        setAgentFlying(ctrl.current.d !== pilotDecide);
      }
      const r = runner.current;
      r.update(dt, ctrl.current.d);
      best.current = Math.max(best.current, r.steps);
      ctx.fillStyle = grey(0);
      ctx.fillRect(0, 0, width, height);
      const v = { x: 0, y: 0, w: width, h: height };
      drawScene(ctx, v, r.s, buf.current, {
        t,
        dark: r.dark,
        pixel: width < 500 ? 3 : 4,
        push: r.lastProbs ? { dir: r.lastAction ? 1 : -1, p: r.lastProbs[r.lastAction] } : { dir: r.lastAction ? 1 : -1, p: 0.35 },
      });
      // Step counter: survival is the reward.
      const { groundY } = layout(v);
      ctx.fillStyle = grey(1, 0.9);
      ctx.font = font(600, width < 500 ? 34 : 48);
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText(String(r.steps).padStart(3, "0"), width - 14, 12);
      ctx.font = font(500, 10);
      ctx.fillStyle = grey(0.55);
      ctx.fillText(`STEPS UP · BEST ${best.current}`, width - 14, width < 500 ? 50 : 64);
      if (r.fallT >= 0 && r.reason) {
        ctx.textAlign = "center";
        ctx.fillStyle = grey(1, Math.max(0, 1 - r.fallT));
        ctx.font = font(600, 12);
        ctx.fillText(r.reason === "rail" ? "OFF THE RAIL" : "THE TORCH FELL", width / 2, groundY + 18);
      }
    },
    { fps: 50 },
  );

  return (
    <div className="relative h-full w-full">
      <canvas
        ref={ref}
        aria-label="A cart balancing a torch in the dark. Tap left or right of it to shove it."
        className="block h-full w-full touch-none [image-rendering:pixelated]"
        onPointerDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const left = e.clientX - rect.left < rect.width / 2;
          runner.current.push(left ? 18 : -18);
          setFlash(left ? "shove →" : "← shove");
          window.setTimeout(() => setFlash(null), 600);
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3">
        <p className="type-narrow rounded-lg bg-paper/70 px-2 py-1 text-[10px] tracking-[0.2em] text-ink-soft uppercase backdrop-blur-sm">
          Flown by <span className="text-ink">{flown}</span>
        </p>
        <p className="type-narrow text-[10px] tracking-[0.2em] text-ink-soft uppercase">{flash ?? "tap to shove"}</p>
      </div>
    </div>
  );
}

"use client";

import { useRef } from "react";
import { useCanvas } from "@/kit/components/use-canvas";
import { grey } from "@/kit/canvas";
import { getArena } from "../lib/store";
import type { AgentWeights } from "../lib/agent";
import { drawScene, font, LightBuffer, TorchRunner, type Decide } from "./scene";
import { agentDecide } from "./runtime";

const COUNT = 8;

/**
 * Eight torchbearers on one canvas, all flown by the latest weights from the trainer. Early on the
 * stage is mostly dark; as the policy improves, the lights stay on. `ghost` draws them unlit.
 */
export function ArenaGrid({ greedy, ghost }: { greedy?: boolean; ghost?: boolean }) {
  const buf = useRef(new LightBuffer());
  const runners = useRef(Array.from({ length: COUNT }, (_, i) => new TorchRunner(100 + i)));
  const ctrl = useRef<{ w: AgentWeights | null; greedy: boolean; d: Decide[] | null }>({ w: null, greedy: false, d: null });

  const ref = useCanvas(
    ({ ctx, width, height, t, dt }) => {
      const cols = width < 520 ? 2 : 4;
      const rows = Math.ceil(COUNT / cols);
      const gap = 6;
      const cw = (width - gap * (cols - 1)) / cols;
      const ch = (height - gap * (rows - 1)) / rows;
      const a = getArena();
      if (!ghost && (a.weights !== ctrl.current.w || !!greedy !== ctrl.current.greedy)) {
        ctrl.current = {
          w: a.weights,
          greedy: !!greedy,
          d: a.weights ? runners.current.map((r) => agentDecide(a.weights!, r.rng, !!greedy)).filter((d): d is Decide => d !== null) : null,
        };
        if (ctrl.current.d && ctrl.current.d.length !== COUNT) ctrl.current.d = null;
      }
      ctx.fillStyle = grey(0);
      ctx.fillRect(0, 0, width, height);
      runners.current.forEach((r, i) => {
        const d = ctrl.current.d?.[i];
        const v = { x: (i % cols) * (cw + gap), y: Math.floor(i / cols) * (ch + gap), w: cw, h: ch };
        if (d && !ghost) r.update(dt, d);
        drawScene(ctx, v, r.s, buf.current, {
          t: t + i * 1.7,
          dark: ghost || !d ? 0.92 : r.dark,
          pixel: 2,
          seed: i,
          posts: false,
          push: d && r.lastProbs ? { dir: r.lastAction ? 1 : -1, p: r.lastProbs[r.lastAction] } : null,
        });
        ctx.strokeStyle = grey(0.15);
        ctx.lineWidth = 1;
        ctx.strokeRect(v.x + 0.5, v.y + 0.5, v.w - 1, v.h - 1);
        ctx.fillStyle = grey(1, d && !ghost ? 0.9 : 0.3);
        ctx.font = font(600, 13);
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(String(r.steps), v.x + 8, v.y + 7);
        const last = r.history[r.history.length - 1];
        if (last !== undefined) {
          ctx.fillStyle = grey(0.5);
          ctx.font = font(500, 9);
          ctx.fillText(`LAST ${last}`, v.x + 8, v.y + 23);
        }
      });
    },
    { fps: 50 },
    [ghost, greedy],
  );

  return <canvas ref={ref} aria-label="Eight agents balancing torches with the current policy" className="block aspect-[4/5] w-full rounded-2xl border border-rule [image-rendering:pixelated] sm:aspect-[2/1]" />;
}

"use client";

import { useRef } from "react";
import { useCanvas } from "@/kit/components/use-canvas";
import { grey } from "@/kit/canvas";
import type { CartState } from "../lib/env";
import { drawScene, font, LightBuffer } from "./scene";

/** The torch at one moment, with a caption in the corner. Flickers, but the state is fixed. */
export function StillScene({ state, caption, className }: { state: CartState; caption?: string; className?: string }) {
  const buf = useRef(new LightBuffer());
  const ref = useCanvas(
    ({ ctx, width, height, t }) => {
      ctx.fillStyle = grey(0);
      ctx.fillRect(0, 0, width, height);
      drawScene(ctx, { x: 0, y: 0, w: width, h: height }, state, buf.current, { t, pixel: 3, seed: 5 });
      if (caption) {
        ctx.fillStyle = grey(1);
        ctx.font = font(600, 11);
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(caption, 10, 10);
      }
    },
    { fps: 24 },
  );
  return <canvas ref={ref} aria-hidden className={className ?? "block aspect-[16/9] w-full rounded-xl border border-rule [image-rendering:pixelated]"} />;
}

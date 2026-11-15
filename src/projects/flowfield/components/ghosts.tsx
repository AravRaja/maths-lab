"use client";

import { useCanvas } from "@/kit/components/use-canvas";
import { grey } from "@/kit/canvas";
import { gaussVec, mulberry32 } from "../lib/rng";
import { spiral } from "../lib/shapes";
import { makeView } from "../lib/view";
import { cn } from "@/lib/utils";
import { drawArrow } from "./draw";

/**
 * Static, dimmed previews for the "Yours to write" panels: a sketch of what each section will
 * draw once its core exists. Pure geometry, no cores.
 */
export type GhostKind = "lines" | "arrows" | "paths" | "cloud" | "arm";

export function GhostCanvas({ kind, className }: { kind: GhostKind; className?: string }) {
  const ref = useCanvas(
    ({ ctx, width, height }) => {
      ctx.clearRect(0, 0, width, height);
      const v = makeView(width, height, 2.3, 0);
      const rng = mulberry32(3);
      const data = spiral(140);
      ctx.strokeStyle = ctx.fillStyle = grey(1, 0.8);
      ctx.lineWidth = 1;
      if (kind === "lines" || kind === "paths") {
        for (let i = 0; i < 70; i++) {
          const a = gaussVec(rng, 2);
          const b = data[i * 2];
          ctx.beginPath();
          ctx.moveTo(v.x(a[0]), v.y(a[1]));
          if (kind === "lines") ctx.lineTo(v.x(b[0]), v.y(b[1]));
          else ctx.quadraticCurveTo(v.x((a[0] + b[0]) / 2 + 0.4 * b[1]), v.y((a[1] + b[1]) / 2 - 0.4 * b[0]), v.x(b[0]), v.y(b[1]));
          ctx.stroke();
          ctx.fillRect(v.x(b[0]) - 1.5, v.y(b[1]) - 1.5, 3, 3);
        }
      } else if (kind === "arrows") {
        for (let i = 0; i < 13; i++)
          for (let j = 0; j < 13; j++) {
            const x = -2 + (i * 4) / 12, y = -2 + (j * 4) / 12;
            const a = Math.atan2(y, x) + 2.4;
            drawArrow(ctx, v.x(x), v.y(y), v.x(x + 0.18 * Math.cos(a)), v.y(y + 0.18 * Math.sin(a)), 3);
          }
      } else if (kind === "cloud") {
        for (const p of data) ctx.fillRect(v.x(p[0]) - 1, v.y(p[1]) - 1, 2, 2);
        for (let i = 0; i < 300; i++) {
          const g = gaussVec(rng, 2);
          ctx.fillRect(v.x(g[0] * 0.5) - 0.75, v.y(g[1] * 0.5) - 0.75, 1.5, 1.5);
        }
      } else {
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(width * 0.2, height * 0.5);
        ctx.lineTo(width * 0.45, height * 0.8);
        ctx.lineTo(width * 0.6, height * 0.25);
        ctx.stroke();
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(width * 0.62, height * 0.5, width * 0.09, 0, Math.PI * 2);
        ctx.stroke();
      }
    },
    { animate: false },
    [kind],
  );
  return <canvas ref={ref} aria-hidden className={cn("aspect-square w-full", className)} />;
}

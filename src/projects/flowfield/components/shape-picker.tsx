"use client";

import { useRef, useState } from "react";
import { Eraser, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/kit/components/page-shell";
import { useCanvas } from "@/kit/components/use-canvas";
import { grey } from "@/kit/canvas";
import { SHAPE_POINTS } from "../lib/config";
import { PRESETS, presetShape, setShape, useShape, type Preset } from "../lib/shape-store";
import { normalise, resampleStrokes, type Pt } from "../lib/shapes";
import { makeView } from "../lib/view";
import { Chip, Kicker } from "./chip";
import { clear, drawGrid, drawPoints, label } from "./draw";

/*
 * The dataset for every 2D section: a maths glyph, a classic toy shape, or your own drawing.
 * Draw with a finger; the strokes are resampled to 320 points along their length.
 */
export function ShapePicker() {
  const shape = useShape();
  const [drawing, setDrawing] = useState(false);
  const strokes = useRef<Pt[][]>([]);
  const live = useRef(false);
  const [strokeCount, setStrokeCount] = useState(0);

  const ref = useCanvas(
    ({ ctx, width, height }) => {
      const v = makeView(width, height, 2.0, 4);
      clear(ctx, width, height);
      drawGrid(ctx, v, width, height);
      if (drawing) {
        ctx.strokeStyle = grey(1);
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        for (const s of strokes.current) {
          ctx.beginPath();
          s.forEach((p, i) => (i ? ctx.lineTo(v.x(p[0]), v.y(p[1])) : ctx.moveTo(v.x(p[0]), v.y(p[1]))));
          if (s.length === 1) ctx.lineTo(v.x(s[0][0]) + 0.1, v.y(s[0][1]));
          ctx.stroke();
        }
        label(ctx, strokes.current.length ? "lift and tap use" : "draw here", 12, 12);
      } else {
        drawPoints(ctx, v, shape.points, 2.2, grey(1, 0.9));
        label(ctx, `${shape.points.length} points · p_data`, 12, 12);
      }
    },
    { animate: drawing, fps: 60 },
    [shape, drawing, strokeCount],
  );

  const toWorld = (e: React.PointerEvent<HTMLCanvasElement>): Pt => {
    const r = e.currentTarget.getBoundingClientRect();
    return makeView(r.width, r.height, 2.0, 4).toWorld(e.clientX - r.left, e.clientY - r.top);
  };

  const pick = (id: Preset) => {
    setDrawing(false);
    setShape(presetShape(id));
  };

  const finish = () => {
    const pts = resampleStrokes(strokes.current, SHAPE_POINTS, 3);
    if (pts.length > 10) setShape({ id: "drawn", label: "your drawing", points: normalise(pts, 1.45) });
    setDrawing(false);
  };

  return (
    <Sheet className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Dataset">
        {PRESETS.map((id) => (
          <Chip key={id} active={!drawing && shape.id === id} onClick={() => pick(id)} className={id.length === 1 ? "font-serif text-lg" : "type-narrow text-xs tracking-[0.15em] uppercase"}>
            {id}
          </Chip>
        ))}
        <Chip
          active={drawing || shape.id === "drawn"}
          onClick={() => {
            strokes.current = [];
            setStrokeCount(0);
            setDrawing(true);
          }}
          className="type-narrow gap-2 text-xs tracking-[0.15em] uppercase"
        >
          <Pencil className="size-3.5" aria-hidden /> Draw
        </Chip>
      </div>
      <canvas
        ref={ref}
        aria-label={drawing ? "Drawing pad" : `Dataset: ${shape.label}`}
        className="aspect-square w-full touch-none rounded-xl border border-rule"
        onPointerDown={(e) => {
          if (!drawing) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          live.current = true;
          strokes.current.push([toWorld(e)]);
          setStrokeCount((n) => n + 1);
        }}
        onPointerMove={(e) => {
          if (!drawing || !live.current) return;
          const s = strokes.current[strokes.current.length - 1];
          const p = toWorld(e);
          const q = s[s.length - 1];
          if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.02) s.push(p);
        }}
        onPointerUp={() => (live.current = false)}
        onPointerCancel={() => (live.current = false)}
      />
      {drawing ? (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={() => {
              strokes.current = [];
              setStrokeCount(0);
            }}
          >
            <Eraser aria-hidden /> Clear
          </Button>
          <Button onClick={finish} disabled={strokeCount === 0}>
            Use drawing
          </Button>
        </div>
      ) : (
        <Kicker>
          Dataset: <span className="text-ink">{shape.label}</span>. Every section below learns or flows into it.
        </Kicker>
      )}
    </Sheet>
  );
}

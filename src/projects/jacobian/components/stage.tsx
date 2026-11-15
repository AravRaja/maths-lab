"use client";

import { useEffect, useRef } from "react";
import { useCanvas } from "@/kit/components/use-canvas";
import { cn } from "@/lib/utils";
import { GlowLayer, View, type Camera } from "./scene";
import type { Vec } from "../lib/linalg";

/*
 * A 3D stage: owns the camera, the dithered glow layer and the pointer. Each frame it calls
 *   step(f)   simulation (runs once per frame),
 *   back(f)   crisp things that sit behind the glow (the floor),
 *   glow(f)   soft shapes into the low-res layer (then dithered),
 *   crisp(f)  hairlines and labels on top at full resolution.
 *
 * interaction:
 *   "orbit"   drag to turn the camera
 *   "target"  press / drag to place a point on the camera-facing plane through `planeCenter` (onTarget)
 *   "none"
 */

export interface StageFrame {
  ctx: CanvasRenderingContext2D;
  glow: OffscreenCanvasRenderingContext2D;
  view: View;
  width: number;
  height: number;
  t: number;
  dt: number;
  /** Pointer position in CSS px, or null. */
  pointer: { x: number; y: number; down: boolean } | null;
  /** Seconds since the pointer last moved over / pressed the canvas. */
  idle: number;
}

export interface StageProps {
  camera: Camera;
  /** Auto-orbit speed in rad/s (paused while dragging). */
  autoRotate?: number;
  interaction?: "orbit" | "target" | "none";
  planeCenter?: Vec;
  onTarget?: (p: Vec) => void;
  step?: (f: StageFrame) => void;
  back?: (f: StageFrame) => void;
  glow?: (f: StageFrame) => void;
  crisp?: (f: StageFrame) => void;
  tones?: number[];
  pixel?: number;
  fps?: number;
  className?: string;
  ariaLabel?: string;
  animate?: boolean;
}

export function Stage({
  camera,
  autoRotate = 0,
  interaction = "none",
  planeCenter = [0.3, 0, 0.5],
  onTarget,
  step,
  back,
  glow,
  crisp,
  tones = [0, 0.14, 0.38, 0.7, 1],
  pixel = 3,
  fps = 40,
  className,
  ariaLabel,
  animate = true,
}: StageProps) {
  const cam = useRef<Camera>({ ...camera });
  const layer = useRef(new GlowLayer(pixel));
  const lastActive = useRef(-1e9);
  const now = useRef(0);
  const drag = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const view = useRef<View | null>(null);
  const cb = useRef({ step, back, glow, crisp, onTarget, interaction, planeCenter, autoRotate });
  useEffect(() => {
    cb.current = { step, back, glow, crisp, onTarget, interaction, planeCenter, autoRotate };
  });

  const ref = useCanvas(
    ({ ctx, width, height, t, dt, pointer }) => {
      now.current = t;
      const c = cb.current;
      if (c.autoRotate && !drag.current) cam.current.yaw += c.autoRotate * Math.min(dt, 0.1);
      const v = new View(cam.current, width, height);
      view.current = v;
      const f: StageFrame = { ctx, glow: null as unknown as OffscreenCanvasRenderingContext2D, view: v, width, height, t, dt: Math.min(dt, 0.1), pointer, idle: t - lastActive.current };
      c.step?.(f);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);
      c.back?.(f);
      f.glow = layer.current.begin(width, height);
      c.glow?.(f);
      layer.current.end(ctx, tones);
      c.crisp?.(f);
    },
    { fps, animate },
    [tones.join(",")],
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const local = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const place = (e: PointerEvent) => {
      const v = view.current;
      const c = cb.current;
      if (!v || !c.onTarget) return;
      const p = local(e);
      const hit = v.pick(p.x, p.y, c.planeCenter, v.facingNormal());
      if (hit) c.onTarget(hit);
    };
    const down = (e: PointerEvent) => {
      lastActive.current = now.current;
      const c = cb.current;
      if (c.interaction === "orbit") {
        const p = local(e);
        drag.current = { x: p.x, y: p.y, yaw: cam.current.yaw, pitch: cam.current.pitch };
        el.setPointerCapture(e.pointerId);
      } else if (c.interaction === "target") {
        drag.current = { x: 0, y: 0, yaw: 0, pitch: 0 };
        el.setPointerCapture(e.pointerId);
        place(e);
      }
    };
    const move = (e: PointerEvent) => {
      lastActive.current = now.current;
      const c = cb.current;
      if (c.interaction === "orbit" && drag.current) {
        const p = local(e);
        cam.current.yaw = drag.current.yaw - (p.x - drag.current.x) * 0.01;
        cam.current.pitch = Math.max(-0.1, Math.min(1.3, drag.current.pitch + (p.y - drag.current.y) * 0.008));
      } else if (c.interaction === "target" && (drag.current || e.pointerType === "mouse")) {
        place(e);
      }
    };
    const up = () => {
      drag.current = null;
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [ref]);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={ariaLabel}
      className={cn("block w-full [image-rendering:auto]", interaction !== "none" && "cursor-crosshair touch-none", className)}
    />
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dices, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Section, Sheet } from "@/kit/components/page-shell";
import { CoreError, CorePanel, runCore } from "@/kit/components/core-guard";
import { useCanvas } from "@/kit/components/use-canvas";
import { useWorker } from "@/kit/components/use-worker";
import { grey } from "@/kit/canvas";
import { isNotYoursYet, type NotYoursYet } from "@/kit/not-yours-yet";
import { decode, encode } from "../core/pca";
import type { Matrix, PCA } from "../core/types";
import { makeFaces } from "../lib/faces";
import { gaussian, rng } from "../lib/rng";
import type { handlers } from "../workers/rank.worker";
import { drawMatrix } from "./raster";
import { font } from "./canvas-font";
import { Field, Kicker, sliderValue } from "./ui-bits";

const NFACES = 200;
const K = 24;
const KEEP = 8;
const SLIDERS = 6;

interface Crowd {
  X: Matrix;
  w: number;
  h: number;
}

/** A wall of faces from the crowd: the data, before any maths. */
function CrowdWall({ crowd, rows = 3 }: { crowd: Crowd; rows?: number }) {
  const ref = useCanvas(
    ({ ctx, width, height }) => {
      ctx.clearRect(0, 0, width, height);
      const { X, w, h } = crowd;
      const th = height / rows, tw = (th * w) / h;
      const cols = Math.ceil(width / tw);
      const d = w * h;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const i = (r * cols + c) % X.rows;
          drawMatrix(ctx, X.data.subarray(i * d, (i + 1) * d), h, w, c * tw, r * th, tw - 2, th - 2, { dither: true, cell: 2, tones: [0, 0.35, 0.7, 1] }, "crowd");
        }
    },
    { animate: false },
    [crowd, rows],
  );
  return <canvas ref={ref} aria-label="the face crowd" className="block h-40 w-full sm:h-52" />;
}

function FaceTile({ values, w, h, range = [0, 1] as [number, number] | "symmetric", label, sub, strong }: { values: ArrayLike<number>; w: number; h: number; range?: [number, number] | "symmetric"; label?: string; sub?: string; strong?: boolean }) {
  const ref = useCanvas(
    ({ ctx, width, height }) => {
      ctx.clearRect(0, 0, width, height);
      drawMatrix(ctx, values, h, w, 0, 0, width, height, { range, dither: true, cell: width > 200 ? 3 : 2, tones: [0, 0.3, 0.62, 1] }, `face${w}`);
    },
    { animate: false },
    [values, w, h, range],
  );
  return (
    <figure className="flex min-w-0 flex-col gap-1.5">
      <canvas ref={ref} aria-label={label} className={`block w-full rounded-lg border ${strong ? "border-ink" : "border-rule"}`} style={{ aspectRatio: `${w} / ${h}` }} />
      {(label || sub) && (
        <figcaption className="flex items-baseline justify-between gap-1">
          <span className="truncate font-mono text-[11px]">{label}</span>
          {sub && <span className="font-mono text-[11px] text-ink-soft tabular-nums">{sub}</span>}
        </figcaption>
      )}
    </figure>
  );
}

/** Every face placed at its (c₁, c₂) coordinates as a tiny tile. Drag the crosshair to paint a face. */
function FaceSpace({ crowd, coeffs, sd, at, onMove }: { crowd: Crowd; coeffs: Float64Array; sd: number[]; at: [number, number]; onMove: (c: [number, number]) => void }) {
  const lastSent = useRef<[number, number]>(at);
  const sprite = useRef<{ crowd: Crowd; canvas: OffscreenCanvas } | null>(null);
  const ref = useCanvas(
    ({ ctx, width, height, pointer }) => {
      const R = 3.2;
      const toX = (z: number) => width / 2 + (z / R) * (width / 2 - 10);
      const toY = (z: number) => height / 2 - (z / R) * (height / 2 - 10);
      if (pointer?.down) {
        const z1 = ((pointer.x - width / 2) / (width / 2 - 10)) * R;
        const z2 = (-(pointer.y - height / 2) / (height / 2 - 10)) * R;
        const nz: [number, number] = [Math.max(-R, Math.min(R, z1)), Math.max(-R, Math.min(R, z2))];
        if (Math.abs(nz[0] - lastSent.current[0]) + Math.abs(nz[1] - lastSent.current[1]) > 0.02) {
          lastSent.current = nz;
          onMove(nz);
        }
      }
      ctx.fillStyle = grey(0);
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = grey(0.14);
      for (let g = -3; g <= 3; g++) {
        ctx.beginPath();
        ctx.moveTo(toX(g), 0);
        ctx.lineTo(toX(g), height);
        ctx.moveTo(0, toY(g));
        ctx.lineTo(width, toY(g));
        ctx.stroke();
      }
      const { X, w, h } = crowd;
      const d = w * h;
      if (sprite.current?.crowd !== crowd) {
        // Every face rendered once into a sprite sheet; each frame just blits from it.
        const sheet = new OffscreenCanvas(w * X.rows, h);
        const img = new ImageData(w * X.rows, h);
        for (let i = 0; i < X.rows; i++)
          for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
              const g = Math.round(Math.max(0, Math.min(1, X.data[i * d + y * w + x])) * 255);
              const o = (y * w * X.rows + i * w + x) * 4;
              img.data[o] = img.data[o + 1] = img.data[o + 2] = g;
              img.data[o + 3] = 255;
            }
        sheet.getContext("2d")!.putImageData(img, 0, 0);
        sprite.current = { crowd, canvas: sheet };
      }
      const tw = Math.max(10, width / 22), th = (tw * h) / w;
      ctx.imageSmoothingEnabled = false;
      for (let i = 0; i < X.rows; i++) {
        const x = toX(coeffs[i * KEEP] / sd[0]), y = toY(coeffs[i * KEEP + 1] / sd[1]);
        ctx.drawImage(sprite.current.canvas, i * w, 0, w, h, x - tw / 2, y - th / 2, tw, th);
      }
      const cx = toX(at[0]), cy = toY(at[1]);
      ctx.strokeStyle = grey(1);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, height);
      ctx.moveTo(0, cy);
      ctx.lineTo(width, cy);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
      font(ctx, 10, 500, "condensed");
      ctx.fillStyle = grey(0.6);
      ctx.fillText("EIGENFACE 1 →", width - 92, height / 2 - 6);
      ctx.save();
      ctx.translate(width / 2 + 12, 14);
      ctx.fillText("↑ EIGENFACE 2", 0, 0);
      ctx.restore();
    },
    { fps: 30 },
    [crowd, coeffs, sd, at],
  );
  return <canvas ref={ref} aria-label="face space: every face at its first two eigenface coordinates" className="block aspect-square w-full cursor-crosshair touch-none rounded-xl border border-rule" />;
}

export function FaceLab() {
  const worker = useWorker<typeof handlers>(() => new Worker(new URL("../workers/rank.worker.ts", import.meta.url)));
  const [crowd, setCrowd] = useState<Crowd | null>(null);
  const [model, setModel] = useState<{ pca: PCA; coeffs: Float64Array; ms: number } | null>(null);
  const [missing, setMissing] = useState<NotYoursYet | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [z, setZ] = useState<number[]>(() => Array(SLIDERS).fill(0));
  const [probe, setProbe] = useState(1);

  useEffect(() => {
    let alive = true;
    const go = () => {
      const w = worker.current;
      if (!w) return void setTimeout(go, 30);
      w.call("faces", { n: NFACES, seed: 7 })
        .then((c) => {
          if (!alive) return;
          setCrowd(c);
          return w.call("eigenfaces", { X: c.X, k: K, keep: KEEP }).then((m) => alive && setModel(m));
        })
        .catch((e: unknown) => {
          if (!alive) return;
          if (isNotYoursYet(e)) setMissing(e);
          else if (!(e instanceof Error && e.message === "Worker terminated")) setError(e instanceof Error ? e : new Error(String(e)));
        });
    };
    go();
    return () => {
      alive = false;
    };
  }, [worker]);

  const sd = useMemo(() => (model ? model.pca.variances.map(Math.sqrt) : []), [model]);
  const totalVar = useMemo(() => {
    if (!crowd) return 1;
    const { X } = crowd;
    let s = 0;
    for (let j = 0; j < X.cols; j++) {
      let m = 0, q = 0;
      for (let i = 0; i < X.rows; i++) m += X.data[i * X.cols + j];
      m /= X.rows;
      for (let i = 0; i < X.rows; i++) q += (X.data[i * X.cols + j] - m) ** 2;
      s += q / (X.rows - 1);
    }
    return s;
  }, [crowd]);

  const sculpt = useMemo(() => (model ? runCore(() => decode(z.map((v, i) => v * sd[i]), model.pca)) : null), [model, z, sd]);
  const held = useMemo(() => makeFaces(1, 900 + probe), [probe]);
  const ladder = useMemo(() => {
    if (!model) return null;
    return runCore(() => [1, 2, 4, 8, 16, K].map((k) => ({ k, img: decode(encode(held.X.data, model.pca, k), model.pca) })));
  }, [model, held]);

  const randomFace = () => {
    const g = gaussian(rng(Date.now() % 100000));
    setZ(Array.from({ length: SLIDERS }, () => Math.max(-2.5, Math.min(2.5, g()))));
  };

  const head = (
    <p className="mb-5 text-ink-soft">
      {NFACES} faces, drawn by a program (no real people), each {crowd ? `${crowd.w} × ${crowd.h}` : "28 × 32"} pixels: a cloud of points in
      896-dimensional space. PCA finds the few directions the crowd actually varies along. Those directions, drawn as images,
      are the eigenfaces.
    </p>
  );

  if (!crowd)
    return (
      <Section id="faces" index={6} kicker="PCA" title="Eigenfaces">
        {head}
        {error ? <CoreError error={error} /> : <Skeleton className="h-96 w-full rounded-2xl" />}
      </Section>
    );

  return (
    <Section id="faces" index={6} kicker="PCA" title="Eigenfaces">
      {head}
      <div className="flex flex-col gap-4">
        <Sheet className="flex flex-col gap-3 overflow-hidden">
          <Kicker>The crowd</Kicker>
          <CrowdWall crowd={crowd} />
        </Sheet>

        {missing ? (
          <CorePanel error={missing} ghost={<div className="p-4"><CrowdWall crowd={crowd} rows={4} /></div>} />
        ) : error ? (
          <CoreError error={error} />
        ) : !model ? (
          <Sheet className="flex items-center gap-3 text-sm text-ink-soft">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Your PCA is running on {NFACES} × 896 in a worker…
          </Sheet>
        ) : (
          <>
            <Sheet className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <Kicker>Mean face and the top eigenfaces</Kicker>
                <span className="font-mono text-xs text-ink-soft tabular-nums">{model.ms.toFixed(0)} ms</span>
              </div>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 sm:gap-3">
                <FaceTile values={model.pca.mean} w={crowd.w} h={crowd.h} label="mean" strong />
                {model.pca.components.slice(0, 11).map((c, i) => (
                  <FaceTile key={i} values={c} w={crowd.w} h={crowd.h} range="symmetric" label={`#${i + 1}`} sub={`${((100 * model.pca.variances[i]) / totalVar).toFixed(0)}%`} />
                ))}
              </div>
              <p className="text-sm text-ink-soft">
                Grey is zero, white and black are the two signs. The % is the share of the crowd’s variance along that direction.
                Can you name what the first three encode?
              </p>
            </Sheet>

            <Sheet className="flex flex-col gap-4">
              <Kicker>Face space · drag to paint a face that was never drawn</Kicker>
              <div className="grid gap-4 sm:grid-cols-[1.3fr_1fr]">
                <FaceSpace crowd={crowd} coeffs={model.coeffs} sd={sd} at={[z[0], z[1]]} onMove={([a, b]) => setZ((p) => [a, b, ...p.slice(2)])} />
                <div className="mx-auto flex w-1/2 flex-col gap-4 sm:w-full">
                  {sculpt?.status === "ok" ? (
                    <FaceTile values={sculpt.value} w={crowd.w} h={crowd.h} label="decode(c)" strong />
                  ) : sculpt?.status === "missing" ? (
                    <CorePanel error={sculpt.missing} />
                  ) : sculpt?.status === "error" ? (
                    <CoreError error={sculpt.error} />
                  ) : null}
                </div>
              </div>
              <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {z.map((v, i) => (
                  <Field key={i} label={`Eigenface ${i + 1}`} value={`${v >= 0 ? "+" : ""}${v.toFixed(1)}σ`}>
                    <Slider min={-3} max={3} step={0.05} value={[v]} onValueChange={(x) => setZ((p) => p.map((q, j) => (j === i ? sliderValue(x) : q)))} aria-label={`eigenface ${i + 1} weight`} />
                  </Field>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" className="min-h-11" onClick={randomFace}>
                  <Dices className="size-4" aria-hidden /> Random face
                </Button>
                <Button variant="outline" className="min-h-11" onClick={() => setZ(Array(SLIDERS).fill(0))}>
                  <RotateCcw className="size-4" aria-hidden /> Back to the mean
                </Button>
              </div>
            </Sheet>

            <Sheet className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Kicker>A stranger, rebuilt from k eigenfaces</Kicker>
                <Button variant="outline" className="min-h-11" onClick={() => setProbe((p) => p + 1)}>
                  <Dices className="size-4" aria-hidden /> New stranger
                </Button>
              </div>
              {ladder?.status === "ok" ? (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-7 sm:gap-3">
                  {ladder.value.map((r) => (
                    <FaceTile key={r.k} values={r.img} w={crowd.w} h={crowd.h} label={`k=${r.k}`} />
                  ))}
                  <FaceTile values={held.X.data} w={crowd.w} h={crowd.h} label="real" strong />
                </div>
              ) : ladder?.status === "missing" ? (
                <CorePanel error={ladder.missing} />
              ) : ladder?.status === "error" ? (
                <CoreError error={ladder.error} />
              ) : null}
              <p className="text-sm text-ink-soft">This face was not in the crowd PCA learnt from, so the last rung still differs a little from the real one.</p>
            </Sheet>
          </>
        )}
      </div>
    </Section>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Dices } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet } from "@/kit/components/page-shell";
import { CoreError, CorePanel, runCore } from "@/kit/components/core-guard";
import { useCanvas } from "@/kit/components/use-canvas";
import { gramSchmidt, projectOnto } from "../core/projection";
import { frobeniusError, tailEnergy } from "../core/error";
import type { Matrix, SVD } from "../core/types";
import { column, fromColumns } from "../lib/matrix";
import { factorColumn } from "../lib/svd";
import { randn } from "../lib/rng";
import { drawMatrix, fit } from "./raster";
import { Kicker } from "./ui-bits";
import { StaticImage } from "./compressor";
import { cn } from "@/lib/utils";

interface Contender {
  id: string;
  name: string;
  how: string;
  approx: Matrix;
  err: number;
}

/** Project every column of A onto span(Q) with the user's projectOnto. */
function projectColumns(A: Matrix, Q: Float64Array[]): Matrix {
  const cols = Array.from({ length: A.cols }, (_, j) => projectOnto(Q, column(A, j)));
  return fromColumns(cols, A.rows);
}

function Tile({ M, label, err, best }: { M: Matrix; label: string; err: number; best: boolean }) {
  const ref = useCanvas(
    ({ ctx, width, height }) => {
      ctx.clearRect(0, 0, width, height);
      const b = fit(M.rows, M.cols, width, height);
      drawMatrix(ctx, M.data, M.rows, M.cols, b.x, b.y, b.w, b.h, { dither: true, cell: 2, range: [0, 1] }, "rival");
    },
    { animate: false },
    [M],
  );
  return (
    <figure className={cn("flex min-w-0 flex-col gap-2 rounded-xl border p-2", best ? "border-ink" : "border-rule")}>
      <canvas ref={ref} aria-label={label} className="block aspect-square w-full rounded-lg" />
      <figcaption className="flex flex-col gap-0.5 px-0.5">
        <span className="type-narrow truncate text-xs tracking-[0.12em] uppercase">{label}</span>
        <span className="font-mono text-xs text-ink-soft tabular-nums">{(100 * err).toFixed(1)}%</span>
      </figcaption>
    </figure>
  );
}

export function Rivals({ A, svd, k }: { A: Matrix; svd: SVD | null; k: number }) {
  const [seed, setSeed] = useState(1);
  const result = useMemo(() => {
    if (!svd) return null;
    return runCore(() => {
      const m = A.rows;
      const zero: Matrix = { rows: A.rows, cols: A.cols, data: new Float64Array(A.data.length) };
      const norm = frobeniusError(A, zero) || 1;
      const random = gramSchmidt(Array.from({ length: k }, (_, i) => randn(m, seed * 7919 + i)));
      const step = A.cols / k;
      const pixels = gramSchmidt(Array.from({ length: k }, (_, i) => column(A, Math.min(A.cols - 1, Math.floor((i + 0.5) * step)))));
      const singular = Array.from({ length: Math.min(k, svd.S.length) }, (_, i) => factorColumn(svd.U, i));
      const make = (id: string, name: string, how: string, Q: Float64Array[]): Contender => {
        const approx = projectColumns(A, Q);
        return { id, name, how, approx, err: frobeniusError(A, approx) / norm };
      };
      const list = [
        make("random", "Random", `${k} random directions`, random),
        make("pixels", "Columns", `${k} of the picture’s own columns`, pixels),
        make("svd", "SVD", `top ${k} left singular vectors`, singular),
      ];
      return { list, bound: tailEnergy(svd.S, k) / norm };
    });
  }, [A, svd, k, seed]);

  if (!svd) return <Skeleton className="h-72 w-full rounded-2xl" />;
  if (result?.status === "missing")
    return (
      <CorePanel
        error={result.missing}
        ghost={
          <div className="grid grid-cols-3 gap-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="aspect-square overflow-hidden rounded-xl border border-rule">
                <StaticImage A={A} />
              </div>
            ))}
          </div>
        }
      />
    );
  if (result?.status === "error") return <CoreError error={result.error} />;
  if (!result) return null;
  const { list, bound } = result.value;
  // Log scale from half the floor up to 100%, so small differences near the floor stay visible.
  const lo = Math.log(Math.max(1e-9, Math.min(bound, ...list.map((c) => c.err)) / 2));
  const hi = Math.log(Math.max(1, ...list.map((c) => c.err)));
  const pos = (e: number) => Math.max(1, Math.min(100, (100 * (Math.log(Math.max(e, 1e-12)) - lo)) / (hi - lo || 1)));

  return (
    <Sheet className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {list.map((c) => (
          <Tile key={c.id} M={c.approx} label={c.name} err={c.err} best={c.id === "svd"} />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <Kicker>Error at rank {k}, log scale · the line is Eckart–Young’s floor</Kicker>
        <div className="relative flex flex-col gap-2">
          {list.map((c) => (
            <div key={c.id} className="grid grid-cols-[5.5rem_1fr] items-center gap-3">
              <span className="type-narrow truncate text-xs tracking-[0.12em] text-ink-soft uppercase">{c.name}</span>
              <div className="relative h-6 rounded-md bg-paper">
                <div
                  className={cn("h-full rounded-md transition-[width] duration-500", c.id === "svd" ? "bg-ink" : "bg-ink-soft/60")}
                  style={{ width: `${pos(c.err)}%` }}
                />
              </div>
            </div>
          ))}
          <div aria-hidden className="pointer-events-none absolute inset-y-0 left-[calc(5.5rem+0.75rem)] right-0">
            <div className="absolute inset-y-[-4px] w-px bg-ink" style={{ left: `${pos(bound)}%` }} />
          </div>
        </div>
        <p className="text-sm text-ink-soft">
          Floor: {(100 * bound).toFixed(2)}%. {list.map((c) => `${c.name}: ${c.how}.`).join(" ")}
        </p>
      </div>
      <div>
        <Button variant="outline" className="min-h-11" onClick={() => setSeed((s) => s + 1)}>
          <Dices className="size-4" aria-hidden /> Reroll the random directions
        </Button>
      </div>
    </Sheet>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { Section, Sheet } from "@/kit/components/page-shell";
import { useWorker } from "@/kit/components/use-worker";
import { useToast } from "@/kit/components/toast";
import { isNotYoursYet } from "@/kit/not-yours-yet";
import type { Matrix, SVD } from "../core/types";
import { IMG, PRESETS, fromImageData, presetImage, type PresetId } from "../lib/images";
import type { handlers } from "../workers/rank.worker";
import { Pills } from "./ui-bits";
import { Compressor } from "./compressor";
import { SpectrumView } from "./spectrum";
import { Rivals } from "./rivals";

export type Source = PresetId | "photo";

/** Read a dropped/picked photo into a greyscale matrix, longest side ≤ IMG px. */
async function photoToMatrix(file: File): Promise<Matrix> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, IMG / Math.max(bmp.width, bmp.height));
  const w = Math.max(8, Math.round(bmp.width * s)), h = Math.max(8, Math.round(bmp.height * s));
  const c = new OffscreenCanvas(w, h);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return fromImageData(ctx.getImageData(0, 0, w, h));
}

/**
 * Shared state for the image sections: the current picture, its library SVD (from the worker)
 * and the rank k. Renders the Compress, Spectrum and Rivals sections.
 */
export function ImageLab() {
  const toast = useToast();
  const worker = useWorker<typeof handlers>(() => new Worker(new URL("../workers/rank.worker.ts", import.meta.url)));
  const [source, setSource] = useState<Source>("portrait");
  const [A, setA] = useState<Matrix>(() => presetImage("portrait"));
  const [svd, setSvd] = useState<SVD | null>(null);
  const [sweep, setSweep] = useState(0);
  const [ms, setMs] = useState(0);
  const [k, setK] = useState(12);
  const fileRef = useRef<HTMLInputElement>(null);
  const job = useRef(0);

  const decompose = useCallback((M: Matrix) => {
    const id = ++job.current;
    const run = () => {
      const w = worker.current;
      if (!w) return void setTimeout(run, 30);
      w.call("svd", { A: M }, (p) => id === job.current && setSweep((p as { sweep: number }).sweep))
        .then((r) => {
          if (id !== job.current) return;
          setSvd(r.svd);
          setMs(r.ms);
          setK((k0) => Math.min(k0, r.svd.S.length));
        })
        .catch((e: unknown) => {
          if (!isNotYoursYet(e) && !(e instanceof Error && e.message === "Worker terminated")) toast({ title: "SVD failed", description: String(e), status: "error" });
        });
    };
    run();
  }, [worker, toast]);

  useEffect(() => {
    decompose(A);
  }, [A, decompose]);

  const pickPreset = (id: Source) => {
    if (id === "photo") return fileRef.current?.click();
    setSource(id);
    setSvd(null);
    setSweep(0);
    setA(presetImage(id));
  };

  const loadFile = async (file?: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    try {
      const M = await photoToMatrix(file);
      setSource("photo");
      setSvd(null);
      setSweep(0);
      setA(M);
      toast({ title: "Photo loaded", description: `${M.cols} × ${M.rows}, greyscale. It never leaves your browser.`, status: "neutral" });
    } catch {
      toast({ title: "Could not read that image", status: "error" });
    }
  };

  const r = svd?.S.length ?? Math.min(A.rows, A.cols);
  const hint = source === "photo" ? "Your photo, in greys. Everything runs in this tab." : PRESETS.find((p) => p.id === source)?.hint;
  const options = useMemo(() => [...PRESETS.map((p) => p.id), "photo"] as Source[], []);

  return (
    <div
      className="flex flex-col gap-12"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void loadFile(e.dataTransfer.files?.[0]);
      }}
    >
      <Section id="compress" index={2} kicker="Low rank" title="Squeeze a picture">
        <p className="mb-5 text-ink-soft">
          Any image is a matrix, and any matrix is a sum of rank-one layers σ<sub>i</sub>u<sub>i</sub>v<sub>i</sub>ᵀ. Keep the
          k strongest and throw the rest away. Drop a photo anywhere on this section, or pick a test image.
        </p>
        <div className="mb-4 flex flex-col gap-3">
          <Pills
            label="image"
            value={source}
            options={options}
            onChange={pickPreset}
            render={(o) =>
              o === "photo" ? (
                <span className="inline-flex items-center gap-1.5">
                  <ImagePlus className="size-4" aria-hidden /> Your photo
                </span>
              ) : (
                PRESETS.find((p) => p.id === o)?.label
              )
            }
          />
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => void loadFile(e.target.files?.[0])} />
          <p className="min-h-5 text-sm text-ink-soft">{hint}</p>
        </div>
        <Sheet className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <p className="type-narrow text-xs tracking-[0.2em] text-ink-soft uppercase">
              {A.cols} × {A.rows} · rank ≤ {r}
            </p>
            <p className="type-narrow inline-flex min-h-6 items-center gap-2 text-xs tracking-[0.2em] text-ink-soft uppercase">
              {svd ? (
                <>library SVD · {ms < 1000 ? `${ms.toFixed(0)} ms` : `${(ms / 1000).toFixed(1)} s`}</>
              ) : (
                <>
                  <Loader2 className="size-3 animate-spin" aria-hidden /> Jacobi sweep {sweep}
                </>
              )}
            </p>
          </div>
          <Compressor A={A} svd={svd} k={k} setK={setK} />
        </Sheet>
      </Section>

      <Section id="spectrum" index={3} kicker="Eckart–Young" title="The spectrum is the error">
        <p className="mb-5 text-ink-soft">
          The singular values say how much each layer matters. Eckart–Young says no rank-k matrix gets closer to the picture than
          the top k layers, and tells you exactly how close that is, from the σ’s alone. Drag across the bars to set k.
        </p>
        <SpectrumView A={A} svd={svd} k={k} setK={setK} />
      </Section>

      <Section id="rivals" index={4} kicker="Projections" title="Try to beat the SVD">
        <p className="mb-5 text-ink-soft">
          Every rank-k approximation of the form Q Qᵀ A projects the picture’s columns onto some k-dimensional subspace. Three
          contenders pick the subspace differently. Your Gram–Schmidt builds each basis and your projection does the rest.
        </p>
        <Rivals A={A} svd={svd} k={k} />
      </Section>
    </div>
  );
}

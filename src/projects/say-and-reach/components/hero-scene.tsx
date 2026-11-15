"use client";

import { useEffect, useRef } from "react";
import { useCanvas } from "@/kit/components/use-canvas";
import { HOME } from "@/projects/say-and-reach/lib/arm/config";
import { useAvailability, type Availability } from "@/projects/say-and-reach/lib/arm/availability";
import { sampleCommand, SUGGESTIONS } from "@/projects/say-and-reach/lib/arm/language";
import { makeRng } from "@/projects/say-and-reach/lib/arm/rng";
import { getPolicies } from "@/projects/say-and-reach/lib/arm/store";
import { randomObjects, randomScene, type Obj } from "@/projects/say-and-reach/lib/arm/world";
import { ditherBuf, makeView, type DitherBuf } from "./draw";
import { renderFrame } from "./render";
import { SimRunner } from "./sim-runner";

/*
 * The signature visual. An attract loop: a command types itself out, then the best policy the
 * page has (flow > Gaussian > scripted expert) does it on a dithered table, with the flow
 * head's noise-to-action particles streaming from the fingertip. Before the cores exist it
 * still runs: dithered table, objects, a dashed ghost arm, and the commands it is waiting for.
 */

const TYPE_RATE = 22; // characters per second

interface HeroState {
  rng: () => number;
  runner: SimRunner | null;
  objects: Obj[];
  text: string;
  epStart: number;
  doneAt: number | null;
  idx: number;
}

const MODE_LABEL = { expert: "Scripted expert", gaussian: "Learned · Gaussian head", flow: "Learned · flow head" } as const;

export function HeroScene() {
  const avail = useAvailability();
  const availRef = useRef<Availability | null>(null);
  useEffect(() => {
    availRef.current = avail;
  }, [avail]);

  const cmdEl = useRef<HTMLSpanElement>(null);
  const modeEl = useRef<HTMLSpanElement>(null);
  const buf = useRef<DitherBuf | null>(null);
  const st = useRef<HeroState | null>(null);

  const ref = useCanvas(
    ({ ctx, width, height, t, dt }) => {
      if (!st.current) {
        const rng = makeRng(20261115);
        st.current = { rng, runner: null, objects: randomObjects(rng), text: SUGGESTIONS[0], epStart: 0, doneAt: null, idx: 0 };
      }
      const s = st.current;
      const v = makeView(width, height, 2);
      buf.current = ditherBuf(buf.current, width, height, 3);
      const a = availRef.current;
      let mode = "";

      if (!a || a.fk || a.ik) {
        // No reaching yet: cycle the commands it is waiting for.
        if (t - s.epStart > s.text.length / TYPE_RATE + 2.6) {
          s.idx = (s.idx + 1) % SUGGESTIONS.length;
          s.text = SUGGESTIONS[s.idx];
          s.epStart = t;
        }
        const theta = a && !a.fk ? HOME.map((h, i) => h + [0.45, 0.55, 0.75][i] * Math.sin(t * [0.6, 0.9, 1.4][i] + i)) : null;
        renderFrame(ctx, v, buf.current, t, null, { objects: s.objects, theta });
        mode = !a ? "" : a.fk ? "Waiting for forwardKinematics()" : "Forward kinematics only · waiting for IK";
      } else {
        const r = s.runner;
        if (!r || (!r.running && s.doneAt !== null && t - s.doneAt > 1.4)) {
          const pol = getPolicies();
          const m = pol.flow && !a.flow ? "flow" : pol.gaussian ? "gaussian" : "expert";
          const scene = randomScene(s.rng);
          let cmd = sampleCommand(s.rng, "heldout");
          const runner = new SimRunner(scene);
          if (!runner.run(cmd.text, m, pol, { particles: 28, seed: Math.floor(s.rng() * 1e6) })) {
            cmd = sampleCommand(s.rng, "train");
            runner.run(cmd.text, "expert", pol);
          }
          runner.stop(); // hold still while the command types out
          s.runner = runner;
          s.text = cmd.text;
          s.epStart = t;
          s.doneAt = null;
        }
        const run = s.runner!;
        const typed = t - s.epStart > s.text.length / TYPE_RATE + 0.25;
        if (typed && run.steps === 0 && !run.running && s.doneAt === null) run.running = true;
        run.tick(dt);
        if (!run.running && run.steps > 0 && s.doneAt === null) s.doneAt = t;
        renderFrame(ctx, v, buf.current, t, run, {});
        mode = MODE_LABEL[run.mode] + (run.success ? " · done" : "");
      }

      const n = Math.min(s.text.length, Math.floor((t - s.epStart) * TYPE_RATE));
      const shown = s.text.slice(0, n) + (n < s.text.length || Math.floor(t * 2) % 2 ? "▍" : "");
      if (cmdEl.current && cmdEl.current.textContent !== shown) cmdEl.current.textContent = shown;
      if (modeEl.current && modeEl.current.textContent !== mode) modeEl.current.textContent = mode;
    },
    { fps: 30, maxDpr: 2 },
  );

  return (
    <div className="relative h-full w-full bg-paper">
      <canvas ref={ref} aria-hidden className="block h-full w-full touch-none" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-paper via-paper/70 to-transparent px-4 pt-10 pb-3 sm:px-5">
        <span ref={modeEl} className="type-narrow block text-[11px] tracking-[0.2em] text-ink-soft uppercase" />
        <span ref={cmdEl} aria-live="off" className="type-semi block truncate text-xl leading-tight sm:text-2xl" />
      </div>
    </div>
  );
}

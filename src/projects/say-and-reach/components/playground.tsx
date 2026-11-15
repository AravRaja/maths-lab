"use client";

import { useEffect, useRef, useState } from "react";
import { CornerDownLeft, RotateCcw, Shuffle } from "lucide-react";
import { CorePanel } from "@/kit/components/core-guard";
import { Sheet } from "@/kit/components/page-shell";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TextStates } from "@/components/spectrumui/text-states";
import { useAvailability } from "@/projects/say-and-reach/lib/arm/availability";
import type { Mode } from "@/projects/say-and-reach/lib/arm/controllers";
import { describeTask, OBJECTS, parseCommand, SUGGESTIONS } from "@/projects/say-and-reach/lib/arm/language";
import { makeRng } from "@/projects/say-and-reach/lib/arm/rng";
import { wordSaliency } from "@/projects/say-and-reach/lib/arm/saliency";
import { usePolicies } from "@/projects/say-and-reach/lib/arm/store";
import { randomScene } from "@/projects/say-and-reach/lib/arm/world";
import { isNotYoursYet, type NotYoursYet } from "@/kit/not-yours-yet";
import { cn } from "@/lib/utils";
import { renderFrame } from "./render";
import { SimRunner } from "./sim-runner";
import { TableCanvas } from "./table-canvas";

/*
 * The main event: type a command and pick who does it. The scripted expert only understands
 * its keywords; the learned heads read the embedding and will try anything you type.
 */

const MODES: { value: Mode; label: string }[] = [
  { value: "expert", label: "Expert" },
  { value: "gaussian", label: "Gaussian" },
  { value: "flow", label: "Flow" },
];

interface Ui {
  running: boolean;
  steps: number;
  success: boolean;
  attention: number[] | null;
}

export function Playground() {
  const avail = useAvailability();
  const policies = usePolicies();
  const [text, setText] = useState("push the cube left");
  const [mode, setMode] = useState<Mode>("expert");
  const [ui, setUi] = useState<Ui>({ running: false, steps: 0, success: false, attention: null });
  const [note, setNote] = useState<string>("");
  const [saliency, setSaliency] = useState<{ word: string; score: number }[] | null>(null);
  const [missing, setMissing] = useState<NotYoursYet | null>(null);
  const runner = useRef<SimRunner | null>(null);
  const rng = useRef<(() => number) | null>(null);

  // Live training: swap fresh weights into a running learned episode.
  useEffect(() => {
    runner.current?.refresh(policies);
  }, [policies]);

  // Mirror the runner into React a few times a second.
  useEffect(() => {
    const id = window.setInterval(() => {
      const r = runner.current;
      if (!r) return;
      if (r.error && isNotYoursYet(r.error)) setMissing(r.error);
      setUi((u) => {
        const next = { running: r.running, steps: r.steps, success: r.success, attention: r.info?.attention ?? null };
        return u.running === next.running && u.steps === next.steps && u.success === next.success && u.attention?.[0] === next.attention?.[0] ? u : next;
      });
    }, 150);
    return () => window.clearInterval(id);
  }, []);

  if (avail?.ik) return <CorePanel error={avail.ik} ghost={<TableCanvas animate={false} />} />;

  const ensure = () => {
    rng.current ??= makeRng(1234);
    runner.current ??= new SimRunner(randomScene(rng.current));
    return runner.current;
  };

  const go = (cmd = text, m = mode) => {
    const r = ensure();
    const ok = r.run(cmd, m, policies, { particles: 24, seed: Math.floor(Math.random() * 1e6) });
    if (!ok) {
      setNote(
        m === "expert"
          ? "The expert only knows its keywords (an object and a direction, or touch). Try a learned head: they will have a go at anything."
          : `Train the ${m === "gaussian" ? "Gaussian" : "flow"} head first (section 05).`,
      );
      return;
    }
    setMissing(null);
    const task = parseCommand(cmd);
    setNote(task ? `Parsed as: ${describeTask(task)}` : "No keywords found. The learned policy is improvising from the words alone.");
    const w = m === "gaussian" ? policies.gaussian : m === "flow" ? policies.flow : undefined;
    try {
      setSaliency(w && m !== "expert" ? wordSaliency(m, w, r.start, cmd) : null);
    } catch (e) {
      if (isNotYoursYet(e)) setMissing(e);
      setSaliency(null);
    }
  };

  const available: Record<Mode, boolean> = { expert: true, gaussian: !!policies.gaussian, flow: !!policies.flow && !avail?.flow };

  return (
    <div className="flex flex-col gap-4">
      <Sheet className="flex flex-col gap-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            go();
          }}
        >
          <label htmlFor="cmd" className="sr-only">
            Command
          </label>
          <input
            id="cmd"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="push the cube left"
            className="type-semi h-11 min-w-0 flex-1 rounded-xl border border-rule bg-paper px-3 text-base outline-none placeholder:text-ink-soft focus-visible:border-ink"
          />
          <Button type="submit" size="icon" aria-label="Run command">
            <CornerDownLeft />
          </Button>
        </form>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setText(s);
                go(s);
              }}
              className="min-h-11 rounded-full border border-rule px-3 text-sm text-ink-soft transition-colors hover:border-ink hover:text-ink"
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ToggleGroup
            value={[mode]}
            onValueChange={(v: unknown[]) => {
              const m = (v[0] as Mode | undefined) ?? mode;
              setMode(m);
              if (available[m]) go(text, m);
            }}
            variant="outline"
            spacing={0}
            aria-label="Who does it"
          >
            {MODES.map((m) => (
              <ToggleGroupItem key={m.value} value={m.value} className="h-11 px-4 aria-pressed:bg-ink aria-pressed:text-paper data-pressed:bg-ink data-pressed:text-paper">
                {m.label}
                {!available[m.value] && <span className="text-[10px] text-ink-soft">·untrained</span>}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" aria-label="Replay" onClick={() => go()}>
              <RotateCcw />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="New scene"
              onClick={() => {
                const r = ensure();
                r.setScene(randomScene(rng.current!));
                setSaliency(null);
              }}
            >
              <Shuffle />
            </Button>
          </div>
        </div>
        <p className="min-h-5 text-sm text-ink-soft">
          <TextStates text={note || "Type a command, or tap a suggestion."} />
        </p>
      </Sheet>

      <div className="relative">
        <TableCanvas
          label="Tabletop: the arm follows your command"
          draw={({ ctx, v, buf, t, dt }) => {
            if (!avail) return; // not probed yet (first paint)
            const r = ensure();
            r.tick(dt);
            renderFrame(ctx, v, buf, t, r, {});
          }}
        />
        <div className="pointer-events-none absolute top-3 right-3 left-3 flex items-start justify-between gap-2">
          <span className="type-narrow rounded-full border border-rule bg-paper/80 px-2.5 py-1 text-[11px] tracking-[0.18em] uppercase">
            {MODES.find((m) => m.value === mode)?.label} · step {ui.steps}
          </span>
          {ui.success && <span className="type-narrow rounded-full bg-ink px-2.5 py-1 text-[11px] tracking-[0.18em] text-paper uppercase">Done</span>}
        </div>
      </div>

      {missing && <CorePanel error={missing} />}

      {mode !== "expert" && (ui.attention || saliency) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Sheet>
            <p className="type-narrow mb-3 text-xs tracking-[0.2em] text-ink-soft uppercase">Looking at</p>
            <ul className="flex flex-col gap-2">
              {OBJECTS.map((o, i) => {
                const a = ui.attention?.[i] ?? 0;
                return (
                  <li key={o} className="flex items-center gap-3">
                    <span className="w-14 text-sm">{o}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-rule">
                      <span className="block h-full rounded-full bg-ink transition-[width] duration-300" style={{ width: `${(a * 100).toFixed(1)}%` }} />
                    </span>
                    <span className="w-10 text-right font-mono text-xs tabular-nums">{a.toFixed(2)}</span>
                  </li>
                );
              })}
            </ul>
          </Sheet>
          <Sheet>
            <p className="type-narrow mb-3 text-xs tracking-[0.2em] text-ink-soft uppercase">Words that moved the action</p>
            <p className="flex flex-wrap gap-x-2 gap-y-1 text-lg leading-snug">
              {(saliency ?? []).map((s, i) => (
                <span
                  key={i}
                  className={cn("type-semi underline decoration-2 underline-offset-4")}
                  style={{ opacity: 0.3 + 0.7 * s.score, textDecorationColor: `rgb(255 255 255 / ${s.score.toFixed(2)})` }}
                >
                  {s.word}
                </span>
              ))}
            </p>
            <p className="mt-2 text-xs text-ink-soft">Drop one word at a time and measure how far the first action moves.</p>
          </Sheet>
        </div>
      )}
    </div>
  );
}

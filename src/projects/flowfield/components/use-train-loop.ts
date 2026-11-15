"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Run an async `burst` (train a few steps in the worker, update the page) back to back until
 * stopped. Errors stop the loop and are handed to `onError`.
 */
export function useTrainLoop(burst: () => Promise<void>, onError: (e: unknown) => void) {
  const [running, setRunning] = useState(false);
  const flag = useRef(false);
  const burstRef = useRef(burst);
  const errRef = useRef(onError);
  useEffect(() => {
    burstRef.current = burst;
    errRef.current = onError;
  });
  useEffect(() => () => void (flag.current = false), []);

  const start = async () => {
    if (flag.current) return;
    flag.current = true;
    setRunning(true);
    try {
      while (flag.current) await burstRef.current();
    } catch (e) {
      errRef.current(e);
    } finally {
      flag.current = false;
      setRunning(false);
    }
  };
  const stop = () => {
    flag.current = false;
  };
  return { running, start, stop, flag };
}

/** Exponential moving average, downsampled to every `every` steps, as [step, value] pairs. */
export function emaSeries(prev: [number, number][], losses: number[], firstStep: number, every = 10, alpha = 0.04): [number, number][] {
  const out = prev.slice();
  let ema = out.length ? out[out.length - 1][1] : losses[0] ?? 0;
  losses.forEach((l, i) => {
    if (!Number.isFinite(l)) return;
    ema = ema + alpha * (l - ema);
    const s = firstStep + i;
    if (s % every === 0) out.push([s, ema]);
  });
  return out.length > 600 ? out.filter((_, i) => i % 2 === 0 || i === out.length - 1) : out;
}

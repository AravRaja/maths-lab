"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A 0→1 clock for scrubbable animations: `t` for the slider, `tRef` for canvas loops.
 * While playing, t sweeps 0→1 over `seconds` and loops (with a short hold at 1).
 */
export function usePlay(initial = 0.5, seconds = 3) {
  const [t, setTState] = useState(initial);
  const [playing, setPlaying] = useState(false);
  const tRef = useRef(initial);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let hold = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (tRef.current >= 1) {
        hold += dt;
        if (hold > 0.8) {
          hold = 0;
          tRef.current = 0;
        }
      } else tRef.current = Math.min(1, tRef.current + dt / seconds);
      setTState(tRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, seconds]);

  const setT = (v: number) => {
    tRef.current = v;
    setTState(v);
  };
  return { t, setT, tRef, playing, setPlaying };
}

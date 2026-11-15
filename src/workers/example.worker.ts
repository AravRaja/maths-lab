/// <reference lib="webworker" />
import { exposeWorker } from "@/lib/kit/worker";
import { softmax } from "@/core/softmax";

/**
 * Example worker: draws n samples from softmax(logits / τ) and streams progress.
 * Heavy loops (training, rollouts, sampling) belong in workers like this one.
 * If the core is still a stub, NotYoursYet crosses back to the page and the panel shows.
 */
export const handlers = {
  sample(args: { logits: number[]; temperature: number; n: number }, progress: (v: unknown) => void) {
    const p = softmax(args.logits, args.temperature);
    const counts = new Array<number>(p.length).fill(0);
    for (let i = 0; i < args.n; i++) {
      let u = Math.random(), k = 0;
      while (k < p.length - 1 && u > p[k]) u -= p[k++];
      counts[k]++;
      if (i % 5000 === 0) progress(i / args.n);
    }
    return counts;
  },
};

exposeWorker(handlers);

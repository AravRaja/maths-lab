import { exposeWorker } from "@/kit/worker";
import { PpoTrainer, type IterStats, type PpoConfig } from "@/projects/ppo-arena/lib/ppo";

/*
 * PPO runs here so the page keeps drawing at 60 fps. The page drives it one chunk at a time:
 * `init` builds a fresh trainer, each `iterate` runs n PPO iterations and returns stats plus a
 * weight snapshot. Pausing is just not asking for the next chunk.
 * A NotYoursYet thrown by any core comes back to the page intact.
 */

let trainer: PpoTrainer | null = null;

export const handlers = {
  init(args: { config: Partial<PpoConfig> }) {
    trainer = new PpoTrainer(args.config);
    return trainer.weights();
  },

  tune(args: Partial<Pick<PpoConfig, "lr" | "clip" | "entCoef" | "lambda" | "valueClip">>) {
    trainer?.tune(args);
    return true;
  },

  iterate(args: { n: number }, progress: (v: unknown) => void) {
    if (!trainer) trainer = new PpoTrainer();
    const stats: IterStats[] = [];
    for (let k = 0; k < args.n; k++) {
      const s = trainer.iterate();
      stats.push(s);
      progress(s);
    }
    return { stats, weights: trainer.weights() };
  },
};

exposeWorker(handlers);

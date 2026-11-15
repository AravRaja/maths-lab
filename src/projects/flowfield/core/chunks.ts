import { notYoursYet } from "@/kit/not-yours-yet";
import type { ChunkPrediction } from "./types";

const FILE = "src/projects/flowfield/core/chunks.ts";

/**
 * Temporal ensembling of action chunks (Zhao et al., 2023, ACT; the idea π0-style policies build on).
 *
 * The policy predicts H future actions at once. If it replans every control step, several chunks,
 * made at different times, each contain an action for the current step. Blend them with exponential
 * weights, oldest prediction first:
 *
 *   Maths:   a_t = Σᵢ wᵢ a⁽ⁱ⁾_t / Σᵢ wᵢ,      wᵢ = exp(−m · i),   i = 0 for the oldest chunk covering step t
 *
 * Signature: temporalEnsemble(chunks: ChunkPrediction[], step: number, m: number) => number[] | null
 *   chunk.actions[k] is the action chunk.start + k. Only chunks with start ≤ step < start + length count.
 *   The input order is arbitrary. Return null if no chunk covers `step`. m ≥ 0.
 *
 * On paper first:
 *  - What do m = 0 and m → ∞ give?
 *  - Why might weighting the *older* predictions more make the arm smoother, not laggier?
 *  - Each chunk from a flow is a sample: two chunks can come from different modes (left of the obstacle,
 *    right of it). What happens to their average? When is ensembling a bad idea?
 */
export function temporalEnsemble(chunks: ChunkPrediction[], step: number, m: number): number[] | null {
  void chunks;
  void step;
  void m;
  throw notYoursYet({
    file: FILE,
    fn: "temporalEnsemble",
    milestone: "m6-action-chunks",
    summary: "Blends the overlapping action chunks that all cover the current step.",
  });
}

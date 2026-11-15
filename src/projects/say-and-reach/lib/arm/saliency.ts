import type { PolicyNet } from "@/projects/say-and-reach/lib/nn/policy-net";
import { embedTokens, tokenize } from "./language";
import { flowPaths, gaussianAct } from "./policy";
import { observe, OBS_DIM, type Scene } from "./world";

/**
 * Which words matter: drop each word in turn and measure how far the policy's action moves.
 * Returned scores are normalised so the most important word is 1.
 */
export function wordSaliency(mode: "gaussian" | "flow", w: PolicyNet, scene: Scene, text: string): { word: string; score: number }[] {
  const toks = tokenize(text);
  const obs = new Float32Array(OBS_DIM);
  const act = (tokens: string[]): number[] => {
    observe(scene, embedTokens(tokens), obs);
    if (mode === "gaussian") return gaussianAct(w, obs).mu;
    const p = flowPaths(w, obs, [[0, 0]])[0];
    return p[p.length - 1];
  };
  const base = act(toks);
  const raw = toks.map((_, i) => {
    const a = act(toks.filter((__, j) => j !== i));
    return Math.hypot(a[0] - base[0], a[1] - base[1]);
  });
  const mx = Math.max(1e-9, ...raw);
  return toks.map((word, i) => ({ word, score: raw[i] / mx }));
}

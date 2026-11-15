import { describe, expect, it } from "vitest";
import { makeDataset, vaeTrainer, dynTrainer, VAE_DEFAULTS, DYN_DEFAULTS } from "../../lib/train";
import { encode, decode } from "../../lib/vae";

/*
 * End to end: with all your cores written, a small VAE trained through them must learn to see
 * the ball, and the dynamics model trained through gaussianNLL must get better at predicting.
 * (Runs a downsized 12×12 world so it finishes in a few seconds.)
 */
describe("m3 + m4 · training through your cores", () => {
  const data = makeDataset(12, 80, 3, 12);

  it("the VAE's ELBO climbs and reconstructions land on the ball", () => {
    const tr = vaeTrainer(data, { ...VAE_DEFAULTS, hidden: 48, steps: 700, batch: 24, lr: 3e-3 });
    const first = tr.next().elbo;
    for (let s = 1; s < 700; s++) tr.next();
    expect(tr.ema.elbo).toBeGreaterThan(first + 10);

    // A reconstruction should be closer to its own frame than to a random other frame.
    let wins = 0;
    for (let k = 0; k < 40; k++) {
      const i = (k * 37) % data.frames.length;
      const j = (k * 101 + 17) % data.frames.length;
      const rec = decode(tr.weights, encode(tr.weights, data.frames[i]).mu);
      let ei = 0, ej = 0;
      for (let p = 0; p < rec.length; p++) { ei += Math.abs(rec[p] - data.frames[i][p]); ej += Math.abs(rec[p] - data.frames[j][p]); }
      if (ei < ej) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(32);

    const dyn = dynTrainer(tr.weights, data, { ...DYN_DEFAULTS, steps: 500, batch: 12, horizon: 4 });
    let early = 0, late = 0;
    for (let s = 1; s <= 500; s++) {
      const { loss } = dyn.next();
      if (s <= 30) early += loss / 30;
      if (s > 470) late += loss / 30;
    }
    expect(Number.isFinite(late)).toBe(true);
    expect(late).toBeLessThan(early - 1);
  }, 60000);
});

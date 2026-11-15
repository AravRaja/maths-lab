import { describe, expect, it } from "vitest";
import { filmBackward, filmForward, initFilm, FilmAdam } from "../film";
import { makeRng } from "@/projects/say-and-reach/lib/arm/rng";

/* Plumbing test (always passes): the FiLM network's hand-written backprop matches finite differences. */

describe("FiLM network", () => {
  const rng = makeRng(3);
  const dims: [number, number, number, number] = [5, 4, 6, 3];
  const B = 3;
  const s = Float32Array.from({ length: B * 5 }, () => rng() * 2 - 1);
  const w = Float32Array.from({ length: B * 4 }, () => rng() * 2 - 1);
  const c = Float32Array.from({ length: B * 3 }, () => rng() * 2 - 1);
  // loss = Σ c ⊙ out, so dLoss/dOut = c
  const lossOf = (m: ReturnType<typeof initFilm>) => filmForward(m, s, w, B).out.reduce((a, v, i) => a + v * c[i], 0);

  it("backprop matches central finite differences for every parameter group", () => {
    const m = initFilm(dims, rng, 1);
    for (const p of ["W1", "b1", "F", "f", "W2", "b2", "W3", "b3"] as const) m[p].forEach((_, i) => (m[p][i] += (rng() - 0.5) * 0.4));
    const g = filmBackward(m, filmForward(m, s, w, B), c);
    for (const p of ["W1", "b1", "F", "f", "W2", "b2", "W3", "b3"] as const) {
      for (const i of [0, Math.floor(m[p].length / 2), m[p].length - 1]) {
        const old = m[p][i];
        const h = 1e-2;
        m[p][i] = old + h; const up = lossOf(m);
        m[p][i] = old - h; const dn = lossOf(m);
        m[p][i] = old;
        expect(g[p][i]).toBeCloseTo((up - dn) / (2 * h), 2);
      }
    }
  });

  it("Adam drives a regression loss down", () => {
    const m = initFilm(dims, makeRng(9));
    const opt = new FilmAdam(m, 1e-2);
    const mse = () => { const o = filmForward(m, s, w, B).out; return o.reduce((a, v, i) => a + (v - c[i]) ** 2, 0); };
    const before = mse();
    for (let k = 0; k < 300; k++) {
      const f = filmForward(m, s, w, B);
      opt.step(filmBackward(m, f, f.out.map((v, i) => 2 * (v - c[i]))));
    }
    expect(mse()).toBeLessThan(before * 0.05);
  });
});

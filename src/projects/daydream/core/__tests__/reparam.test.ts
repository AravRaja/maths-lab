import { describe, expect, it } from "vitest";
import { reparameterise, reparameteriseBackward } from "../reparam";
import { fd, normals, rand, vec } from "./helpers";

describe("m1 · reparameterise", () => {
  it("is μ when ε = 0, whatever the variance", () => {
    expect(reparameterise([0.3, -2], [4, -3], [0, 0])).toEqual([0.3, -2]);
  });

  it("uses σ = exp(½ logvar), not exp(logvar)", () => {
    const z = reparameterise([1], [Math.log(9)], [1]);
    expect(z[0]).toBeCloseTo(4, 10); // σ = 3
  });

  it("has the right length and leaves its inputs alone", () => {
    const mu = [1, 2, 3];
    const lv = [0, 0, 0];
    const eps = [1, 1, 1];
    const z = reparameterise(mu, lv, eps);
    expect(z).toHaveLength(3);
    expect(mu).toEqual([1, 2, 3]);
    expect(eps).toEqual([1, 1, 1]);
  });

  it("produces samples with mean μ and variance exp(logvar) (Monte Carlo)", () => {
    const r = rand(3);
    const mu = [0.7, -1.2];
    const lv = [Math.log(0.25), Math.log(4)];
    const n = 40000;
    const s = [0, 0], s2 = [0, 0];
    for (let k = 0; k < n; k++) {
      const z = reparameterise(mu, lv, normals(r, 2));
      for (let i = 0; i < 2; i++) { s[i] += z[i]; s2[i] += z[i] * z[i]; }
    }
    for (let i = 0; i < 2; i++) {
      const m = s[i] / n;
      const v = s2[i] / n - m * m;
      expect(m).toBeCloseTo(mu[i], 1);
      expect(v / Math.exp(lv[i])).toBeGreaterThan(0.95);
      expect(v / Math.exp(lv[i])).toBeLessThan(1.05);
    }
  });
});

describe("m1 · reparameteriseBackward", () => {
  it("matches finite differences of L = Σ c_i z_i² (gradient check)", () => {
    const r = rand(11);
    const d = 4;
    const mu = vec(r, d);
    const lv = vec(r, d, -2, 1);
    const eps = normals(r, d);
    const c = vec(r, d);
    const L = (m: number[], l: number[]) => reparameterise(m, l, eps).reduce((s, z, i) => s + c[i] * z * z, 0);
    const z = reparameterise(mu, lv, eps);
    const dz = z.map((zi, i) => 2 * c[i] * zi);
    const { dmu, dlogvar } = reparameteriseBackward(lv, eps, dz);
    for (let i = 0; i < d; i++) {
      expect(dmu[i]).toBeCloseTo(fd((m) => L(m, lv), mu, i), 6);
      expect(dlogvar[i]).toBeCloseTo(fd((l) => L(mu, l), lv, i), 6);
    }
  });

  it("passes dz straight through to μ", () => {
    const { dmu } = reparameteriseBackward([3, -1], [0.5, 2], [0.25, -4]);
    expect(dmu).toEqual([0.25, -4]);
  });

  it("gives zero logvar gradient when ε = 0", () => {
    const { dlogvar } = reparameteriseBackward([1, 2], [0, 0], [5, -5]);
    expect(Math.abs(dlogvar[0]) + Math.abs(dlogvar[1])).toBe(0);
  });
});

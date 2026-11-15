import { describe, expect, it } from "vitest";
import { rodrigues, so3Log, invertSE3 } from "../se3";
import { Rx, Ry, Rz, cross, dot, eye, fromRp, matMul, matVec, norm, transpose, type Mat } from "../../lib/linalg";
import { expectMatClose, expectRotation, expectVecClose, randomUnit, rng, rotAbout } from "./helpers";

/*
 * SO(3) and SE(3). Rotations here are built WITHOUT Rodrigues (by conjugating a z-rotation),
 * so these tests check your formula against geometry, not against another copy of itself.
 */

const u = rng(7);
const randomRotation = (): Mat => rotAbout(randomUnit(u), (u() * 2 - 1) * Math.PI * 0.999);

describe("rodrigues", () => {
  it("matches the elementary rotations about x, y and z", () => {
    for (const t of [-2.5, -0.3, 0.7, 1.9, Math.PI]) {
      expectMatClose(rodrigues([1, 0, 0], t), Rx(t), 1e-12, "about x");
      expectMatClose(rodrigues([0, 1, 0], t), Ry(t), 1e-12, "about y");
      expectMatClose(rodrigues([0, 0, 1], t), Rz(t), 1e-12, "about z");
    }
  });

  it("is a proper rotation that leaves its axis fixed", () => {
    for (let i = 0; i < 20; i++) {
      const k = randomUnit(u);
      const R = rodrigues(k, (u() * 2 - 1) * 4);
      expectRotation(R, 1e-12);
      expectVecClose(matVec(R, k), k, 1e-12, "R k = k");
    }
  });

  it("turns a perpendicular vector by θ, right-handed about the axis", () => {
    for (let i = 0; i < 20; i++) {
      const k = randomUnit(u);
      const v0 = cross(k, randomUnit(u));
      const v = v0.map((x) => x / norm(v0));
      const t = (u() * 2 - 1) * 3;
      const Rv = matVec(rodrigues(k, t), v);
      expect(dot(Rv, v)).toBeCloseTo(Math.cos(t), 12);
      expect(dot(cross(v, Rv), k)).toBeCloseTo(Math.sin(t), 12);
    }
  });

  it("agrees with an independently built rotation about any axis", () => {
    for (let i = 0; i < 20; i++) {
      const k = randomUnit(u);
      const t = (u() * 2 - 1) * 3;
      expectMatClose(rodrigues(k, t), rotAbout(k, t), 1e-12);
    }
  });

  it("normalises the axis, and a zero axis or zero angle gives the identity", () => {
    const k = randomUnit(u);
    expectMatClose(rodrigues(k.map((x) => 3.7 * x), 0.8), rodrigues(k, 0.8), 1e-12, "scaled axis");
    expectMatClose(rodrigues([0, 0, 0], 1.3), eye(3), 0, "zero axis");
    expectMatClose(rodrigues(k, 0), eye(3), 1e-15, "zero angle");
  });

  it("adds angles about the same axis, and −θ is the transpose", () => {
    const k = randomUnit(u);
    expectMatClose(matMul(rodrigues(k, 0.4), rodrigues(k, 1.1)), rodrigues(k, 1.5), 1e-12, "R(a)R(b) = R(a+b)");
    expectMatClose(rodrigues(k, -0.9), transpose(rodrigues(k, 0.9)), 1e-12, "R(−θ) = R(θ)ᵀ");
  });
});

describe("so3Log", () => {
  it("is zero for the identity", () => {
    expectVecClose(so3Log(eye(3)), [0, 0, 0], 1e-15);
  });

  it("reads θ k back from rotations about known axes", () => {
    for (let i = 0; i < 30; i++) {
      const k = randomUnit(u);
      const t = u() * 3.1;
      expectVecClose(so3Log(rotAbout(k, t)), k.map((x) => x * t), 1e-9, `θ = ${t.toFixed(3)}`);
    }
  });

  it("returns ‖ω‖ in [0, π] for any rotation (a big negative angle comes back as a positive one)", () => {
    const k = randomUnit(u);
    const w = so3Log(rotAbout(k, -2.0));
    expect(norm(w)).toBeCloseTo(2.0, 10);
    expectVecClose(w, k.map((x) => -2 * x), 1e-9);
    for (let i = 0; i < 20; i++) {
      const n = norm(so3Log(randomRotation()));
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(Math.PI + 1e-12);
    }
  });

  it("is accurate for tiny angles (no 0/0)", () => {
    const k = randomUnit(u);
    for (const t of [1e-4, 1e-7, 1e-10]) {
      const w = so3Log(rotAbout(k, t));
      expect(w.every(Number.isFinite)).toBe(true);
      expectVecClose(w, k.map((x) => x * t), t * 1e-3, `θ = ${t}`);
    }
  });

  it("finds the axis at and near θ = π (up to sign at exactly π)", () => {
    for (let i = 0; i < 10; i++) {
      const k = randomUnit(u);
      for (const t of [Math.PI, Math.PI - 1e-6, Math.PI - 1e-3]) {
        const w = so3Log(rotAbout(k, t));
        expect(w.every(Number.isFinite)).toBe(true);
        expect(norm(w)).toBeCloseTo(t, 5);
        // Parallel to k (either sign at exactly π).
        expect(Math.abs(dot(w, k)) / norm(w)).toBeCloseTo(1, 5);
        if (t < Math.PI - 1e-4) expect(dot(w, k)).toBeGreaterThan(0);
      }
    }
  });

  it("round-trips with rodrigues", () => {
    for (let i = 0; i < 30; i++) {
      const R = randomRotation();
      const w = so3Log(R);
      expectMatClose(rodrigues(w, norm(w)), R, 1e-9);
    }
  });
});

describe("invertSE3", () => {
  const randomT = () => fromRp(randomRotation(), [u() * 2 - 1, u() * 2 - 1, u() * 2 - 1].map((x) => 3 * x));

  it("undoes the transform on both sides", () => {
    for (let i = 0; i < 20; i++) {
      const T = randomT();
      const Ti = invertSE3(T);
      expectMatClose(matMul(T, Ti), eye(4), 1e-12, "T T⁻¹");
      expectMatClose(matMul(Ti, T), eye(4), 1e-12, "T⁻¹ T");
    }
  });

  it("is a rigid transform itself, with the rotation block exactly Rᵀ (closed form, no general inverse)", () => {
    const T = randomT();
    const Ti = invertSE3(T);
    expect(Ti[3]).toEqual([0, 0, 0, 1]);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) expect(Ti[r][c]).toBe(T[c][r]);
  });

  it("does not modify its input", () => {
    const T = randomT();
    const copy = T.map((r) => r.slice());
    invertSE3(T);
    expect(T).toEqual(copy);
  });
});

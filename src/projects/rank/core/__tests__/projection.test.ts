import { describe, expect, it } from "vitest";
import { gramSchmidt, projectOnto } from "../projection";
import { dot, norm, randVec } from "./helpers";

function orthoError(Q: Float64Array[]): number {
  let e = 0;
  for (let i = 0; i < Q.length; i++) for (let j = 0; j < Q.length; j++) e = Math.max(e, Math.abs(dot(Q[i], Q[j]) - (i === j ? 1 : 0)));
  return e;
}

describe("gramSchmidt", () => {
  it("does the hand example", () => {
    const Q = gramSchmidt([Float64Array.from([3, 4, 0]), Float64Array.from([1, 1, 1])]);
    expect(Q.length).toBe(2);
    expect(Array.from(Q[0])).toEqual([0.6, 0.8, 0].map((x) => expect.closeTo(x, 12)));
    expect(dot(Q[0], Q[1])).toBeCloseTo(0, 12);
    expect(norm(Q[1])).toBeCloseTo(1, 12);
  });

  it("returns an orthonormal basis that spans the inputs", () => {
    const A = Array.from({ length: 6 }, (_, i) => randVec(10, i + 1));
    const Q = gramSchmidt(A);
    expect(Q.length).toBe(6);
    expect(orthoError(Q)).toBeLessThan(1e-12);
    // Every input is reproduced by its components along Q (computed here, not with projectOnto).
    for (const a of A) {
      const r = Float64Array.from(a);
      for (const q of Q) {
        const d = dot(q, a);
        for (let i = 0; i < r.length; i++) r[i] -= d * q[i];
      }
      expect(norm(r)).toBeLessThan(1e-10);
    }
    // span(q_1..q_j) = span(a_1..a_j): q_j is orthogonal to a_1..a_{j-1}.
    for (let j = 1; j < 6; j++) for (let i = 0; i < j; i++) expect(Math.abs(dot(Q[j], A[i]))).toBeLessThan(1e-10);
  });

  it("drops dependent and zero vectors", () => {
    const a = randVec(5, 3), b = randVec(5, 4);
    const sum = a.map((x, i) => x + 2 * b[i]);
    const Q = gramSchmidt([a, new Float64Array(5), b, sum]);
    expect(Q.length).toBe(2);
    expect(orthoError(Q)).toBeLessThan(1e-12);
  });

  it("first vector is a positive multiple of the first input, and inputs are not mutated", () => {
    const a = Float64Array.from([0, -2, 0]);
    const copy = Float64Array.from(a);
    const Q = gramSchmidt([a, Float64Array.from([1, 1, 1])]);
    expect(Array.from(Q[0])).toEqual([0, -1, 0].map((x) => expect.closeTo(x, 12)));
    expect(Array.from(a)).toEqual(Array.from(copy));
  });

  it("stays orthogonal on nearly parallel vectors (Läuchli)", () => {
    const e = 1e-7;
    const Q = gramSchmidt([Float64Array.from([1, e, 0, 0]), Float64Array.from([1, 0, e, 0]), Float64Array.from([1, 0, 0, e])]);
    expect(Q.length).toBe(3);
    expect(orthoError(Q)).toBeLessThan(1e-6);
  });
});

describe("projectOnto", () => {
  it("zeroes the out-of-plane part for the xy-plane", () => {
    const P = projectOnto([Float64Array.from([1, 0, 0]), Float64Array.from([0, 1, 0])], Float64Array.from([3, -2, 7]));
    expect(Array.from(P)).toEqual([3, -2, 0].map((x) => expect.closeTo(x, 12)));
  });

  it("projects onto a line", () => {
    const s = Math.SQRT1_2;
    const P = projectOnto([Float64Array.from([s, s])], Float64Array.from([2, 0]));
    expect(Array.from(P)).toEqual([1, 1].map((x) => expect.closeTo(x, 12)));
  });

  it("is idempotent, leaves an orthogonal residual, and obeys Pythagoras", () => {
    // Orthonormal basis built inside the test (not with gramSchmidt).
    const n = 9;
    const raw = [randVec(n, 11), randVec(n, 12), randVec(n, 13)];
    const Q: Float64Array[] = [];
    for (const v of raw) {
      const w = Float64Array.from(v);
      for (let pass = 0; pass < 2; pass++) for (const q of Q) { const d = dot(q, w); for (let i = 0; i < n; i++) w[i] -= d * q[i]; }
      const nw = norm(w);
      Q.push(w.map((x) => x / nw));
    }
    const x = randVec(n, 99);
    const xCopy = Float64Array.from(x);
    const Px = projectOnto(Q, x);
    const PPx = projectOnto(Q, Px);
    for (let i = 0; i < n; i++) expect(PPx[i]).toBeCloseTo(Px[i], 12);
    const r = x.map((v, i) => v - Px[i]);
    for (const q of Q) expect(dot(q, r)).toBeCloseTo(0, 12);
    expect(dot(x, x)).toBeCloseTo(dot(Px, Px) + dot(r, r), 10);
    expect(Array.from(x)).toEqual(Array.from(xCopy));
    // Vectors already in the span come back unchanged.
    const inSpan = Q[0].map((v, i) => 2 * v - 3 * Q[2][i]);
    const back = projectOnto(Q, inSpan);
    for (let i = 0; i < n; i++) expect(back[i]).toBeCloseTo(inSpan[i], 12);
  });

  it("is the closest point in the span", () => {
    const n = 6;
    const q1 = randVec(n, 5);
    const nq = norm(q1);
    const Q = [q1.map((v) => v / nq)];
    const x = randVec(n, 6);
    const Px = projectOnto(Q, x);
    const best = norm(x.map((v, i) => v - Px[i]));
    for (const t of [-2, -0.5, 0.3, 1.7]) {
      const y = Q[0].map((v) => v * t);
      expect(norm(x.map((v, i) => v - y[i]))).toBeGreaterThanOrEqual(best - 1e-12);
    }
  });

  it("handles the empty basis", () => {
    const P = projectOnto([], Float64Array.from([1, 2]));
    expect(Array.from(P)).toEqual([0, 0]);
  });
});

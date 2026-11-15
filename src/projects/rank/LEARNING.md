# Learning path

Five milestones, thirteen functions in `src/projects/rank/core/`. Each milestone is a page of paper first, a few functions, a test file that says when you are right, and a part of `/rank` that lights up. Keep `npm run dev` open on `/rank` next to `npx vitest src/projects/rank/core` (watch mode), or check one file at a time with the commands below.

The rule: derive it on paper before you type. The stubs' JSDoc has the spec and some questions, never the answer. The library SVD in `src/projects/rank/lib/svd.ts` is given (treat it like `numpy.linalg.svd`), and `src/projects/rank/lib/matrix.ts` has the boring helpers (`matvec`, `matTvec`, `transpose`, `column`). Shapes and layouts are in `src/projects/rank/core/types.ts`: matrices are row-major, and an SVD's `U` is m × r with column j being u_j.

<a id="m1-projection"></a>
## M1: Projections

Everything in this project is a projection in disguise: low-rank approximation projects an image's columns onto the top singular vectors, PCA projects faces onto the eigenfaces. Start with the plain version.

**Derive on paper**
- For an orthonormal basis q_1 … q_k (the columns of Q), show P = QQᵀ satisfies P² = P and Pᵀ = P, and that x − Px is orthogonal to every q_i. Use that to prove ‖x‖² = ‖Px‖² + ‖x − Px‖², and that Px is the closest point of the span to x.
- If the basis A is independent but not orthonormal, minimise ‖x − Ac‖² over c and get the normal equations. Why does QQᵀ x drop out when AᵀA = I?
- Gram–Schmidt by hand on (3, 4, 0), (1, 1, 1). Then compare the classical and modified versions on the Läuchli vectors (1, ε, 0, 0), (1, 0, ε, 0), (1, 0, 0, ε), treating 1 + ε² as 1. Which keeps q₂ · q₃ ≈ 0?
- When should a vector be dropped as "already in the span"? Why must that test be relative to the vector's own length?

**Write**: `gramSchmidt` and `projectOnto` in `src/projects/rank/core/projection.ts`.

**Check**
- `npx vitest run src/projects/rank/core/__tests__/projection.test.ts`: the hand example, orthonormality and span, dropped dependent vectors, the Läuchli stress test, idempotence, the orthogonal residual, Pythagoras and closest-point.
- Predict before you run it: in *Cast a shadow*, switch from Plane to Line without moving the sliders. Can the mean squared residual go down? Say why not before you look, using the M1 Pythagoras identity.

**Unlocks**: in *Cast a shadow*, your orthonormal q₁, q₂ appear (solid) over the skewed a, b (dashed), and all 320 points drop onto the plane with their residual lines. Together with M3 it also unlocks *Try to beat the SVD*.

<a id="m2-rank-k"></a>
## M2: Rank-k approximation

**Derive on paper**
- Write A = UΣVᵀ as a sum of rank-one layers σᵢuᵢvᵢᵀ. Why is each layer rank one, and what is its column space?
- Write A_k as a product of three truncated matrices. Give every shape for a 160 × 160 image at k = 12, then write entry (a, b) of A_k as a sum over i.
- Count the numbers needed to store A_k exactly. For an m × n image, find the k where storing the factors stops beating storing the pixels.
- Two test images, before you scrub: the *Checker* board is built from 20-pixel squares, and *Plaid* is a sum of three outer products. What rank is each? Write the checkerboard as a sum of outer products to be sure.

**Write**: `rankK` and `storageCost` in `src/projects/rank/core/lowrank.ts`.

**Check**
- `npx vitest run src/projects/rank/core/__tests__/lowrank.test.ts`: the diagonal example, k = 0 and k ≥ r, wide matrices, rank at most k, exact recovery of a rank-2 matrix, no mutation, and storage counts.
- Predict before you run it: on *Triangle* (white below the diagonal), will rank 5 look like a triangle with blurred edges, or like something else entirely? Then look at the *error* view.

**Unlocks**: the hero switches from showing single layers to rebuilding the portrait rank by rank. *Squeeze a picture* gets the wipe viewer (drag it), rank scrubbing on any test image or your own photo, the error view and the storage readout. The layer strip ends in your A_k.

<a id="m3-eckart-young"></a>
## M3: Eckart–Young

**Derive on paper**
- Show ‖M‖_F² = trace(MᵀM), and that multiplying by an orthogonal matrix on either side leaves ‖M‖_F unchanged. Conclude ‖A‖_F² = Σσᵢ².
- Write A − A_k as a sum of layers, and so find ‖A − A_k‖_F in terms of the σ's alone.
- Prove that no rank-k matrix B does better. Sketch: B's null space has dimension at least n − k, so it meets span(v₁ … v_{k+1}) in some unit vector w. Bound ‖(A − B)w‖ from below, then turn that into a bound on the Frobenius norm. The Frobenius version needs one more step (look up Weyl's inequality for singular values, or prove it for the spectral norm first).
- "99% of the energy" means Σ_{i≤k} σᵢ² / Σ σᵢ² = 0.99. What relative error ‖A − A_k‖_F / ‖A‖_F is that?

**Write**: `frobeniusError`, `tailEnergy` and `energyCaptured` in `src/projects/rank/core/error.ts`.

**Check**
- `npx vitest run src/projects/rank/core/__tests__/error.test.ts`: closed forms, ‖A‖_F = √Σσ², tailEnergy against the measured error of the truncated SVD at every k, 20 random rank-k rivals that never beat it, and energyCaptured's endpoints and consistency.
- Predict before you run it: on *Noise*, apart from σ₁ (the average brightness) the singular values are all of similar size. Sketch the relative error against k before you look. Is it closer to a straight line or a fast-falling curve?

**Unlocks**: in *The spectrum is the error*, the energy readouts (90%, 99%, 99.9% at which k) and the error plot, where your measured error (dotted) should sit exactly on the prediction from σ (solid). The compressor's error readout. With M1, *Try to beat the SVD*: a random subspace, the picture's own columns and the top singular vectors compete at rank k, and the Eckart–Young floor shows that none can cross it.

<a id="m4-power"></a>
## M4: Power iteration

Now drop the library and find σ₁ yourself.

**Derive on paper**
- Expand v₀ = Σcᵢvᵢ in the right singular vectors. What is (AᵀA)ᵗv₀? What has to be true about c₁, and what happens if σ₁ = σ₂?
- Show that tan ∠(v_t, v₁) shrinks by a factor of about (σ₂/σ₁)² per iteration. Then show that the error in σ_t = ‖Av_t‖ shrinks about twice as fast in log terms: it is a Rayleigh quotient, so it is "second order" in the angle.
- Why apply A and then Aᵀ (2mn flops) instead of forming AᵀA (mn² flops, and its condition number is the square of A's)?
- Deflation: if (σ, u, v) is the top triple, what are the singular values of A − σuvᵀ? Repeating this k times gives a top-k SVD. Which triples will be least accurate, and why?

**Write**: `powerIteration` and `deflate` in `src/projects/rank/core/power.ts`.

**Check**
- `npx vitest run src/projects/rank/core/__tests__/power.test.ts`: the top triple of a random matrix, Av = σu, exactly `iters` iterations with tol = 0, a non-decreasing σ history, early stopping, the (σ₂/σ₁)² convergence rate, deflation, and power + deflate recovering three singular values.
- Predict before you run it: in *Find σ₁ by hand*, set σ₂/σ₁ = 0.90. What number will the *Angle shrinks ×* readout settle on? How many iterations until the angle is below 10⁻⁶?

**Unlocks**: the power-iteration race. A random start vector (faint) morphs into v₁ (dashed) over 40 iterations, the rank-one picture σ_t u_t v_tᵀ sharpens beside it, and the log-error chart shows both slopes. *Race the library* runs your power + deflate 16 times on a portrait, plots your σ's over the library's and, with M2, rebuilds the portrait from your own SVD.

<a id="m5-eigenfaces"></a>
## M5: PCA and eigenfaces

**Derive on paper**
- With the centred data X̃ (n × d, rows are samples), the sample covariance is C = X̃ᵀX̃/(n − 1). Substitute X̃ = UΣVᵀ. Which matrix holds C's eigenvectors, and what are the eigenvalues in terms of σᵢ and n?
- There are 200 faces of 28 × 32 = 896 pixels. How many non-zero variances can there be, at most? Why is an SVD of X̃ cheaper and more accurate than forming the 896 × 896 matrix C?
- Without centring, what does the first "component" turn out to be? (Look at layer 1 of any photo in the compressor.)
- Encoding cᵢ = qᵢᵀ(x − μ) is a projection in coordinates. Show that decode(encode(x, k)) is the best approximation of x by μ plus k components, and that its error never increases with k.
- What face is c = 0? What is c = (3√λ₁, 0, 0, …)?

**Write**: `meanCenter`, `pca`, `encode` and `decode` in `src/projects/rank/core/pca.ts`.

**Check**
- `npx vitest run src/projects/rank/core/__tests__/pca.test.ts`: centring, orthonormal components, eigenvectors and eigenvalues of the sample covariance, the trace identity, the planted direction, n < d, the round trip, and the coefficient variances.
- Predict before you run it: look at the crowd before the eigenfaces appear. Which three things vary most from face to face? Write them down, then check whether eigenfaces 1–3 agree, and with what share of the variance each.

**Unlocks**: *Eigenfaces*: the mean face and 11 eigenfaces with their share of the variance; the face-space map, with all 200 faces placed at their (c₁, c₂) and a crosshair you drag to paint faces nobody drew; six sculpting sliders; and a stranger rebuilt from 1, 2, 4 … 24 eigenfaces. Back in *Cast a shadow*, the *Best plane (your PCA)* button fits the galaxy, and the residual drops to the floor your variances predict.

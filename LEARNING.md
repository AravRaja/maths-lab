# Learning path

> Template file. Each project replaces this with 3 to 6 milestones. Keep the headings' anchors
> (`<a id="m1-softmax"></a>`) in sync with the `milestone` fields in `src/core/`.

<a id="m1-softmax"></a>
## M1: Softmax and log-sum-exp (example)

**Derive on paper**
- Show that LSE(z) = c + LSE(z − c) for any constant c, and pick the c that makes every exp() ≤ 1.
- Differentiate LSE: show ∂LSE/∂zᵢ = softmax(z)ᵢ.
- Show softmax(z + c·1) = softmax(z), and find the limits of softmax(z/τ) as τ → 0⁺ and τ → ∞.

**Write**: `logSumExp` and `softmax` in `src/core/softmax.ts`.

**Check**
- `npm run test:cores`: closed forms, shift invariance, overflow at z = 1000, and a finite-difference check that ∇LSE = softmax.
- Predict before you run it: with logits [1.2, −0.4, 2.6, 0.3, 1.9, −1.1, 0.8], which bar is tallest at τ = 1, and roughly what share does it get at τ = 0.1?

**Unlocks**: the temperature histogram and the 200k-sample worker on the home page.

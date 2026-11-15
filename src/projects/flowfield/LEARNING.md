# Flow field: learning path

Six milestones, ten functions, all in `src/projects/flowfield/core/`. Each milestone is a page of paper first, a few lines of code, a test file that checks the maths, and a part of `/flowfield` that lights up when the tests pass.

Run the dev server (`npm run dev`, then open `/flowfield`) next to the tests:

```sh
npx vitest run src/projects/flowfield/core                          # everything
npx vitest src/projects/flowfield/core/__tests__/path.test.ts        # one milestone, in watch mode
```

The rule: work it out on paper before you type. The stubs' JSDoc has the spec and some questions. It never has the answer.

**Notation.** Time runs from t = 0 (noise) to t = 1 (data). x₀ ~ N(0, I) is a noise sample, x₁ ~ p_data is a data point, d is the dimension (2 for shapes, 16 for robot action chunks). σ_min is a small number (0.02 here) that keeps everything a little bit blurred at t = 1.

---

<a id="m1-straight-lines"></a>
## M1: Straight lines

Flow matching starts from the simplest possible way to get from noise to data: pick one of each and draw a straight line between them.

**Derive on paper**
- The conditional optimal-transport path is x_t = (1 − (1 − σ_min) t) x₀ + t x₁. Check t = 0 and t = 1.
- Fix x₁ and let x₀ be random. Show that x_t is Gaussian and write its mean μ_t and standard deviation σ_t. Sketch both against t. You will need σ_t in M2.
- Differentiate x_t with respect to t to get the target velocity u_t. What does the answer *not* depend on, and what does that say about how a particle moves along its line?
- Draw three noise points and three data points and join each pair. The lines cross. A network only sees x_t and t, never which pair it came from. At a crossing, what should it predict? Write down your guess; M4 proves it.

**Write**: `conditionalPath` and `conditionalVelocity` in `src/projects/flowfield/core/path.ts`.

**Check**
- `npx vitest run src/projects/flowfield/core/__tests__/path.test.ts`: endpoints, the σ_min = 0 limit, affinity in t, d = 16, a Monte Carlo check of μ_t and σ_t, and your velocity against central differences of your own path.
- Predict before you run it: with σ_min = 0.02, x₀ = (1, 0), x₁ = (0, 1), what is x₀.₅? Drag the handles in section 2 to that configuration and read off xₜ.

**Lights up**: section 2 (every line, the dots riding them, your arrow uₜ on the pair you drag). The hero switches from waiting drift to straight lines: each particle paired with a point of the glyph. Section 3 gets its dithered density pₜ, drawn from samples of your path.

---

<a id="m2-marginal-field"></a>
## M2: The marginal field

The lines cross, so they are not the flow of any single velocity field. Averaging them is.

**Derive on paper**
- From M1: p_t(x | x₁) = N(x; μ_t, σ_t² I). Mixing over a dataset of N equally likely points gives p_t(x) = (1/N) Σᵢ p_t(x | x₁⁽ⁱ⁾).
- Take x on the line from x₀ to x₁ at time t. Solve the path equation for x₀ and substitute into your M1 velocity. You now have u_t(x | x₁), the velocity at *position* x of the line that ends at x₁. Check that it points from x towards x₁, roughly, and how its size behaves as t → 1.
- The marginal field is the posterior-weighted average u_t(x) = Σᵢ wᵢ u_t(x | x₁⁽ⁱ⁾) with wᵢ = p_t(x | x₁⁽ⁱ⁾) / Σⱼ p_t(x | x₁⁽ʲ⁾). Show the normalising constants of the Gaussians cancel, so wᵢ is a softmax of a quadratic in x.
- Why this is the right field: it satisfies the continuity equation ∂p_t/∂t + ∇·(p_t u_t) = 0 because each conditional field does for its own Gaussian, and the equation is linear in (p, p·u). Write out that one-line argument.
- Numerics: far from the data every exponent is very negative. How do you compute the softmax without 0/0, and why does your fix not change the answer?

**Write**: `marginalVelocity` in `src/projects/flowfield/core/marginal.ts`.

**Check**
- `npx vitest run src/projects/flowfield/core/__tests__/marginal.test.ts`: one data point reproduces the straight lines, symmetry, order and duplication invariance, stability far away, the pull towards the nearest point near t = 1, and the continuity equation checked by finite differences against the exact mixture density.
- Predict before you run it: in section 3, slide t to 0. In one sentence, what will the arrows look like for *any* dataset? Now slide towards 0.99. What changes, and where are the arrows longest?

**Lights up**: section 3, the exact velocity field over the dithered density, scrubbed or played over t.

---

<a id="m3-integrate"></a>
## M3: Integrate

Sampling is solving the ODE dx/dt = v(x, t) from t = 0 to 1. Forward Euler is the simplest solver, and seeing it fail is half the lesson.

**Derive on paper**
- Euler from the first-order Taylor expansion. Local error per step, and why the global error after N steps is O(1/N).
- For dx/dt = −x, x(0) = 1: write the exact x(1) and Euler's answer after N steps in closed form. Expand the log of their ratio to show the gap is about e⁻¹/(2N).
- Two trajectories of a smooth ODE cannot cross. The straight lines of M1 cross all the time. So what do the trajectories of the marginal field look like where lines crossed?
- Near t = 1 the marginal field has terms of size 1/σ_t. With step size Δt, when does Euler overshoot a data point instead of landing on it? (Think of dx/dt = −k(x − a) and the condition on kΔt.)

**Write**: `eulerStep` and `sampleODE` in `src/projects/flowfield/core/euler.ts`.

**Check**
- `npx vitest run src/projects/flowfield/core/__tests__/euler.test.ts`: the step itself, negative dt, the time stamps (k/N, called exactly N times), exactness on constant fields, first-order convergence on dx/dt = −x, and a time-dependent field.
- Predict before you run it: in section 4, at how many steps does the miss distance first drop below 0.1? Does path length / chord go up or down as the steps increase, and why is it bigger than 1 at all?

**Lights up**: the hero runs on the real thing: your exact field integrated by your Euler step, forwards into each glyph and backwards (negative dt) into noise. Tap or drag on it to stir and watch the field pull the particles back. Section 3's probe traces its path to t = 1. Section 4 draws the trajectories for 1 to 48 steps. Every sampler in sections 5 to 7 uses your `eulerStep` or `sampleODE`.

---

<a id="m4-train"></a>
## M4: The flow-matching loss

The exact field needs the whole dataset at every step. A network doesn't, and it can generalise. Train it on single lines.

**Derive on paper**
- The CFM loss for one batch is L = (1/B) Σ_b ‖v_θ(x_t, t) − u_t‖², summed over coordinates and averaged over the batch. Differentiate with respect to one prediction entry.
- The key fact. Fix (x, t). Over all (x₀, x₁) whose line passes through x at t, minimise E‖v − u_t(x | x₁)‖² over one vector v. Show the minimiser is the conditional expectation E[u_t | x_t = x], and that this is exactly M2's marginal field. So regressing on single lines learns the average. (Lipman et al. 2023 prove the full version: the CFM and marginal FM losses have the same gradients.)
- At the optimum the loss is the expected conditional variance of u_t given x_t, which is not zero. Write the loss of a network that always outputs 0, in terms of E‖x₁‖², d and σ_min. Is the trained loss in section 5 far below it?

**Write**: `cfmLoss` and `cfmLossGrad` in `src/projects/flowfield/core/loss.ts`.

**Check**
- `npx vitest run src/projects/flowfield/core/__tests__/loss.test.ts`: values, batch averaging, the gradient against central differences of your loss, gradient descent converging, and the mean as the best single prediction for many targets.
- Predict before you run it: press *Train* in section 5. Roughly where will the loss level off, and will the samples look right before or after the loss stops falling?

**Lights up**: section 5 trains a 3×96 SiLU MLP live in a Web Worker. Each step builds pairs with your M1 code, scores them with `cfmLoss`, and backpropagates `cfmLossGrad` through the network. Samples from the current net replay noise to shape every second or so. It also unlocks training in sections 6 and 7.

---

<a id="m5-condition"></a>
## M5: Conditioning and guidance

One network, several glyphs. Tell it which one, sometimes tell it nothing, and steer at sampling time.

**Derive on paper**
- The context is a one-hot label c, or all zeros for "no context". With probability p_drop the training loop shows zeros instead of the label, so the same network learns v(x, t | c) and v(x, t | ∅).
- Classifier-free guidance (Ho and Salimans, 2022): ṽ = v(x, t | ∅) + w (v(x, t | c) − v(x, t | ∅)). Draw the two arrows from one point and the guided one for w = 0, 1, 2.
- For Gaussian paths the velocity is an affine function of the score ∇ log p_t(x). Use that to show the guided field's score is the score of p_t(x | c)^w p_t(x)^(1−w), then use Bayes to write it as p_t(x | c) · p_t(c | x)^(w−1). This is why it sharpens: it multiplies in an implicit classifier, without ever training one. (Caveat: this holds for the score at each t; the samples you get at t = 1 only approximately follow the tilted density.)
- If p_drop = 0, which field is the network never trained on, and what will w ≠ 1 do?

**Write**: `guidedVelocity` and `dropLabel` in `src/projects/flowfield/core/guidance.ts`.

**Check**
- `npx vitest run src/projects/flowfield/core/__tests__/guidance.test.ts`: the w = 0 and w = 1 limits, affinity and extrapolation, the drop rate over uniform draws, and custom null labels.
- Predict before you run it: once the four glyphs separate (around 1500 steps), what do the thumbnails look like at w = 0? At w = 3, do the samples spread out or tighten?

**Lights up**: section 6. Pick a glyph or ∅, drag the guidance weight, and watch all four glyphs resample.

---

<a id="m6-action-chunks"></a>
## M6: Action chunks

Robot policies like π0 (Black et al., 2024) generate actions with a flow. The "data point" is a chunk of future actions and the context is the robot's state and goal. Everything from M1 to M4 carries over unchanged, in 16 dimensions instead of 2.

**The setup.** A 2-link arm must move its fingertip to a target past a post. The expert goes round the inside or the outside, 50/50. A chunk is the next 8 joint moves (8 × 2 = 16 numbers, scaled to be O(1) like the noise). The context is (cos q₁, sin q₁, cos q₂, sin q₂, target). Two policies train side by side on the same demonstrations: the flow policy (your CFM loss, sampled with your `sampleODE`), and an L2 regressor (context to chunk with the same squared error, no noise).

**Derive on paper**
- At the start of an episode the demonstrations are 50/50 between two chunks a_L and a_R. What does the L2 regressor converge to there? Where does that chunk send the fingertip?
- Why the flow policy doesn't have that problem: what distribution does it sample from at that context?
- Temporal ensembling (Zhao et al., 2023): if the policy replans every step, several chunks cover the current step. Blend them with weights wᵢ = exp(−m i), i = 0 for the oldest. What do m = 0 and m → ∞ give? Why can weighting old predictions more make motion smoother?
- Ensembling averages actions. When two overlapping chunks come from different modes, what does the average do? Is ensembling a good idea for a multimodal policy?

**Write**: `temporalEnsemble` in `src/projects/flowfield/core/chunks.ts`.

**Check**
- `npx vitest run src/projects/flowfield/core/__tests__/chunks.test.ts`: coverage, the m = 0 average, exact exp(−m i) weights regardless of input order, expired chunks, normalisation.
- Predict before you run it: in section 7, which policy ends training with the lower loss? Which reaches the target more often in *Score 30 each*? Then turn on the ensemble switch and score again: does the flow policy get better or worse?

**Lights up**: the ensemble switch in section 7. Without it, section 7 already runs once M1, M3 and M4 are done: train both policies, roll out to watch the chunk denoise from scribble to path before the arm moves, and score both policies over 30 episodes.

---

## Map: which core drives what

| Core | Used by |
| --- | --- |
| `conditionalPath`, `conditionalVelocity` | section 2, density in 3, hero (straight lines), every training step in 5–7 |
| `marginalVelocity` | section 3, section 4, hero (exact field) |
| `eulerStep`, `sampleODE` | hero, probe in 3, section 4, every sampler in 5–7 |
| `cfmLoss`, `cfmLossGrad` | training in 5–7, including the L2 baseline |
| `guidedVelocity`, `dropLabel` | section 6 |
| `temporalEnsemble` | section 7, ensemble switch |

Further reading: Lipman et al., *Flow Matching for Generative Modeling* (2023); Liu et al., *Flow Straight and Fast* (rectified flow, 2022); Tong et al., *Improving and generalizing flow-based generative models with minibatch optimal transport* (2023); Ho and Salimans, *Classifier-Free Diffusion Guidance* (2022); Zhao et al., *Learning Fine-Grained Bimanual Manipulation with Low-Cost Hardware* (ACT, 2023); Black et al., *π0: A Vision-Language-Action Flow Model for General Robot Control* (2024).

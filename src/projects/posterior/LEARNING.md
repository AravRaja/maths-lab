# Learning path

Six milestones, ten functions in `src/projects/posterior/core/`. Each milestone is a page of paper first, then a few lines of code, then a part of `/posterior` that lights up. Run `npx vitest run src/projects/posterior/core` as you go (or one file, e.g. `npx vitest src/projects/posterior/core/__tests__/beta.test.ts`), and keep `npm run dev` open on `/posterior` next to it.

The rule: work it out on paper before you type. The stubs' JSDoc has the spec and some questions, never the answer. Helpers you may use: `lgamma` and `lbeta` in `src/projects/posterior/lib/special.ts`.

Why this matters later: every RL, world-model and VLA paper assumes this week. Posteriors and evidence are how you reason about uncertainty; Gaussian conditioning is the Kalman filter and the Gaussian process; Monte Carlo with error bars is how you know whether a returns curve means anything; importance weights are the ratio inside PPO; and the Gaussian KL is the regulariser in every VAE and the trust region in TRPO.

<a id="m1-coin"></a>
## M1: The coin and its posterior

**Derive on paper**
- Bayes' rule for a continuous parameter: p(θ | D) = p(D | θ) p(θ) / p(D). Which of the three terms on the right depends on θ? So which one can you ignore while you find the *shape* of the posterior?
- With a Beta(a, b) prior and h heads, t tails, multiply the kernels θ^(a−1)(1−θ)^(b−1) and θ^h(1−θ)^t. Recognise the result.
- Show the update is the same flip by flip as in one batch, and that order doesn't matter. (This is what makes a *sufficient statistic*: what does the posterior actually need to know about D?)
- E[θ] and Var[θ] for a Beta. Write E[θ] = B(a+1, b)/B(a, b) and simplify with Γ(x+1) = xΓ(x); then E[θ²] the same way.
- After n flips from a flat prior with about half heads, roughly how big is the posterior sd? How does it scale with n?

**Write**: `betaUpdate` and `betaMoments` in `src/projects/posterior/core/beta.ts`.

**Check**
- `npx vitest src/projects/posterior/core/__tests__/beta.test.ts -t "betaUpdate|betaMoments"`: the posterior is compared pointwise with likelihood × prior normalised by quadrature, sequential equals batch in either order, moments against numerical integration, and concentration on the true bias.
- Predict before you run it: start from the *Sceptic 20,20* prior and flip a θ = 0.8 coin ten times, getting 8 heads. Will E[θ] be nearer 0.5 or 0.8? Work it out, then flip and see.

**Unlocks**: the hero stops being prior noise and becomes thirty posteriors sharpening one flip at a time. In *Is this coin rigged?* the dithered posterior, its trail of earlier beliefs, the ±2σ band, the E[θ] and sd readouts, and the *How fast doubt shrinks* log-log chart all light up.

<a id="m2-evidence"></a>
## M2: Evidence and the Bayes factor

**Derive on paper**
- p(D) = ∫ p(D | θ) p(θ) dθ for the Beta prior. It is a ratio of two Beta functions. Which two?
- Sanity checks: no data gives p(D) = 1. With a flat prior and a single head, p(D) is what?
- Chain rule of evidence: p(D₁, D₂) = p(D₁) p(D₂ | D₁). What is the prior you use for the second factor?
- Under a fair coin, log p(D | θ = ½) is what for n flips? The log Bayes factor is the difference. Why must you work in logs once n is in the hundreds?
- The Occam factor: a coin with 52 heads in 100 flips. The "unknown θ" model fits it at least as well as the fair model at its best θ, yet the Bayes factor favours *fair*. Explain where the "unknown θ" model loses its probability.

**Write**: `logEvidence` in `src/projects/posterior/core/beta.ts`.

**Check**
- `npx vitest src/projects/posterior/core/__tests__/beta.test.ts -t logEvidence`: against quadrature of the integral, zero data, the chain rule, and 1000-flip stability.
- Predict before you run it: with a flat prior, how many flips of a θ = 0.65 coin do you expect before the meter says *Strong: rigged* (log₁₀ BF > 1)? Ten? Fifty? Two hundred? Then reset and run it a few times.

**Unlocks**: *The verdict* card: the fair-to-rigged meter, the Jeffreys-style verdict, and the reveal toast that tells you whether the evidence called it. Try the *Sceptic* prior on a rigged coin and see how it changes the verdict, not only the posterior.

<a id="m3-gaussian"></a>
## M3: Slicing a 2D Gaussian

**Derive on paper**
- Cholesky: write L = [[p, 0], [q, r]], expand L Lᵀ, match it to Σ = [[σx², c], [c, σy²]] and solve. Then show Cov(μ + Lz) = L Lᵀ for z ~ N(0, I).
- Marginals: X = A(X, Y)ᵀ with A = [1 0]. What are E[AX] and Cov(AX) for a Gaussian vector? Is the result still Gaussian?
- Conditioning: fix x, write −2 log p(x, y) as a quadratic in y using the precision matrix Λ = Σ⁻¹, complete the square, read off E[y | x] and Var[y | x]. Then rewrite both in terms of Σ entries only.
- The slope of E[y | x] against x: where have you seen it in A-level statistics?
- Var[y | x] does not depend on x. What does that mean for the slice as you drag it? What fraction of Var[y] does observing x remove, in terms of ρ?

**Write**: `cholesky2`, `marginal`, `condition` in `src/projects/posterior/core/gaussian2d.ts`.

**Check**
- `npx vitest src/projects/posterior/core/__tests__/gaussian2d.test.ts`: L Lᵀ = Σ, the covariance of 200k samples, marginals against integrating the joint density, conditionals against normalising a slice of it, independence at ρ = 0, linearity in the observed value, and "conditioning never adds variance".
- Predict before you run it: set ρ = 0.9 and observe x two standard deviations above its mean. Where will the conditional mean of y sit, in units of σy above its mean? And what will *Doubt removed* read?

**Unlocks**: *Observe one, learn the other*: the sample cloud (cholesky2), the dashed marginal shadows on the edges (marginal), the bright conditional density bulging off the slice with its mean and ±2σ bar, and the dotted regression line traced by conditional means (condition). Extension, not tested: the same algebra in n dimensions is the Schur complement, and it is the update step of a Kalman filter.

<a id="m4-monte-carlo"></a>
## M4: Monte Carlo with an honest error bar

**Derive on paper**
- For i.i.d. f₁ … fₙ with mean μ and variance σ², show E[f̄] = μ and Var[f̄] = σ²/n. Which step needs independence?
- So the standard error of the mean is estimated by what? How many more samples to get one more correct decimal digit?
- Why divide by n − 1 in the sample variance? (Compute E[Σ(fᵢ − f̄)²].)
- Hit-or-miss darts: f = 4·1[x² + y² ≤ 1]. What is Var[f]? Now f = 4/(1 + x²) with x uniform on [0, 1]: same mean, π. Which has the smaller variance, and why does that matter more than throwing more darts?
- Numerics: why can Σf² − (Σf)²/n come out negative? Pick a one-pass method that can't.

**Write**: `mcEstimate` in `src/projects/posterior/core/montecarlo.ts`.

**Check**
- `npx vitest src/projects/posterior/core/__tests__/montecarlo.test.ts`: a hand-checkable set, typed arrays, the n < 2 conventions, stability with a 1e9 offset, the 1/√n scaling, and 95% coverage of the ±1.96 SE interval over 2000 repeats.
- Predict before you run it: with 120k hit-or-miss darts, how many correct digits of π do you expect? Then switch to *Average 4/(1+x²)*: will the band be about the same, twice as tight, or ten times as tight?

**Unlocks**: *Throw darts at π*: the ten racing estimates, the ±1.96 SE band that zooms in as it shrinks, the digits-of-π readout and toast, and the log-log *1/√n law* chart. Also the Monte Carlo check of KL (M6) and the mode-seeking maps, which are built from your estimator.

<a id="m5-importance"></a>
## M5: Importance sampling

**Derive on paper**
- Prove E_p[f(X)] = E_q[f(X) p(X)/q(X)]. What has to be true about q wherever p·f ≠ 0?
- Self-normalised weights w̃ᵢ = wᵢ / Σwⱼ: show they don't care about p's normalising constant. Why is that the whole point for Bayesian posteriors?
- Log-sum-exp: subtracting max(log w) before exponentiating changes nothing mathematically. Show it, and show it can't overflow.
- Kish's ESS = (Σw)²/Σw². Check the two extremes. For a weighted mean of i.i.d. values, compare its variance with that of an unweighted mean of m values and find the m that matches.
- For p = N(0, 1) and q = N(δ, 1), compute E_q[w²] and hence the limit of ESS/n as n → ∞.
- *Rare tail* uses ordinary IS, (1/n) Σ (p/q) f, because p is normalised there; *Two humps* uses the self-normalised Σ w̃ f. Put q near 3 in *Rare tail*: the ESS collapses, yet the estimate gets better. What does Kish's ESS measure, and what does it not know about?
- PPO's ratio π_new(a|s)/π_old(a|s) is an importance weight. What does a collapsing ESS mean there, and what does clipping do about it?

**Write**: `importanceWeights` and `effectiveSampleSize` in `src/projects/posterior/core/importance.ts`.

**Check**
- `npx vitest src/projects/posterior/core/__tests__/importance.test.ts`: a hand case, invariance to log p + c, ±1000 log weights, E_p[x²] from q samples, a tail probability, ESS extremes and scale invariance, and ESS/n against the exp(−δ²) law.
- Predict before you run it: in *Rare tail*, where should you put q's mean to estimate P(X > 3) best: at 0, at 3, or well past 3? And what happens to the weight comb and the ESS if you make σq tiny?

**Unlocks**: *Sample the wrong thing, on purpose*: weight heights on the comb, the ESS gauge, the importance-sampling estimate, the lower row of the repeat strip and the *Spread cut* readout. The *Two humps* target shows the failure mode: a narrow q on one hump confidently gets E[X] wrong.

<a id="m6-kl"></a>
## M6: KL divergence

**Derive on paper**
- For p = N(μp, σp²), q = N(μq, σq²), write log p(x) − log q(x) and take E_p of it. You need only E_p[(x − μp)²] and E_p[(x − μq)²].
- Check KL(p‖p) = 0, and use Jensen (or log x ≤ x − 1) to show KL ≥ 0 in general.
- Swap p and q. When do the two KLs agree?
- The VAE special case: KL(N(μ, σ²) ‖ N(0, 1)). Write it in terms of μ and log σ².
- Forward vs reverse: if p has two separated bumps and q is a single Gaussian, KL(p‖q) punishes q for being small where p is large; KL(q‖p) punishes q for being large where p is small. Sketch the best q for each before looking.

**Write**: `klNormal` in `src/projects/posterior/core/kl.ts`.

**Check**
- `npx vitest src/projects/posterior/core/__tests__/kl.test.ts`: zero on identical inputs, quadrature on four pairs, non-negativity on 200 random pairs, asymmetry, quadratic growth in the mean gap.
- Predict before you run it: p = N(0, 0.5²), q = N(0, 2²). Which is bigger, KL(p‖q) or KL(q‖p), and by roughly what factor? Set the sliders and compare.

**Unlocks**: *A distance that isn't one*: both KL readouts and their ratio, the dithered KL landscape over every q (tap it to move q), and the closed-form line in the Monte Carlo check (which needs M4 too). With M4 written, the *Mode-seeking vs mass-covering* maps show where each KL puts its best single Gaussian.

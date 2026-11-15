# Learning path

Five milestones. Each one is a few functions in `src/projects/say-and-reach/core/`, a page of derivation first, and a part of the app that lights up when the tests pass. Run `npm run dev` (this project is at `/say-and-reach`) alongside `npx vitest src/projects/say-and-reach/core` (watch mode) and keep both open.

The order matters: every milestone uses the ones before it. Kinematics feeds IK, IK drives the expert, the expert's demos train the policies, and the reward scores them.

---

<a id="m1-forward-kinematics"></a>
## M1: Forward kinematics

**Derive on paper**
- For a planar arm with relative joint angles θ₁…θₙ and link lengths ℓ₁…ℓₙ, write the absolute angle of link i as φᵢ = θ₁ + … + θᵢ and each joint position as pᵢ = pᵢ₋₁ + ℓᵢ(cos φᵢ, sin φᵢ), with p₀ at the origin.
- Work the 2-link pose θ = (π/2, −π/2), ℓ = (1, 2) by hand. Where are the elbow and the fingertip? (A test checks your answer.)
- Show that adding c to θ₁ rotates every point about the base by c. (Rotation matrices compose: R(c)R(φ) = R(c + φ).)
- With ℓ = (0.55, 0.45, 0.3), what is the reachable set? What are its outer and inner radii? Can the fingertip reach the base itself?

**Write**: `forwardKinematics` in `src/projects/say-and-reach/core/kinematics.ts`.

**Check**
- `npx vitest run src/projects/say-and-reach/core/__tests__/kinematics`: base first, the straight-arm and hand-worked poses, link lengths preserved, rigid rotation about the base, and never beyond the sum of the lengths.
- Predict before you run it: set θ = (π/2, 0, 0) on the page. Where is the fingertip? Now θ = (π/2, π, 0)?

**Unlocks**: section 02 (joint sliders with angle arcs and a live fingertip readout). The hero's ghost arm becomes a real one that sways.

---

<a id="m2-jacobian-ik"></a>
## M2: The Jacobian and damped least squares

**Derive on paper**
- Differentiate the fingertip pₙ with respect to θᵢ. Which absolute angles φₖ contain θᵢ? Write ∂pₙ/∂θᵢ as a sum over those links.
- Changing θᵢ swings everything beyond joint i rigidly about pᵢ₋₁. Use that picture to get the same column a second way, as a single vector built from pₙ and pᵢ₋₁.
- Show the arm is singular (J Jᵀ has determinant zero) when it is stretched straight.
- Minimise ‖J δθ − e‖² + λ²‖δθ‖². Setting the gradient to zero gives (JᵀJ + λ²I) δθ = Jᵀe. Prove the push-through identity (JᵀJ + λ²I)⁻¹Jᵀ = Jᵀ(JJᵀ + λ²I)⁻¹, so you only ever invert a 2×2.
- Invert [[a, b], [b, d]] by hand. Why is J Jᵀ + λ²I always invertible for λ > 0?
- λ = 0: show J δθ = e and that δθ lies in the row space of J, so it is the minimum-norm solution. λ → ∞: show λ²δθ → Jᵀe (a gradient step on ½‖J δθ − e‖²).

**Write**: `jacobian` in `src/projects/say-and-reach/core/kinematics.ts`, `dlsStep` in `src/projects/say-and-reach/core/ik.ts`.

**Check**
- `npx vitest run src/projects/say-and-reach/core/__tests__/kinematics src/projects/say-and-reach/core/__tests__/ik`: a central finite-difference check of J against your FK, the last column's length and direction, rank loss when stretched, agreement with the n×n normal equations for several λ, the λ = 0 and λ → ∞ limits, and a full IK loop that lands within 10⁻⁶ m.
- Predict before you run it: in section 03, set λ = 0 and tap just inside the edge of the reach circle, then just outside it. What does the arm do in each case? Repeat with λ = 0.3. Which converges faster, and which is calmer?

**Unlocks**: tap-to-reach with the manipulability ellipse and error curve (section 03), the scripted expert in the playground (section 04) and the hero's attract loop. Recording demos in section 05 also needs it, because the expert moves the arm through your IK.

---

<a id="m3-behaviour-cloning"></a>
## M3: Behaviour cloning with a Gaussian head

The policy reads the scene and a bag of hashed word vectors. It attends over the three objects to pick the one the words name, then a FiLM network (the words scale and shift its hidden layers) outputs a mean μ and a log standard deviation s = log σ for the fingertip velocity. The network and its backprop are plumbing. The loss is yours.

**Derive on paper**
- Take −log of the diagonal Gaussian density to get L = Σₖ [(aₖ − μₖ)² / (2e^{2sₖ}) + sₖ + ½ log 2π].
- Differentiate L with respect to μₖ and with respect to sₖ (not σₖ: use the chain rule through σₖ = e^{sₖ}). Sanity-check the signs: if μₖ is below aₖ, which way should gradient descent move it?
- For fixed μ, show the best σ is |a − μ|, so σ learns how wrong the mean usually is. Why parametrise by s = log σ? (σ stays positive with no constraint, and the loss is smooth in s everywhere.)
- Mode averaging: if half the demos in one state say a = +1 and half say a = −1, which μ minimises the expected loss? Which σ?

**Write**: `gaussianNll` in `src/projects/say-and-reach/core/policy-head.ts`.

**Check**
- `npx vitest run src/projects/say-and-reach/core/__tests__/policy-head`: the standard-normal value, agreement with −log of the pdf, finite-difference gradients for μ and log σ, both stationary points, and a gradient-descent fit that recovers μ = 0, σ = 1 from samples ±1.
- Predict before you run it: record 500 one-way demos and train. Roughly where does the NLL settle, and is it above or below zero? (What does a negative NLL say about σ?) Then try "shove the sphere back" in the playground: the policy never saw that exact phrase.

**Unlocks**: the Gaussian head's training curve (section 05), Gaussian mode in the playground with the attention bars ("looking at") and word saliency, and the hero switches to the learned policy. Snapshots stream in every 250 steps, so the arm improves while you watch.

---

<a id="m4-flow-matching"></a>
## M4: Flow matching on actions

Instead of a mean and a spread, learn a velocity field v(x, t | scene, words) on the 2-D action plane. Sampling means integrating it from Gaussian noise at t = 0 to an action at t = 1.

**Derive on paper**
- For the straight path xₜ = (1 − t)x₀ + t x₁, differentiate with respect to t to get the target velocity uₜ. Does it depend on t?
- Why is minimising E‖v(xₜ, t) − uₜ‖² enough? Show its minimiser is v*(x, t) = E[uₜ | xₜ = x], the average velocity of all the paths through x at time t. Integrating v* carries the noise distribution onto the data distribution, because the marginal densities follow the same continuity equation.
- Forward Euler with step Δ = 1/N: xₖ₊₁ = xₖ + Δ v(xₖ, kΔ). For v = −x, the exact x(1) is x₀e⁻¹ and Euler gives x₀(1 − 1/N)ᴺ. Show the error is O(1/N).
- If v were exactly the straight-line target, how many Euler steps would you need?

**Write**: `flowPair` and `eulerSample` in `src/projects/say-and-reach/core/flow.ts`.

**Check**
- `npx vitest run src/projects/say-and-reach/core/__tests__/flow`: endpoints, linear interpolation, the target equals dxₜ/dt by finite differences and does not depend on t, Euler's path length, every intermediate point and the evaluation times, the (1 − 1/N)ᴺ closed form, first-order convergence (doubling N halves the error), and a time-dependent field.
- Predict before you run it: in section 06, drag the Euler-steps slider from 32 down to 1. How much does the cloud's final shape change, and why? Then re-record demos with the two-way expert, retrain both heads, and look at "push the cube down" (the fingertip starts right in front of the cube). Where does the Gaussian head's ellipse sit relative to the two expert crosshairs? Does the flow cloud split? Then score both heads in section 07 and see whether the picture predicts the numbers.

**Unlocks**: training the flow head (needs `flowPair`) and, with `eulerSample`, flow mode in the playground, the particle streams at the fingertip in the hero, and the action-plane view in section 06.

---

<a id="m5-reward-shaping"></a>
## M5: Returns and potential-based shaping

Success is sparse: reward 1 on the step the task is first done, 0 otherwise. A potential Φ(s), minus the distance the job still has to go, gives a dense signal.

**Derive on paper**
- Write Gₜ in terms of rₜ and Gₜ₊₁. Which way should the loop run? For constant reward r over T steps, find the closed form, and its limit as γ → 1.
- With r′ₜ = rₜ + γΦ(sₜ₊₁) − Φ(sₜ), sum γᵗr′ₜ and watch the Φ terms telescope: G′ = G + γᵀΦ(s_T) − Φ(s₀).
- So shaping adds −Φ(s₀) (the same for every policy from that start) plus a terminal term, which vanishes when Φ is zero at terminal states. That is why potential-based shaping leaves the optimal policy unchanged (Ng, Harada and Russell, 1999).
- What goes wrong with the naive bonus F = Φ(sₜ₊₁)? (Try a policy that loops between two high-Φ states.)

**Write**: `discountedReturn` and `shapedRewards` in `src/projects/say-and-reach/core/reward.ts`.

**Check**
- `npx vitest run src/projects/say-and-reach/core/__tests__/reward`: the empty trace, a hand-worked trace, the geometric series (and γ = 1), γ = 0, the recursion, a hand-worked shaped step, constant potentials, the telescoping identity for three values of γ, and that the gap between two trajectories with the same start and end potentials is unchanged.
- Predict before you run it: section 07 prints G′ − G next to γᵀΦ(s_T) − Φ(s₀) for each policy. Will they agree to 5 decimal places even for a policy that fails the task?

**Unlocks**: the held-out scoreboard (section 07): success rate, true and shaped returns for the expert and both heads, the shaped reward trace and the live telescoping check.

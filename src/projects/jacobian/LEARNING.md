# Jacobian: learning path

Six milestones, eleven functions, all in `src/projects/jacobian/core/`. Each milestone is a page of derivation first, then a few functions, then a part of `/jacobian` that lights up when the tests pass. Keep two terminals open:

```sh
npm run dev                                   # the page is at /jacobian
npx vitest src/projects/jacobian/core         # watch mode: every core's tests
```

Conventions used everywhere: z is up, vectors are plain arrays, matrices are row-major `number[][]`, a rotation R maps local coordinates to world coordinates (v_world = R v_local), and a rigid transform is the 4 × 4 matrix T = [R p; 0 1]. You may use anything in `lib/linalg.ts` (matrix products, `solve`, `det`, `cross`, `hat`, `fromRp`, `rotOf`, `posOf` …). Those are plumbing; the maths below is yours.

The order matters: M2 is built from M1's rotations, M3 differentiates M2, M4 inverts M3, and M6's estimate is what M4's arm reaches for. M5 (LQR) stands on its own, so you can do it any time after M1.

---

<a id="m1-frames"></a>
## M1: Rotations and rigid transforms

**Derive on paper**
- Split a vector v into its part along a unit axis k and the part perpendicular to it. Rotating by θ about k leaves the first alone and turns the second within the plane ⟂ k. Write the rotated perpendicular part using k × v and k × (k × v), then collect everything into a matrix. That is Rodrigues' formula.
- Write the skew matrix [k]× with [k]× v = k × v. Work out [k]×² and [k]×³ for unit k, and use them to sum the series exp(θ[k]×) into three terms. Check that your two derivations agree.
- Check the result against the rotation about z you already know, and confirm R(k, a) R(k, b) = R(k, a + b).
- If x_world = R x_local + p, solve for x_local. Read off T⁻¹ without inverting anything. Why is RᵀR = I the whole trick?

**Write**: `rodrigues` and `invertSE3` in `src/projects/jacobian/core/se3.ts`.

**Check**
- `npx vitest run src/projects/jacobian/core/__tests__/se3.test.ts` (the `rodrigues` and `invertSE3` blocks): agreement with the elementary rotations, the axis stays fixed, a perpendicular vector turns by exactly θ the right-handed way, a non-unit or zero axis, angle addition, and T T⁻¹ = I with the rotation block *exactly* Rᵀ (so no general inverse).
- Predict before you run it: set θ = π, write down R, then point the axis the opposite way. Does R change? What does that mean for reading the axis back out of R at θ = π (M4)?

**Unlocks**: section 02, *Spin a frame*: a frame turning about an axis you steer, the dithered wedge a perpendicular vector sweeps, the live matrix with det R and ‖RᵀR − I‖, and a transform T with its inverse T⁻¹ drawn beside it.

---

<a id="m2-forward-kinematics"></a>
## M2: Forward kinematics

**Derive on paper**
- The arm is six revolute joints. Joint i sits at a fixed offset in the frame of joint i − 1 and turns by q_i about its own axis. Draw a planar two-link arm and compose the transforms by hand. Does Trans(offset)·Rot(axis, q) or Rot·Trans put the joint in the right place? What changes if you swap them?
- Why does each new transform multiply on the *right*? (It is described in the previous joint's frame, not the world's.)
- The arm on the page has axes z, y, y, y, z, x and every offset points up z (see `lib/arm.ts`). At q = 0, where is the tool? Set only the shoulder to +π/2: which way does the arm point? Add the base yaw: what curve does the tool trace?
- Joint i's position cannot depend on q_i or anything after it. Check that your composition order respects that.

**Write**: `forwardKinematics` in `src/projects/jacobian/core/kinematics.ts` (use your `rodrigues`).

**Check**
- `npx vitest run src/projects/jacobian/core/__tests__/kinematics.test.ts`: proper rigid transforms, the upright pose, the shoulder-at-π/2 pose and its sweep with the base yaw, rigid links, joint i unaffected by q_i onwards, the textbook planar two-link arm, and a joint about x.
- Predict before you run it: you will sample 30,000 *uniformly random* joint vectors and plot where the tool lands. Is the cloud uniform in space? Is it densest near the shoulder or out at full stretch?

**Unlocks**: the hero arm becomes real (it dances in joint space); section 03, *Pull the strings*: six sliders, a triad at every joint, the live tool transform; and *Sample the workspace*, a dithered cloud of 30,000 reachable tool positions computed in a Web Worker.

---

<a id="m3-jacobian"></a>
## M3: The Jacobian and singularities

**Derive on paper**
- Spin only joint i at 1 rad/s. Everything beyond it turns rigidly about a line. Which line, in world coordinates? (A point on it comes from frame i; its direction is frame i's rotation applied to the joint's local axis.)
- A point at r on a body spinning with angular velocity ω about a line through c moves with what velocity? So what are the linear rows and the angular rows of column i?
- Sanity check on the planar two-link arm: differentiate its tip by hand and compare with your column formula.
- Why is J Jᵀ symmetric positive semi-definite? Using J = UΣVᵀ, express det(J Jᵀ) through the singular values, and show that the image of the unit ball of joint speeds is an ellipsoid. What are its semi-axes?
- For the planar two-link arm with lengths ℓ₁, ℓ₂, compute √det(J Jᵀ). When is it zero, and what does the arm look like then?

**Write**: `geometricJacobian` and `manipulability` in `src/projects/jacobian/core/jacobian.ts`.

**Check**
- `npx vitest run src/projects/jacobian/core/__tests__/jacobian.test.ts`: every column checked against central finite differences of *your* `forwardKinematics` (linear rows from d(tool)/dq, angular rows from dR/dq Rᵀ = [ω]×), the hand-worked planar Jacobian, manipulability of diagonal and rank-deficient matrices, invariance under a rotation of task space, scaling as cᵐ, the planar two-link law, and the page's arm singular when it stands straight up.
- Predict before you run it: on the page, slide the elbow and the wrist pitch to 0 so the whole arm is one straight line. Which direction can the tool no longer move in, and which singular value collapses? Why is straightening the elbow alone not enough with six joints? Look at the ellipsoid first.

**Unlocks**: the velocity ellipsoid on the hero, plus the *near singular* glitch; section 04, *Which way can it move?*: pick a joint and see its column as a spin axis and a tool-velocity arrow, a live finite-difference check, σ₁ σ₂ σ₃, w and the condition number; with `manipulability`, a dithered map of w over shoulder × elbow computed in a worker (tap it to jump there). The workspace cloud gets shaded by w.

---

<a id="m4-ik"></a>
## M4: Inverse kinematics by damped least squares

**Derive on paper**
- Minimise ‖J δq − e‖² + λ²‖δq‖². Set the gradient to zero: you get an n × n linear system. Prove the push-through identity (JᵀJ + λ²I)⁻¹Jᵀ = Jᵀ(JJᵀ + λ²I)⁻¹. With 3 task rows and 6 joints, which side is cheaper?
- λ = 0 with J of full row rank: show J δq = e exactly and that δq lies in the row space of J, hence is the minimum-norm solution. λ → ∞: what does λ²δq tend to?
- Write J = UΣVᵀ and work out the gain DLS applies along a direction with singular value σ. Sketch it against σ. Where is it largest? What happens as σ → 0 with λ = 0, and with λ > 0? That sketch is the whole story of section 05.
- Orientation error. Take the trace and the antisymmetric part R − Rᵀ of your Rodrigues formula; read θ and k back out. Where does that break down (θ near 0, θ near π), and what do you do instead at each? Why does the error rotation have to be R_goal Rᵀ (and not Rᵀ R_goal) to match the world-frame angular rows of J?

**Write**: `dlsStep` in `src/projects/jacobian/core/ik.ts`, `so3Log` in `src/projects/jacobian/core/se3.ts`.

**Check**
- `npx vitest run src/projects/jacobian/core/__tests__/ik.test.ts`: the damped normal equations for 3 × 6, 6 × 6 and 2 × 5 Jacobians, exact and minimum-norm at λ = 0, the λ → ∞ limit, finite on a singular J, and full IK loops on the six-joint arm (position only, then position + orientation with `so3Log`).
- `npx vitest run src/projects/jacobian/core/__tests__/se3.test.ts` (the `so3Log` block): known axes, ‖ω‖ ∈ [0, π], tiny angles, θ = π and just below, and the round trip with `rodrigues`.
- Predict before you run it: with λ = 0, what happens to the joint speed ‖δq‖ as the target passes straight over the base? With λ = 0.3 the arm calms down, but what does it give up?

**Unlocks**: the hero arm chases your finger (or the firefly); section 05, *Reach through a singularity*: two arms, damped (solid) and an undamped twin (dashed), flying a target over the top where the arm is fully stretched, with a live joint-speed chart; *Tool points down* switches to 6-D IK with your `so3Log`.

---

<a id="m5-lqr"></a>
## M5: Discrete LQR by the Riccati recursion

**Derive on paper**
- System x_{k+1} = A x_k + B u_k, cost Σ xᵀQx + uᵀRu. Guess the optimal cost-to-go is quadratic, V(x) = xᵀPx. One step back: minimise xᵀQx + uᵀRu + V(Ax + Bu) over u. Expand, differentiate, set to zero: that is the gain K in u = −Kx.
- Substitute u = −Kx back in and collect the terms quadratic in x: that is the new P. Do the scalar case (a, b, q, r) by hand first, then the matrix case, minding the order of products.
- The infinite-horizon P is the fixed point. In the scalar case the fixed-point equation is a quadratic in p: which root is the right one, and why?
- For a scalar policy u = −kx, the closed-loop cost from x₀ is a geometric series. Sum it, minimise over k, and check you get the same k as the fixed point (one of the tests does exactly this numerically).
- Why does iterating backwards from P = Q converge when (A, B) can be stabilised? What is ρ(A − BK) for the converged gain?

**Write**: `riccatiStep` and `dlqr` in `src/projects/jacobian/core/lqr.ts`.

**Check**
- `npx vitest run src/projects/jacobian/core/__tests__/lqr.test.ts`: checked from the definition, not the formula: your K really minimises the one-step cost and your P′ equals that minimum (one and two inputs), `dlqr` matches a brute-force search over k on a scalar unstable system, is a fixed point of your `riccatiStep`, stabilises a double integrator and beats every nearby gain on the true infinite-horizon cost, and balances the linearised cart-pole.
- Predict before you run it: make R 100× bigger. Does the cart move more or less to catch a kick? Does the region of starting states it can recover from grow or shrink?

**Unlocks**: section 06, *Balance a pole*: the convergence of ‖P_{k+1} − P_k‖ on a log axis (with `riccatiStep` alone), then a cart-pole balanced by your gain under full nonlinear physics with a force limit (tap to kick it), the cost-to-go xᵀPx as dithered contour bands with the state crawling into the bowl, sliders for Q and R, and a worker-computed map of the region of attraction.

---

<a id="m6-kalman"></a>
## M6: The Kalman filter

**Derive on paper**
- If x ~ N(μ, Σ), what is the distribution of F x + w with w ~ N(0, Q) independent? That is predict.
- Scalar update: prior N(μ, p), measurement z = x + v, v ~ N(0, r). Multiply the two Gaussians and write the posterior mean as μ + k(z − μ). What are k and the posterior variance? Check r → 0 and r → ∞.
- Generalise to z = Hx + v: what is the covariance S of the innovation y = z − Hx̂? What gain K minimises the posterior error covariance?
- Derive the Joseph form of the covariance update. Why does it stay symmetric and positive definite when the short form (I − KH)P can drift?
- For a static state (F = I, Q = 0), show that running the filter over measurements gives the same answer as regularised batch least squares, in any order.
- The page uses a constant-velocity model with white-noise acceleration q. Where do the dt³/3, dt²/2 and dt entries of Q come from?

**Write**: `kalmanPredict` and `kalmanUpdate` in `src/projects/jacobian/core/kalman.ts`.

**Check**
- `npx vitest run src/projects/jacobian/core/__tests__/kalman.test.ts`: predict checked against 40,000 pushed-through samples, uncertainty growing without measurements, the innovation and its covariance checked by sampling, a perfect and a useless sensor, equality with batch least squares, P staying symmetric positive definite with a very sharp sensor, and statistical consistency (average NEES ≈ state dimension) on a simulated target.
- Predict before you run it: switch the camera off for two seconds. Does the covariance ellipsoid stretch first along the firefly's direction of motion or across it? Why?

**Unlocks**: section 07, *Catch a firefly*: noisy measurements, your estimate with its 3σ ellipsoid and a predicted path, a camera switch that makes the ellipsoid balloon, raw-vs-filtered error, and a tuning curve of error against q from 252 noisy runs in a worker. Once M4 is done the arm reaches for where the firefly is about to be, and the hero chases the Kalman estimate instead of the truth.

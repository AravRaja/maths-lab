# Jacobian

A six-joint robot arm in the browser, built from bare 4 × 4 matrices. It chases your finger through singularities, balances a pole with LQR and catches a firefly it can only see through noise. Live at `/jacobian`.

## What it shows

- **The arm, dithered.** No three.js and no robotics library: a small software renderer projects the arm, draws its soft body into a low-resolution layer, Bayer-dithers that layer to five greys every frame, and puts hairline strokes on top. The velocity ellipsoid rides on the tool and flattens into a disc as the arm approaches a singularity, at which point the picture breaks into static.
- **Spin a frame.** Rodrigues' formula as geometry: the axis, the swept wedge, the rotated triad, and a rigid transform beside its closed-form inverse.
- **Pull the strings.** Forward kinematics with a triad at every joint, and a 30,000-pose workspace cloud sampled in a Web Worker.
- **Which way can it move?** Each Jacobian column drawn as a spin axis and a tool-velocity arrow, checked live against finite differences, plus a worker-computed manipulability map over shoulder × elbow that you can tap to jump to.
- **Reach through a singularity.** Damped least squares IK next to an undamped twin, both flying a target over the top of the arm, with the joint speed of each on a chart. A switch turns it into full 6-D pose IK using the SO(3) log map.
- **Balance a pole.** Discrete LQR from the Riccati recursion on a linearised cart-pole, run against the full nonlinear physics with a force limit. The cost-to-go is drawn as dithered contour bands, and a worker maps the region of attraction.
- **Catch a firefly.** A constant-velocity Kalman filter on noisy 3-D measurements, with its 3σ ellipsoid, a predicted path, a camera you can switch off, and a tuning curve over the process noise. The arm reaches for where the firefly is about to be.

## The maths is mine

Eleven functions in `core/`, each a stub until I write it: `rodrigues`, `invertSE3`, `so3Log`, `forwardKinematics`, `geometricJacobian`, `manipulability`, `dlsStep`, `riccatiStep`, `dlqr`, `kalmanPredict`, `kalmanUpdate`. Their tests in `core/__tests__/` check the maths against geometry, finite differences, sampling and brute-force optimisation rather than against another copy of the formula. The learning path is in [LEARNING.md](./LEARNING.md).

Everything else (the renderer, the physics, the IK loop around `dlsStep`, the workers, the UI) is scaffolding written by Claude Code.

## Layout

| Path | What |
| --- | --- |
| `core/` | The eleven maths cores and their tests |
| `lib/linalg.ts` | Small dense linear algebra (solve, det, symmetric eigen, expm, 4 × 4 helpers) |
| `lib/arm.ts` | The six-joint arm, limits, home pose |
| `lib/ik-loop.ts` | The IK outer loop: error vector, clamping, joint limits |
| `lib/cartpole.ts` | Cart-pole physics, RK4, linearisation and exact discretisation |
| `lib/tracker.ts` | Constant-velocity model and the firefly's flight |
| `components/scene.ts` | The software 3D renderer and dithered glow layer |
| `components/stage.tsx` | Camera, orbit and pointer handling around the renderer |
| `workers/` | Workspace sampling, manipulability map, region of attraction, Kalman tuning sweep |

# Say and reach

**Type "push the box away" and a robot arm does it, using a policy it learned in your browser a minute ago.**

<!-- screenshot / GIF: drop docs/hero.gif here (the hero loop with the flow head trained) -->

A tiny vision-language-action model, end to end, in one static web page. A three-joint arm sits at the edge of a dithered table with a cube, a ball and a wedge. You type a command. A scripted expert can follow keywords, but the interesting part is the learned policy: it only sees a bag of hashed word vectors and where things are, and it learns from demonstrations what "box", "sphere", "west" and "closer" mean. Then it does the task on commands it has never heard, like "shove the puck rightwards".

Each policy trains in a Web Worker in about 30 seconds. No server, no Python, no GPU.

## How it works

1. **Kinematics** (mine). Forward kinematics turns joint angles into positions. The Jacobian says how the fingertip moves when each joint twitches.
2. **Inverse kinematics** (mine). Damped least squares, δθ = Jᵀ(JJᵀ + λ²I)⁻¹e, turns "move the fingertip by e" into joint motion and stays calm near singular poses. Every policy outputs a fingertip velocity, and IK makes the arm follow it.
3. **The expert.** A scripted controller walks round the named object and pushes it. It records demonstrations with a little action noise, so they show how to recover from small mistakes (DART).
4. **The policy network.** Word-to-object attention picks the object the command is about (α = softmax(Kq/√d)). Then a FiLM network lets the words scale and shift its hidden layers, the conditioning trick RT-1 uses. The network and its backprop are hand-written plumbing.
5. **Two policy heads** (the losses are mine).
   - *Gaussian, behaviour cloning*: maximise the likelihood of the expert's action under N(μ, σ²). The page draws μ ± σ at the fingertip.
   - *Flow matching*: learn the velocity that carries Gaussian noise along straight lines to the expert's action, then sample by Euler-integrating it. This is the signature visual: a cloud of noise samples streaming into the arm's next move.
6. **Scoring** (mine). Discounted returns and potential-based reward shaping, r′ = r + γΦ(s′) − Φ(s), on held-out commands whose word pairings never appeared in training. The page checks the telescoping identity G′ − G = γᵀΦ(s_T) − Φ(s₀) live.

With the default settings (500 demos, 4,000 steps) both learned heads succeed on almost every held-out command.

### The cores are mine

The eight maths functions in [`src/projects/say-and-reach/core/`](core) are mine: `forwardKinematics`, `jacobian`, `dlsStep`, `gaussianNll`, `flowPair`, `eulerSample`, `discountedReturn` and `shapedRewards`. [`LEARNING.md`](LEARNING.md) is the path I followed: what to derive on paper, what to write, and how the tests in `src/projects/say-and-reach/core/__tests__/` (finite-difference gradient checks, closed forms, invariants, convergence) say it's right. Until a core is written the app still runs, and shows a *Yours to write* panel where that part will appear.

Claude Code built the scaffolding: the simulator, expert, network plumbing, workers, rendering and UI.

## Stack

Next.js 16 (App Router, static export) · React 19 · TypeScript · Tailwind v4 · Base UI + shadcn · Spectrum UI · Canvas 2D with Bayer dithering · Web Workers · Vitest. Strictly black and white, Archivo, phone-first.

## Run locally

```sh
npm ci
npm run dev                                 # http://localhost:3000/say-and-reach
npx vitest run src/projects/say-and-reach/core        # this project's maths: fails until the cores are written
npm run check                               # lint + types + scaffolding tests + build
```

On the page: record demos and train a head in section 05, give commands in section 04, watch the flow in section 06 and score everything in section 07.

## Layout

| Path | What |
| --- | --- |
| `src/projects/say-and-reach/core/` | The maths cores (mine) and their tests |
| `src/projects/say-and-reach/lib/arm/` | Tabletop sim, language, expert, training loops, evaluation |
| `src/projects/say-and-reach/lib/nn/` | FiLM network with word-to-object attention, hand-written backprop, Adam |
| `src/projects/say-and-reach/workers/train.worker.ts` | Demo recording, training and evaluation off the main thread |
| `src/projects/say-and-reach/components/` | Hero loop, playground, training, flow view, scoreboard |
| `src/kit/` | The lab kit: NotYoursYet panels, charts, dithering, canvas and worker hooks |

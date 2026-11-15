# Daydream

**A world model small enough to understand completely.** A ball bounces in a box. The model sees it only as a 20×20 grey frame. A β-VAE compresses each frame into a Gaussian over **two numbers**. A latent dynamics model then learns how those two numbers move when the ball is pushed, jumps or bounces. Close the model's eyes and it keeps the ball going in its head, on a screen next to the real one, until reality and the dream drift apart. Kick the ball while it's watching and its surprise spikes.

It runs entirely in the browser. Training takes about half a minute for the VAE and fifteen seconds for the dynamics, in Web Workers, and works on a phone.

## What's on the page

1. **The world**: the ball, the controls, and the 400 numbers that are all the model ever sees.
2. **Gradients through a coin toss**: the reparameterisation trick and the KL term acting on one draggable 2-D Gaussian.
3. **Teach it to see**: β-VAE training, with a live ELBO, reconstructions and the latent cloud organising itself by the ball's true position.
4. **Walk around its mind**: an atlas of decoded frames over the latent plane, with a cursor you can drag anywhere.
5. **Close its eyes**: the dynamics model is trained on 12-step open-loop rollouts, then reality and the dream run side by side. A hold-to-dream button, dream noise and drift curves.
6. **Catch it off guard**: surprise, measured as `KL(what it sees ‖ what it expected)`, spiking at every unseen kick.

## The maths I wrote

The ten core functions are mine: the reparameterised sample and its backward pass, the Gaussian KL and its gradient, the Bernoulli log-likelihood and its gradient, the ELBO, the Gaussian NLL for the dynamics and its gradient, and the KL between two diagonal Gaussians. Each one is checked against closed forms, numerical integration and finite differences, and an end-to-end test trains a model through all of them. See [LEARNING.md](./LEARNING.md).

The scaffolding was built by Claude Code: the simulator, the MLPs with hand-written backprop, Adam, the training loops (including backprop through time for the dynamics rollouts), the workers and every visual.

## Layout

```
core/         the ten maths cores (mine) + tests
lib/world.ts  ball-in-a-box physics and rendering
lib/mlp.ts    dense layers, backprop, Adam
lib/vae.ts    encoder/decoder + the β-VAE step (calls the cores)
lib/dynamics.ts  latent dynamics model + rollout training (calls the cores)
lib/train.ts  dataset and training loops (shared by the worker and the tests)
lib/dreamer.ts   eyes open: encode; eyes closed: imagine
workers/      training off the main thread
components/   hero, sections, canvas drawing
```

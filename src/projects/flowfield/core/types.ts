/** A velocity field v(x, t): a point in R^d and a flow time in [0, 1] to a velocity in R^d. */
export type Velocity = (x: number[], t: number) => number[];

/** One action chunk predicted at control step `start`: actions[k] is meant for step start + k. */
export interface ChunkPrediction {
  start: number;
  actions: number[][];
}

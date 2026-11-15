/** Physical constants of the tabletop. Metres and seconds. */
export const LINKS = [0.55, 0.45, 0.3];
export const REACH = LINKS.reduce((a, b) => a + b, 0);
export const HOME: number[] = [2.0, -1.3, -1.1];
export const TIP_R = 0.035;
export const OBJ_R = 0.07;
export const DT = 1 / 20;
/** Max fingertip speed. Actions are unit-scaled: |a| ≤ 1 means up to VMAX. */
export const VMAX = 0.5;
export const IK_LAMBDA = 0.06;
export const EPISODE_STEPS = 110;
export const PUSH_DIST = 0.25;
/** Objects are kept on the table. */
export const TABLE = { x0: -1.0, x1: 1.0, y0: 0.22, y1: 1.22 };
/** Visible world rectangle (4:3). */
export const VIEW = { x0: -1.2, x1: 1.2, y0: -0.18, y1: 1.62 };

/**
 * Whether the mill is turning.
 *
 * The sails were the most eye catching thing on the continent and the only one
 * of its moving parts that never moved. Now E at the mill lets them off the
 * brake.
 *
 * Speed is ramped rather than switched, because a windmill has real mass: the
 * sails take a few seconds to come up to speed and considerably longer to wind
 * down, which is most of what makes them read as heavy rather than as a
 * spinning texture.
 *
 * This file must never import `three`.
 */

/** Radians per second at full speed. About one turn every eight seconds, which
 *  is the pace a big mill actually keeps. */
const TOP_SPEED = 0.78;
/** Seconds to reach it. */
const SPIN_UP_TAU = 2.2;
/** Seconds to coast back down, once the brake is on. */
const SPIN_DOWN_TAU = 4.5;

export const mill = {
  /** True while the brake is off. */
  running: false,
  /** Current sail angle, radians. Accumulates; the renderer reads it directly
   *  so nothing has to know how long the scene has been open. */
  angle: 0,
  /** Current angular speed, radians per second. */
  speed: 0,
};

/** Advance the sails one frame. */
export function stepMill(dt: number) {
  const target = mill.running ? TOP_SPEED : 0;
  const tau = mill.running ? SPIN_UP_TAU : SPIN_DOWN_TAU;
  mill.speed += (target - mill.speed) * (1 - Math.exp(-dt / tau));
  if (!mill.running && mill.speed < 0.004) mill.speed = 0;
  mill.angle += mill.speed * dt;
  // Wrapped, or a tab left open all afternoon accumulates a number big enough
  // to lose float precision in the sails' rotation.
  if (mill.angle > Math.PI * 2) mill.angle -= Math.PI * 2;
}

/** Returns the new state, so the caller can pick the sound. */
export function toggleMill(): boolean {
  mill.running = !mill.running;
  return mill.running;
}

export function resetMill() {
  mill.running = false;
  mill.angle = 0;
  mill.speed = 0;
}

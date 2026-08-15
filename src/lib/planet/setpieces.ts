/**
 * One-off events the visitor can trigger, and their timing.
 *
 * A mutable singleton read by the render loop, exactly like `input` and
 * `compass`: the rocket's transform is recomputed every frame from `launchAt`,
 * so routing it through React state would re-render the scene tree at the
 * frame rate to communicate one number.
 *
 * Times are the r3f clock's elapsed seconds, not wall clock, so a suspended
 * tab does not fast-forward the launch while nobody is watching.
 *
 * This file must never import `three`.
 */

/** Seconds from ignition to standing back on the pad, ready to go again. */
export const ROCKET_CYCLE_S = 21;

/** Timeline within one cycle. */
export const ROCKET = {
  /** Holding down, shaking, exhaust building. */
  ignition: 1.6,
  /** Climbing out of sight. */
  ascentEnd: 7,
  /** Out of the world entirely. */
  returnStart: 16,
  /** Back on the pad. */
  landed: 20.5,
} as const;

export const setpieces = {
  /** Elapsed time at which the current launch began, or -1 when idle. */
  rocketLaunchAt: -1,
};

/** True while a launch is in progress, so the prompt hides and E does nothing. */
export function rocketBusy(now: number): boolean {
  return (
    setpieces.rocketLaunchAt >= 0 &&
    now - setpieces.rocketLaunchAt < ROCKET_CYCLE_S
  );
}

/** Returns false when a launch is already running. */
export function launchRocket(now: number): boolean {
  if (rocketBusy(now)) return false;
  setpieces.rocketLaunchAt = now;
  return true;
}

/** Seconds since ignition, or -1 when idle. */
export function rocketElapsed(now: number): number {
  if (setpieces.rocketLaunchAt < 0) return -1;
  const t = now - setpieces.rocketLaunchAt;
  return t < ROCKET_CYCLE_S ? t : -1;
}

/**
 * How hard the ground is shaking, 0..1.
 *
 * Peaks through ignition and fades out over the first part of the climb, which
 * is the only window where the engine is both lit and still close by.
 */
export function rocketShake(now: number): number {
  const t = rocketElapsed(now);
  if (t < 0) return 0;
  if (t < ROCKET.ignition) return Math.min(1, t / 0.5);
  const fade = 1 - (t - ROCKET.ignition) / 2.4;
  return fade > 0 ? fade : 0;
}

/** Engine output, 0..1: drives the exhaust plume and the rumble. */
export function rocketThrust(now: number): number {
  const t = rocketElapsed(now);
  if (t < 0) return 0;
  if (t < ROCKET.ignition) return t / ROCKET.ignition;
  if (t < ROCKET.ascentEnd) return 1;
  if (t >= ROCKET.returnStart && t < ROCKET.landed) return 0.45;
  return 0;
}

/**
 * Height above the pad in world units, and whether the rocket should be drawn
 * at all. Out of sight between the two legs rather than teleporting back.
 */
export function rocketAltitude(now: number): { y: number; visible: boolean } {
  const t = rocketElapsed(now);
  if (t < 0) return { y: 0, visible: true };

  if (t < ROCKET.ignition) return { y: 0, visible: true };

  if (t < ROCKET.ascentEnd) {
    const u = (t - ROCKET.ignition) / (ROCKET.ascentEnd - ROCKET.ignition);
    // Accelerating, not linear: a constant-speed launch reads as an elevator.
    return { y: Math.pow(u, 2.4) * 430, visible: true };
  }

  if (t < ROCKET.returnStart) return { y: 430, visible: false };

  if (t < ROCKET.landed) {
    const u = (t - ROCKET.returnStart) / (ROCKET.landed - ROCKET.returnStart);
    // Decelerating into the pad, the mirror of the climb.
    return { y: Math.pow(1 - u, 2.4) * 430, visible: true };
  }

  return { y: 0, visible: true };
}

/**
 * Where the sun is, as a pure function of time.
 *
 * THERE IS NO GLOBAL "NIGHT" VALUE HERE, deliberately. The obvious way to
 * build a day cycle is a 0..1 darkness scalar that everything multiplies by,
 * but that is a lie on a planet you can walk around: at any instant half the
 * world is lit and half is not, and the visitor is standing on one specific
 * half. So the only thing that moves is the sun, and "night" is a local
 * question answered per point by `darknessAt`. The payoff is that the
 * terminator genuinely sweeps across the archipelago and you can watch dawn
 * arrive, rather than the whole scene dimming in lockstep.
 *
 * It also fixes a real problem with the fixed sun this replaces: with five
 * islands spread over a sphere, two of them were in permanent darkness.
 *
 * This file must never import `three`.
 */

import type { Dir } from "./layout";

/** Seconds for one full revolution. Long enough that the sky is not
 *  distracting, short enough that a visitor who stays a few minutes sees the
 *  light change. */
export const DAY_LENGTH_S = 180;

/** How far out the sun is drawn. Inside CAM_FAR with room for the camera's own
 *  offset from the origin at maximum zoom. */
export const SUN_DISTANCE = 220;

let frozen: number | null | undefined;

/** Test hook: `?time=0.5` pins the cycle, matching the `?lowpower` convention
 *  in lib/device.ts. Without it the sun runs. */
function frozenPhase(): number | null {
  if (frozen !== undefined) return frozen;
  frozen = null;
  if (typeof window !== "undefined") {
    const raw = new URLSearchParams(window.location.search).get("time");
    if (raw !== null) {
      const n = Number(raw);
      if (Number.isFinite(n)) frozen = ((n % 1) + 1) % 1;
    }
  }
  return frozen;
}

/** Cycle position in [0, 1). */
export function dayPhase(seconds: number): number {
  const f = frozenPhase();
  if (f !== null) return f;
  const t = (seconds / DAY_LENGTH_S) % 1;
  return t < 0 ? t + 1 : t;
}

/**
 * The planet's spin axis, and the single most important fact about the sky.
 *
 * The sun does not orbit the planet: the PLANET TURNS, and from the ground
 * that reads as the whole celestial sphere rotating about one axis. So the
 * sun, the moon, the stars and the gas giant are not four independent
 * animations, they are one rotation with four things attached to it. `sky.tsx`
 * puts all of them in a single group and turns that group about this axis by
 * `2 * PI * phase`; the sun's position falls out of that for free.
 *
 * This is the normal of the plane the sun's path lies in, which is
 * cross((1,0,0), (0, 0.5, 0.866)) normalised. Anything that changes
 * `sunDirection` has to change this to match, or the stars will drift against
 * the sun and the illusion collapses.
 */
export const SPIN_AXIS: Dir = { x: 0, y: -0.8660254, z: 0.5 };

/** Where the sun sits at phase 0, in the celestial group's local frame. */
export const SUN_AT_ZERO: Dir = { x: 1, y: 0, z: 0 };

/**
 * Unit vector from the planet centre toward the sun.
 *
 * Equivalent to rotating SUN_AT_ZERO about SPIN_AXIS by `2 * PI * phase`
 * (Rodrigues reduces to `v cos + (axis x v) sin` because the two are
 * perpendicular). Kept as an explicit formula because the lighting reads it
 * every frame and this is cheaper than building a quaternion.
 *
 * The path is a great circle tilted 30 degrees off the XZ plane. Tilted rather
 * than equatorial because a great circle passes within 90 degrees of EVERY
 * point on the sphere, so every island gets a real day; the tilt just stops
 * the path from running through the archipelago's own plane and making the
 * lighting on all five look identical.
 */
export function sunDirection(phase: number): Dir {
  const th = phase * Math.PI * 2;
  const s = Math.sin(th);
  return { x: Math.cos(th), y: s * 0.5, z: s * 0.8660254 };
}

/**
 * How dark a surface point is, from its dot product with the sun direction.
 * 0 in full sun, 1 well past the terminator, with a soft band between so dusk
 * takes a while rather than switching.
 */
export function darknessAt(dotWithSun: number): number {
  const t = Math.min(1, Math.max(0, (0.14 - dotWithSun) / 0.34));
  return t * t * (3 - 2 * t);
}

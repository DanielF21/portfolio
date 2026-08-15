/**
 * The snowball you are carrying, and the ones in the air.
 *
 * A mutable singleton for the same reason as `input`, `shipState` and
 * `setpieces`: this changes every frame, and three separate consumers read it
 * (the player's hand, the flying instances, the HUD prompt). React state would
 * re-render the scene tree to report a parabola.
 *
 * Flight is integrated the same way everything else on this planet moves: a
 * snowball has a position on the sphere and a unit tangent it is travelling
 * along, and a step is a ROTATION of that pair about the axis perpendicular to
 * both. Altitude is separate and purely radial, exactly as the player's jump
 * is. Nothing here needs to know where the ground is, because on a world with
 * no terrain elevation the ground is always at altitude zero.
 *
 * This file must never import `three`.
 */

import { GRAVITY, SNOWBALL_LOFT, SNOWBALL_POOL, SNOWBALL_SPEED } from "./config";
import type { Dir } from "./layout";
import { registerHit, resetTargets, targetAt } from "./targets";

export interface Snowball {
  /** Unit position on the sphere. */
  dir: Dir;
  /** Unit tangent it is travelling along, carried and re-orthogonalised each
   *  step rather than re-derived, as the ship's bow is. */
  fwd: Dir;
  /** World units above the surface. */
  alt: number;
  /** Vertical speed, world units per second. */
  vAlt: number;
  /** Horizontal speed, world units per second. */
  speed: number;
  /** False for a slot that is free. */
  live: boolean;
  /** Seconds since it landed, or -1 while still in the air. Drives the little
   *  burst of snow where it hit, then frees the slot. */
  splat: number;
}

/** How long the mark where a snowball landed stays, seconds. */
export const SPLAT_S = 0.45;

function empty(): Snowball {
  return {
    dir: { x: 0, y: 1, z: 0 },
    fwd: { x: 1, y: 0, z: 0 },
    alt: 0,
    vAlt: 0,
    speed: 0,
    live: false,
    splat: -1,
  };
}

export const snowballs = {
  /** True while the player is carrying one. */
  holding: false,
  /** Fixed pool, oldest recycled. Never grows, never allocates in the loop. */
  pool: Array.from({ length: SNOWBALL_POOL }, empty),
  next: 0,
  /** Clock time of the last hit on something solid, so the renderer can play a
   *  sound for it without the simulation knowing what audio is. */
  struckAt: -1e9,
};

/** Take one off the pile. */
export function pickUpSnowball() {
  snowballs.holding = true;
}

/**
 * Throw the one you are carrying.
 *
 * `from` and `along` are the player's position and facing; `alt` is where the
 * hand is, so a snowball thrown off the ship's deck starts at deck height
 * rather than at sea level.
 */
export function throwSnowball(from: Dir, along: Dir, alt: number) {
  if (!snowballs.holding) return;
  snowballs.holding = false;

  const b = snowballs.pool[snowballs.next];
  snowballs.next = (snowballs.next + 1) % snowballs.pool.length;

  b.dir = { x: from.x, y: from.y, z: from.z };
  b.fwd = { x: along.x, y: along.y, z: along.z };
  b.alt = alt;
  b.vAlt = SNOWBALL_LOFT;
  b.speed = SNOWBALL_SPEED;
  b.live = true;
  b.splat = -1;
}

/**
 * Advance every snowball in the air one frame.
 *
 * `now` is the r3f clock, needed only to stamp a hit; everything else here is
 * integrated from `dt` and holds no time of its own.
 */
export function stepSnowballs(dt: number, radius: number, now: number) {
  for (const b of snowballs.pool) {
    if (!b.live) continue;

    if (b.splat >= 0) {
      b.splat += dt;
      if (b.splat > SPLAT_S) b.live = false;
      continue;
    }

    b.vAlt -= GRAVITY * dt;
    b.alt += b.vAlt * dt;

    const a = (b.speed * dt) / radius;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const { dir, fwd } = b;
    // Rotating about cross(dir, fwd) by `a` sends the position along the
    // tangent and tips the tangent by the same arc, which keeps the two
    // perpendicular without a normalisation step per frame.
    const nx = dir.x * c + fwd.x * s;
    const ny = dir.y * c + fwd.y * s;
    const nz = dir.z * c + fwd.z * s;
    b.fwd = { x: fwd.x * c - dir.x * s, y: fwd.y * c - dir.y * s, z: fwd.z * c - dir.z * s };
    const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    b.dir = { x: nx / l, y: ny / l, z: nz / l };

    // Something solid, before the ground: a target is checked after the step so
    // the ball is tested where it actually is, and a hit ends the flight at that
    // point rather than letting it pass through and land beyond.
    const hit = targetAt(b.dir, b.alt);
    if (hit) {
      registerHit(hit.id, now);
      b.splat = 0;
      snowballs.struckAt = now;
      continue;
    }

    if (b.alt <= 0) {
      b.alt = 0;
      b.splat = 0;
    }
  }
}

/** Drop everything: leaving the stage must not leave a snowball mid-flight for
 *  the next visit to inherit. */
export function resetSnowballs() {
  snowballs.holding = false;
  snowballs.next = 0;
  snowballs.struckAt = -1e9;
  resetTargets();
  for (const b of snowballs.pool) {
    b.live = false;
    b.splat = -1;
  }
}

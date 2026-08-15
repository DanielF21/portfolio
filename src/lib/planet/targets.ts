/**
 * Things a snowball can hit.
 *
 * Throwing was already possible and nothing in the world knew it: the ball
 * landed, made a small mark, and that was the whole of it. A target is the
 * cheapest possible fix, one dot product per ball per target, and it turns the
 * pile of snowballs from a prop into a reason to go somewhere.
 *
 * WHAT A HIT DOES IS A WOBBLE, not a knocked-off head. Every candidate target
 * is a single merged GLB mesh (the snowman's head is not a separate node, the
 * watermill's wheel is not either), so nothing can come apart. A struck object
 * rocks back and settles instead, which works for any shape and needs no model
 * changes.
 *
 * Positions come from `SCENERY` rows matched by id, the same rule the
 * interactables follow, so a target cannot drift away from the thing it stands
 * for.
 *
 * This file must never import `three`.
 */

import { RADIUS } from "./config";
import type { Dir } from "./layout";
import { resolveSceneryDir, SCENERY } from "./world-layout";

export interface Target {
  readonly id: string;
  readonly dir: Dir;
  /** Angular radius of the hit box, radians. */
  readonly radius: number;
  /** World units. A ball passing over the top is not a hit. */
  readonly height: number;
}

/**
 * Which scenery is hittable, by id, with the world-unit radius of its trunk or
 * body. Generous next to the physical footprint: a snowball is thrown by eye at
 * a distance, and a target that demands precision is a target nobody hits
 * twice.
 */
const HITTABLE: Readonly<Record<string, { radius: number; height: number }>> = {
  snowman: { radius: 1.1, height: 2.2 },
  "snow-tree-a": { radius: 1.0, height: 3.0 },
  "snow-tree-b": { radius: 1.0, height: 3.2 },
  "snow-tree-c": { radius: 0.9, height: 2.6 },
  "snow-tree-d": { radius: 0.9, height: 2.9 },
  "mushroom-red": { radius: 1.3, height: 2.4 },
  "mushroom-tan": { radius: 1.3, height: 2.2 },
  // The piano is here for the wobble rather than for the snowball: pressing a
  // key registers a hit on it, so the instrument nods when it sounds. That it
  // can also be hit with a snowball is a consequence, and a fair one.
  piano: { radius: 0.9, height: 1.0 },
};

export const TARGETS: readonly Target[] = SCENERY.filter(
  (item) => item.id && HITTABLE[item.id]
).map((item) => ({
  id: item.id!,
  dir: resolveSceneryDir(item),
  radius: HITTABLE[item.id!].radius / RADIUS,
  height: HITTABLE[item.id!].height,
}));

/** Clock time each target was last struck, keyed by id. */
const struck: Record<string, number> = {};

/** How long a target rocks for, seconds. */
export const WOBBLE_S = 1.1;

export function registerHit(id: string, now: number) {
  struck[id] = now;
}

/**
 * How hard the given target is rocking right now, as a signed -1..1 that
 * oscillates and decays. Zero when it has not been hit, or has settled.
 *
 * A damped sine rather than a one-way lean: the object should overshoot and
 * come back, which is what a struck thing does and what a lerp cannot say.
 */
export function wobble(id: string, now: number): number {
  const at = struck[id];
  if (at === undefined) return 0;
  const t = now - at;
  if (t < 0 || t > WOBBLE_S) return 0;
  const decay = 1 - t / WOBBLE_S;
  return Math.sin(t * 22) * decay * decay;
}

/**
 * The target this snowball is inside, or null.
 *
 * Tested against the ball's CURRENT position rather than swept along its path.
 * At 11 units a second and 60 frames a second a ball moves 0.18 units a frame,
 * an eighth of the smallest hit radius here, so there is nothing for a sweep
 * to catch that this misses.
 */
export function targetAt(dir: Dir, alt: number): Target | null {
  for (const t of TARGETS) {
    if (alt > t.height) continue;
    const dot = dir.x * t.dir.x + dir.y * t.dir.y + dir.z * t.dir.z;
    if (dot > Math.cos(t.radius)) return t;
  }
  return null;
}

export function resetTargets() {
  for (const k of Object.keys(struck)) delete struck[k];
}

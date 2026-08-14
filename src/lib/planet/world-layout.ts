/**
 * The authored placement of everything in the world: where the character
 * spawns, and where every piece of scenery sits.
 *
 * Positions are expressed as (district, bearing, arc) in the district's
 * tangent frame rather than raw xyz: move a district in `districts.ts` and its
 * contents follow; nudge one item by editing two numbers. `placeOnSphere` in
 * `layout.ts` turns these into unit vectors.
 *
 * Bearing convention: 0 = local north (toward +Y projected onto the tangent
 * plane), increasing eastward. The house district's local south (bearing pi)
 * faces the spawn point.
 *
 * This world carries no portfolio content. It used to place 14 markers built
 * from `src/data/resume.tsx`, each opening a project or resume modal; that
 * turned the landing page into a scavenger hunt a first-time visitor had to
 * solve to read a CV. The planet now lives behind an opt-in launcher in the
 * Playground tab and is purely somewhere to walk around, so the marker table
 * is gone and the scenery below is the whole of it.
 *
 * This file must never import `three`.
 */

import { DISTRICT_BY_ID } from "./districts";
import { placeOnSphere } from "./layout";
import type { DistrictId, SpawnPoint } from "./types";

interface Dir {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** 0.5 rad south of the house-island centre (unit to 4 decimals): exactly on
 *  the island's beach at the waterline, facing up the sand toward the house.
 *  Clear of every trigger (nearest marker is 0.28 rad away). */
export const SPAWN: SpawnPoint = { x: 0, y: -0.3897, z: 0.9209 };

// ---------------------------------------------------------------- scenery

export interface SceneryItem {
  /** assetId into ASSETS, or "proc:mountain" for the procedural hero. */
  readonly asset: string;
  /** District whose tangent frame places this item, or "wilds" with an
   *  explicit `centre`. */
  readonly district: DistrictId | "wilds";
  /** Frame centre for wilds items; ignored (district centre) otherwise. */
  readonly centre?: Dir;
  readonly bearing: number;
  readonly arc: number;
  /** Rotation about the surface normal, radians. */
  readonly heading: number;
  readonly scale: number;
  /** Scatter keep-out radius (radians) around this item. */
  readonly clearAngle: number;
  /** World units to bury the item below the surface. Wide flat bases only
   *  touch a sphere at their centre point; sinking hides the hovering rim. */
  readonly sink?: number;
}

/** Anchors (one per district) that the district beacons rise from. Keyed by
 *  district; values are (bearing, arc) in the district frame. */
export const BEACON_ANCHORS: Readonly<
  Record<DistrictId, { readonly bearing: number; readonly arc: number }>
> = {
  house: { bearing: 0, arc: 0.09 },
  machine: { bearing: 1.4, arc: 0.06 },
  bio: { bearing: 4.0, arc: 0.06 },
  gallery: { bearing: Math.PI, arc: 0.06 },
};

/** Everything inert. None of these get a pad, glow, label, or prompt: that
 *  vocabulary is reserved for content. */
export const SCENERY: readonly SceneryItem[] = [
  // House: the building the personal objects gather around. Hero scales are
  // tuned to the compact RADIUS: landmarks should crown a district, not
  // dwarf the planet.
  { asset: "windmill", district: "house", bearing: 0, arc: 0.09, heading: Math.PI, scale: 1.6, clearAngle: 0.16, sink: 0.06 },

  // Machine island: a rocket on its pad (beacon anchor) and a generator.
  { asset: "rocket", district: "machine", bearing: 1.4, arc: 0.07, heading: 0.6, scale: 0.42, clearAngle: 0.15, sink: 0.1 },
  { asset: "generator", district: "machine", bearing: 3.6, arc: 0.26, heading: 2.1, scale: 1.2, clearAngle: 0.1, sink: 0.08 },

  // Bio island: the giant crystal (beacon anchor) and giant mushrooms.
  { asset: "crystal-large", district: "bio", bearing: 4.0, arc: 0.07, heading: 0.9, scale: 3.5, clearAngle: 0.15, sink: 0.35 },
  { asset: "mushroom-red", district: "bio", bearing: 1.9, arc: 0.28, heading: 0.3, scale: 8, clearAngle: 0.09, sink: 0.06 },
  { asset: "mushroom-tan", district: "bio", bearing: 4.2, arc: 0.3, heading: 4.1, scale: 7, clearAngle: 0.09, sink: 0.06 },

  // Gallery island: pavilion (beacon anchor) with the piano beside it,
  // lanterns marking the approach, and the snowman kept as the deliberate
  // out-of-place joke on a tropical island.
  { asset: "pavilion", district: "gallery", bearing: Math.PI, arc: 0.07, heading: 0, scale: 2.2, clearAngle: 0.18, sink: 0.1 },
  { asset: "piano", district: "gallery", bearing: Math.PI - 0.9, arc: 0.24, heading: 2.4, scale: 0.45, clearAngle: 0.08, sink: 0.04 },
  { asset: "snowman", district: "gallery", bearing: Math.PI + 0.9, arc: 0.24, heading: 5.1, scale: 1.4, clearAngle: 0.07, sink: 0.04 },
  { asset: "lantern", district: "gallery", bearing: -1.5, arc: 0.27, heading: 0, scale: 1.1, clearAngle: 0.05, sink: 0.03 },
  { asset: "lantern", district: "gallery", bearing: -0.5, arc: 0.28, heading: 0, scale: 1.1, clearAngle: 0.05, sink: 0.03 },
  { asset: "lantern", district: "gallery", bearing: 0.5, arc: 0.28, heading: 0, scale: 1.1, clearAngle: 0.05, sink: 0.03 },
  { asset: "lantern", district: "gallery", bearing: 1.5, arc: 0.27, heading: 0, scale: 1.1, clearAngle: 0.05, sink: 0.03 },

  // Ocean: the watermill sits in the channel between the house and machine
  // islands (a water building, at home in the water); the stone bridge spans
  // toward bio; the old mountains are now sea stacks breaking the surface in
  // the channels. Centres are normalized by placeOnSphere.
  { asset: "watermill", district: "wilds", centre: { x: 0.7071, y: 0.4637, z: 0.5338 }, bearing: 0, arc: 0, heading: 2.2, scale: 1.6, clearAngle: 0.13, sink: 0.22 },
  { asset: "bridge", district: "wilds", centre: { x: -0.7071, y: 0.4637, z: 0.5338 }, bearing: 0, arc: 0, heading: 0.8, scale: 2.2, clearAngle: 0.09, sink: 0.12 },
  { asset: "proc:mountain", district: "wilds", centre: { x: 0, y: 0.75, z: -0.66 }, bearing: 0, arc: 0, heading: 0.4, scale: 0.5, clearAngle: 0.18, sink: 0.3 },
  { asset: "proc:mountain", district: "wilds", centre: { x: 0.52, y: -0.6, z: -0.61 }, bearing: 0, arc: 0, heading: 2.9, scale: 0.42, clearAngle: 0.16, sink: 0.25 },
  { asset: "proc:mountain", district: "wilds", centre: { x: -0.62, y: -0.52, z: 0.59 }, bearing: 0, arc: 0, heading: 4.4, scale: 0.55, clearAngle: 0.18, sink: 0.3 },
];

/** World-space unit vector for a scenery item. `placeOnSphere` normalizes,
 *  so wilds centres may be given un-normalized. */
export function resolveSceneryDir(item: SceneryItem): { x: number; y: number; z: number } {
  const centre =
    item.district === "wilds"
      ? item.centre ?? { x: 0, y: 1, z: 0 }
      : DISTRICT_BY_ID[item.district].centre;
  return placeOnSphere(centre, item.bearing, item.arc);
}

/**
 * Per-district scatter prop kits: which shapes dress each district's ground,
 * how big, how deep they sink, and how they are tinted.
 *
 * Shapes are described by id; `scatter.tsx` builds each id once as a merged
 * single-material geometry with baked vertex colours and draws all of its
 * instances in one call, so the draw-call cost is the number of DISTINCT
 * shapes used anywhere, not the instance count.
 *
 * Tinting: instance colours multiply baked vertex colours. Shape parts meant
 * to take the tint are baked white; parts with identity colour (trunks,
 * stems) are baked in their own colour and only darken slightly under tint.
 *
 * This file must never import `three`.
 */

import type { PropKitId } from "./types";

export type PropShapeId =
  | "rock"
  | "boulder"
  | "treeCone"
  | "treeRound"
  | "grassTuft"
  | "flower"
  | "stump"
  | "crate"
  | "pipe"
  | "vent"
  | "crystal"
  | "glowPlant"
  | "snowPine"
  | "iceShard";

export type Rgb = readonly [number, number, number];

export interface KitLayer {
  readonly shape: PropShapeId;
  /** Relative pick weight within the kit. */
  readonly weight: number;
  readonly scale: readonly [number, number];
  /** Fraction of the prop's scale it sinks into the ground. */
  readonly sink: number;
  /** "ground" tints from biomeColor at the spot; an array picks one fixed
   *  colour per instance. */
  readonly tint: "ground" | readonly Rgb[];
  /**
   * Collision footprint as [radius, height] in world units at scale 1, both
   * multiplied by the instance's scale. Omit to make the prop walk-through.
   *
   * Ground clutter (grass, flowers, glow plants) deliberately has none: a
   * world where you catch on every tuft of grass feels broken, not solid.
   *
   * HEIGHT IS ONLY READ BY THE JUMP TEST, never by the renderer, so it is a
   * gameplay statement rather than a measurement: below the 1.19-unit jump
   * apex means "hoppable", above means "walk around it". Because every value
   * here is multiplied by a per-instance random scale, each shape has to land
   * on one side of the apex across its WHOLE scale range, or whether you can
   * clear a given boulder comes down to a hash and reads as broken. Rocks,
   * stumps and vents are hoppable at every scale; boulders, crystals, shards
   * and trees are solid at every scale, which is why the taller ones carry
   * heights well above their apparent size.
   */
  readonly solid?: readonly [radius: number, height: number];
}

export const KITS: Readonly<Record<PropKitId, readonly KitLayer[]>> = {
  // The wilds are open ocean: only rare rock islets break the surface
  // (scatter.tsx additionally thins ocean candidates hard). Fixed sea-stone
  // tints: "ground" would paint them ocean blue.
  wilds: [
    { shape: "boulder", weight: 2, scale: [0.9, 1.8], sink: 0.45, tint: [[0.55, 0.53, 0.48], [0.48, 0.47, 0.45]], solid: [0.7, 2.2] },
    { shape: "rock", weight: 2, scale: [0.6, 1.2], sink: 0.4, tint: [[0.6, 0.57, 0.5]], solid: [0.45, 0.7] },
  ],
  // The continent: ordinary temperate ground, and deliberately the least
  // exotic kit on the planet. It is where you spawn, so it is the baseline
  // every other island is strange relative to.
  shore: [
    { shape: "treeRound", weight: 3, scale: [0.9, 1.5], sink: 0.05, tint: "ground", solid: [0.35, 1.7] },
    { shape: "treeCone", weight: 2, scale: [0.8, 1.4], sink: 0.05, tint: "ground", solid: [0.35, 2.1] },
    {
      shape: "flower",
      weight: 3,
      scale: [0.5, 0.9],
      sink: 0.02,
      tint: [
        [0.95, 0.55, 0.65],
        [0.98, 0.85, 0.4],
        [0.92, 0.92, 0.95],
        [0.7, 0.55, 0.95],
      ],
    },
    { shape: "grassTuft", weight: 3, scale: [0.7, 1.2], sink: 0.05, tint: "ground" },
    { shape: "stump", weight: 1, scale: [0.6, 1.0], sink: 0.1, tint: [[0.45, 0.33, 0.24]], solid: [0.28, 0.4] },
    { shape: "rock", weight: 1, scale: [0.4, 0.8], sink: 0.3, tint: "ground", solid: [0.45, 0.7] },
  ],
  // Volcanic: bare stone and cooling vents. Fixed tints throughout, because
  // "ground" here is near-black ash and would make every prop disappear.
  ember: [
    { shape: "boulder", weight: 3, scale: [0.7, 1.6], sink: 0.35, tint: [[0.26, 0.24, 0.25], [0.34, 0.25, 0.22]], solid: [0.7, 2.2] },
    { shape: "rock", weight: 3, scale: [0.5, 1.1], sink: 0.3, tint: [[0.3, 0.28, 0.28]], solid: [0.45, 0.7] },
    { shape: "vent", weight: 2, scale: [0.6, 1.1], sink: 0.08, tint: [[0.35, 0.3, 0.3]], solid: [0.35, 0.8] },
    { shape: "crystal", weight: 2, scale: [0.5, 1.2], sink: 0.15, tint: [[0.16, 0.14, 0.17], [0.5, 0.22, 0.16]], solid: [0.3, 2.6] },
    { shape: "stump", weight: 1, scale: [0.5, 0.9], sink: 0.12, tint: [[0.2, 0.17, 0.16]], solid: [0.28, 0.4] },
  ],
  // Ice. `snowPine` and `iceShard` have existed in the shape table since it
  // was written and were never used by any kit; this is what they were for.
  frost: [
    { shape: "snowPine", weight: 3, scale: [0.9, 1.6], sink: 0.06, tint: [[0.9, 0.93, 0.96], [0.78, 0.85, 0.93]], solid: [0.35, 1.9] },
    { shape: "iceShard", weight: 3, scale: [0.5, 1.3], sink: 0.2, tint: [[0.72, 0.9, 0.96], [0.6, 0.82, 0.94]], solid: [0.28, 2.6] },
    { shape: "boulder", weight: 2, scale: [0.6, 1.2], sink: 0.4, tint: [[0.74, 0.78, 0.84]], solid: [0.7, 2.2] },
    { shape: "rock", weight: 1, scale: [0.4, 0.9], sink: 0.35, tint: "ground", solid: [0.45, 0.7] },
  ],
  // Desert canyon: sun-bleached and sparse. The low prop count is the point,
  // so the eye travels to the horizon instead of stopping at the nearest bush.
  dune: [
    { shape: "boulder", weight: 3, scale: [0.7, 1.5], sink: 0.35, tint: [[0.68, 0.5, 0.33], [0.58, 0.35, 0.26]], solid: [0.7, 2.2] },
    { shape: "rock", weight: 3, scale: [0.4, 1.0], sink: 0.3, tint: "ground", solid: [0.45, 0.7] },
    { shape: "grassTuft", weight: 2, scale: [0.6, 1.0], sink: 0.06, tint: [[0.78, 0.7, 0.42]] },
    { shape: "stump", weight: 1, scale: [0.5, 0.9], sink: 0.12, tint: [[0.55, 0.45, 0.34]], solid: [0.28, 0.4] },
  ],
  // Jungle: overgrown and luminous, the strangest of the five.
  verdant: [
    {
      shape: "glowPlant",
      weight: 3,
      scale: [0.6, 1.2],
      sink: 0.03,
      tint: [
        [0.5, 0.95, 0.75],
        [0.45, 0.85, 0.95],
        [0.8, 0.95, 0.5],
      ],
    },
    { shape: "treeRound", weight: 3, scale: [1.0, 1.8], sink: 0.05, tint: "ground", solid: [0.35, 1.7] },
    { shape: "crystal", weight: 2, scale: [0.5, 1.3], sink: 0.15, tint: [[0.55, 0.9, 0.85], [0.7, 0.6, 0.95]], solid: [0.3, 2.6] },
    { shape: "grassTuft", weight: 2, scale: [0.7, 1.3], sink: 0.05, tint: "ground" },
    { shape: "rock", weight: 1, scale: [0.4, 0.9], sink: 0.3, tint: "ground", solid: [0.45, 0.7] },
  ],
};

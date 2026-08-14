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
}

export const KITS: Readonly<Record<PropKitId, readonly KitLayer[]>> = {
  // The wilds are open ocean: only rare rock islets break the surface
  // (scatter.tsx additionally thins ocean candidates hard). Fixed sea-stone
  // tints: "ground" would paint them ocean blue.
  wilds: [
    { shape: "boulder", weight: 2, scale: [0.9, 1.8], sink: 0.45, tint: [[0.55, 0.53, 0.48], [0.48, 0.47, 0.45]] },
    { shape: "rock", weight: 2, scale: [0.6, 1.2], sink: 0.4, tint: [[0.6, 0.57, 0.5]] },
  ],
  house: [
    { shape: "treeRound", weight: 2, scale: [0.9, 1.5], sink: 0.05, tint: "ground" },
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
    { shape: "rock", weight: 1, scale: [0.4, 0.8], sink: 0.3, tint: "ground" },
  ],
  machine: [
    { shape: "crate", weight: 2, scale: [0.5, 1.0], sink: 0.08, tint: [[0.45, 0.42, 0.38], [0.35, 0.38, 0.42]] },
    { shape: "pipe", weight: 2, scale: [0.7, 1.4], sink: 0.1, tint: [[0.55, 0.57, 0.62], [0.5, 0.42, 0.32]] },
    { shape: "vent", weight: 2, scale: [0.6, 1.1], sink: 0.08, tint: [[0.4, 0.44, 0.5]] },
    { shape: "rock", weight: 1, scale: [0.4, 1.0], sink: 0.3, tint: "ground" },
  ],
  bio: [
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
    { shape: "crystal", weight: 2, scale: [0.5, 1.3], sink: 0.15, tint: [[0.55, 0.9, 0.85], [0.7, 0.6, 0.95]] },
    { shape: "grassTuft", weight: 2, scale: [0.7, 1.3], sink: 0.05, tint: "ground" },
    { shape: "rock", weight: 1, scale: [0.4, 0.9], sink: 0.3, tint: "ground" },
  ],
  // The gallery island stays the "weird little place": pale trees, glowing
  // plants, and violet crystals instead of another plain tropical mix.
  gallery: [
    { shape: "treeRound", weight: 2, scale: [0.9, 1.5], sink: 0.05, tint: [[0.75, 0.85, 0.72]] },
    { shape: "glowPlant", weight: 2, scale: [0.6, 1.1], sink: 0.03, tint: [[0.8, 0.6, 0.95], [0.6, 0.75, 0.95]] },
    { shape: "crystal", weight: 2, scale: [0.5, 1.2], sink: 0.15, tint: [[0.75, 0.55, 0.95]] },
    { shape: "rock", weight: 1, scale: [0.4, 0.9], sink: 0.3, tint: "ground" },
  ],
};

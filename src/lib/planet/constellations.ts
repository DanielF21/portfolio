/**
 * Constellations, as flat plates pinned to the celestial sphere.
 *
 * Each is authored in its own 2D frame (x right, y up, roughly -1..1) rather
 * than in right ascension and declination. Real coordinates would buy nothing
 * here: this is not Earth's sky, the point is only that a visitor recognises
 * the SHAPES, and a plate is far easier to eyeball and adjust than a pair of
 * angles. `sky.tsx` places each plate at a direction with an up vector and the
 * pattern comes out undistorted because the plates are small.
 *
 * The shapes themselves are real, which is the whole point of picking these
 * four: Orion's belt, the Plough, Cassiopeia's W and the Southern Cross are
 * about the most identifiable asterisms there are.
 *
 * This file must never import `three`.
 */

export interface Star {
  /** Plate coordinates, roughly -1..1. */
  readonly x: number;
  readonly y: number;
  /** Relative brightness, 0..1. Drives both size and intensity. */
  readonly mag: number;
}

export interface Constellation {
  readonly name: string;
  /** Direction on the celestial sphere, in the group's LOCAL frame (that is,
   *  at phase 0). Normalised by the consumer. */
  readonly at: { readonly x: number; readonly y: number; readonly z: number };
  /** Angular size of the plate, radians. */
  readonly spread: number;
  readonly stars: readonly Star[];
  /** Index pairs into `stars`. */
  readonly lines: readonly (readonly [number, number])[];
}

export const CONSTELLATIONS: readonly Constellation[] = [
  {
    name: "Orion",
    at: { x: 0.15, y: 0.35, z: 0.92 },
    spread: 0.2,
    stars: [
      { x: -0.55, y: 0.85, mag: 1 }, // Betelgeuse
      { x: 0.45, y: 0.9, mag: 0.75 }, // Bellatrix
      { x: -0.3, y: 0.1, mag: 0.8 }, // Alnitak
      { x: 0.0, y: 0.13, mag: 0.85 }, // Alnilam
      { x: 0.28, y: 0.17, mag: 0.8 }, // Mintaka
      { x: -0.5, y: -0.75, mag: 0.7 }, // Saiph
      { x: 0.5, y: -0.8, mag: 1 }, // Rigel
    ],
    lines: [
      [0, 1],
      [0, 2],
      [1, 4],
      [2, 3],
      [3, 4],
      [2, 5],
      [4, 6],
    ],
  },
  {
    name: "The Plough",
    at: { x: -0.75, y: 0.6, z: 0.28 },
    spread: 0.26,
    stars: [
      { x: -0.9, y: 0.35, mag: 0.9 }, // Dubhe
      { x: -0.85, y: -0.05, mag: 0.8 }, // Merak
      { x: -0.45, y: -0.15, mag: 0.75 }, // Phecda
      { x: -0.35, y: 0.2, mag: 0.6 }, // Megrez
      { x: 0.05, y: 0.3, mag: 0.85 }, // Alioth
      { x: 0.45, y: 0.35, mag: 0.8 }, // Mizar
      { x: 0.85, y: 0.15, mag: 0.85 }, // Alkaid
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [3, 4],
      [4, 5],
      [5, 6],
    ],
  },
  {
    name: "Cassiopeia",
    at: { x: -0.3, y: -0.55, z: -0.78 },
    spread: 0.2,
    stars: [
      { x: -0.9, y: 0.1, mag: 0.8 },
      { x: -0.45, y: -0.3, mag: 0.75 },
      { x: 0.0, y: 0.15, mag: 0.9 },
      { x: 0.45, y: -0.25, mag: 0.7 },
      { x: 0.9, y: 0.25, mag: 0.75 },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ],
  },
  {
    name: "Crux",
    at: { x: 0.72, y: -0.5, z: -0.48 },
    spread: 0.14,
    stars: [
      { x: 0.0, y: 0.95, mag: 0.8 },
      { x: 0.05, y: -0.95, mag: 1 },
      { x: -0.65, y: -0.05, mag: 0.75 },
      { x: 0.6, y: 0.15, mag: 0.6 },
    ],
    lines: [
      [0, 1],
      [2, 3],
    ],
  },
];

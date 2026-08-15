/**
 * Deterministic surface colour as a function of direction.
 *
 * The sphere is ocean; each island is a cap of land. The island weight (1
 * inside the core, falling to 0 across the falloff band) drives a shoreline
 * gradient: deep ocean, that island's shallows ring, its beach, then its
 * interior.
 *
 * Every stop after the deep ocean comes from the island's OWN palette (see
 * `Palette` in districts.ts), which is what makes the archipelago read as five
 * different climates rather than five tints of the same one. Approaching the
 * volcanic island you cross rust coloured water onto black sand; approaching
 * the ice island, pale meltwater onto grey shingle.
 *
 * Shared by the planet surface and the scatter props, so an islet rock in the
 * ocean reads sea-worn and a rock on an island reads like its ground.
 *
 * This file must never import `three`; it returns plain [r, g, b] in 0..1.
 */

import { DISTRICTS, districtWeights } from "./districts";
import { fibonacciSphere, type Dir } from "./layout";

export type Rgb = [number, number, number];

/** Deep-water palettes: subtle variation so the open ocean is not one flat
 *  poly colour. */
const OCEAN_PALETTE: readonly Rgb[] = [
  [0.09, 0.24, 0.4],
  [0.11, 0.29, 0.45],
  [0.08, 0.22, 0.36],
];

/** Offset keeps the ocean-depth centres off the island centres. */
const CENTRES = fibonacciSphere(OCEAN_PALETTE.length, 0.18);

/** Higher values give tighter regions with sharper edges. */
const SHARPNESS = 3.2;

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Smooth 0..1 field over the sphere, for blending an island's two interior
 * tones. Two sine waves at incommensurate frequencies: continuous everywhere
 * (so it never looks like noise), with a wavelength of roughly a third of an
 * island (so a walk crosses two or three bands of it).
 */
function interiorMix(dir: Dir): number {
  const a = Math.sin(dir.x * 5.7 + dir.y * 3.1 + dir.z * 4.3);
  const b = Math.sin(dir.x * -3.3 + dir.y * 6.1 + dir.z * -2.7);
  return 0.5 + 0.3 * a + 0.2 * b;
}

/**
 * `dir` must be a unit vector. Returns the surface colour at that point.
 */
export function biomeColor(dir: Dir): Rgb {
  // Deep-ocean base: soft Voronoi over the depth-variation centres.
  let r = 0;
  let g = 0;
  let b = 0;
  let total = 0;

  for (let i = 0; i < CENTRES.length; i++) {
    const c = CENTRES[i];
    const cos = dir.x * c.x + dir.y * c.y + dir.z * c.z;
    const w = Math.exp(SHARPNESS * (cos - 1));
    const p = OCEAN_PALETTE[i];
    r += p[0] * w;
    g += p[1] * w;
    b += p[2] * w;
    total += w;
  }

  const inv = 1 / total;
  r *= inv;
  g *= inv;
  b *= inv;

  // Shoreline gradient, driven by the strongest island's weight. Cores never
  // overlap (asserted in dev), so taking the max is exact.
  const weights = districtWeights(dir);
  let w = 0;
  let best = -1;
  for (let i = 0; i < weights.length; i++) {
    if (weights[i] > w) {
      w = weights[i];
      best = i;
    }
  }
  if (w > 0 && best >= 0) {
    const p = DISTRICTS[best].palette;

    // Interior is a blend of the island's two ground tones. Resolved before
    // the gradient so the beach fades into whichever tone is local, rather
    // than into an average of the two.
    const t = Math.min(1, Math.max(0, interiorMix(dir)));
    const gr = p.ground[0] + (p.groundAlt[0] - p.ground[0]) * t;
    const gg = p.ground[1] + (p.groundAlt[1] - p.ground[1]) * t;
    const gb = p.ground[2] + (p.groundAlt[2] - p.ground[2]) * t;

    const toShallow = smoothstep(0, 0.06, w);
    const toSand = smoothstep(0.06, 0.45, w);
    const toGround = smoothstep(0.5, 0.85, w);
    r += (p.shallow[0] - r) * toShallow;
    g += (p.shallow[1] - g) * toShallow;
    b += (p.shallow[2] - b) * toShallow;
    r += (p.sand[0] - r) * toSand;
    g += (p.sand[1] - g) * toSand;
    b += (p.sand[2] - b) * toSand;
    r += (gr - r) * toGround;
    g += (gg - g) * toGround;
    b += (gb - b) * toGround;
  }

  return [r, g, b];
}

/**
 * Deterministic surface colour as a function of direction, water-world
 * edition.
 *
 * The sphere is ocean; each district is a tropical island. The district
 * weight (1 inside the core, falling to 0 across the falloff band) drives a
 * shoreline gradient: deep ocean, a turquoise shallows ring, a sand beach,
 * then the island's interior green.
 *
 * Shared by the planet surface and the scatter props, so an islet rock in
 * the ocean reads sea-worn and a rock on an island reads earthy.
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

/** Shoreline gradient stops. */
const SHALLOW: Rgb = [0.2, 0.55, 0.58]; // turquoise ring off the beach
const SAND: Rgb = [0.88, 0.8, 0.58];

/** Offset keeps the ocean-depth centres off the island centres. */
const CENTRES = fibonacciSphere(OCEAN_PALETTE.length, 0.18);

/** Higher values give tighter regions with sharper edges. */
const SHARPNESS = 3.2;

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
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
  let ground: readonly [number, number, number] = SAND;
  for (let i = 0; i < weights.length; i++) {
    if (weights[i] > w) {
      w = weights[i];
      ground = DISTRICTS[i].ground;
    }
  }
  if (w > 0) {
    const toShallow = smoothstep(0, 0.06, w);
    const toSand = smoothstep(0.06, 0.45, w);
    const toGround = smoothstep(0.5, 0.85, w);
    r += (SHALLOW[0] - r) * toShallow;
    g += (SHALLOW[1] - g) * toShallow;
    b += (SHALLOW[2] - b) * toShallow;
    r += (SAND[0] - r) * toSand;
    g += (SAND[1] - g) * toSand;
    b += (SAND[2] - b) * toSand;
    r += (ground[0] - r) * toGround;
    g += (ground[1] - g) * toGround;
    b += (ground[2] - b) * toGround;
  }

  return [r, g, b];
}

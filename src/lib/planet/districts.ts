/**
 * The authored geography of the planet: an archipelago of five islands on an
 * ocean sphere, everything between them is wilds.
 *
 * The layout is data, not code, so moving an island is a two-number edit and
 * its scenery follows (see `world-layout.ts`). Marker placement, ground
 * colour, prop kits and accent colours all key off this file.
 *
 * WHY THE ISLANDS ARE UNEVEN. The previous layout put four identically sized
 * islands at the vertices of a regular tetrahedron. That is the most even
 * arrangement possible, and evenness turned out to be the problem: every
 * crossing was the same length, every island was the same size, and the only
 * thing distinguishing one from another was its accent colour. There was
 * nowhere to be surprised by. This version has one continent you can get lost
 * on, four smaller islands at deliberately unequal distances, and each island
 * carrying its own climate palette (see `Palette` below), so an island is
 * recognisable from across the planet by its colour rather than by a beacon.
 *
 * This file must never import `three`; it returns plain objects and is safe to
 * import from server code and the eager DOM overlay.
 */

import { placeOnSphere, type Dir } from "./layout";
import type { DistrictId, PropKitId } from "./types";

export type Rgb = readonly [number, number, number];

/**
 * A climate, as four colours. `biome.ts` reads these to paint the shoreline
 * gradient: deep ocean, this island's `shallow` ring, its `sand` beach, then
 * its interior blended between `ground` and `groundAlt`.
 *
 * Sand and shallows used to be two module-level constants shared by every
 * island, which is exactly why the old four read as variations on green: no
 * matter what interior colour an island had, you approached it across the same
 * turquoise water and landed on the same pale beach.
 */
export interface Palette {
  /** Interior, dominant tone. */
  readonly ground: Rgb;
  /** Interior, secondary tone. Blended against `ground` by a smooth low
   *  frequency function of direction so no island is one flat sheet. */
  readonly groundAlt: Rgb;
  /** The beach ring, at the outer edge of the falloff band. */
  readonly sand: Rgb;
  /** The water ring just off the beach. */
  readonly shallow: Rgb;
}

export interface DistrictDef {
  readonly id: DistrictId;
  /** Unit vector to the island centre. */
  readonly centre: Dir;
  /** Angular radius (radians) of the island proper: full ground colour and
   *  prop kit inside this. */
  readonly coreRadius: number;
  /** Width (radians) of the blend band beyond the core, which carries the
   *  beach and the shallows and fades into open ocean. */
  readonly falloff: number;
  readonly palette: Palette;
  /** Beacon colour. Chosen for maximum mutual distinguishability at distance
   *  rather than for realism: this is a signal, not scenery. */
  readonly accent: string;
  readonly kit: PropKitId;
}

function norm(x: number, y: number, z: number): Dir {
  const l = Math.sqrt(x * x + y * y + z * z);
  return { x: x / l, y: y / l, z: z / l };
}

/** The continent. Everything else is positioned relative to it, so the whole
 *  archipelago rotates as one if this moves. */
const CONTINENT = norm(0, 0.25, 1);

/**
 * Island centres, given as (bearing, arc) from the continent rather than raw
 * xyz, so the separations below are readable as the numbers they are.
 *
 * Pairwise separation is checked at runtime in dev by
 * `assertDistrictsSeparated`. The tightest pair is verdant/dune at 1.17 rad
 * against a 1.00 rad requirement.
 */
export const DISTRICTS: readonly DistrictDef[] = [
  {
    id: "shore",
    centre: CONTINENT,
    coreRadius: 0.62,
    falloff: 0.18,
    palette: {
      ground: [0.36, 0.52, 0.3], // warm grass
      groundAlt: [0.46, 0.56, 0.34], // sun-bleached meadow
      sand: [0.88, 0.8, 0.58], // pale gold
      shallow: [0.2, 0.55, 0.58], // turquoise
    },
    accent: "#fbbf24",
    kit: "shore",
  },
  {
    id: "ember",
    centre: placeOnSphere(CONTINENT, 0, 1.7),
    coreRadius: 0.4,
    falloff: 0.15,
    palette: {
      ground: [0.22, 0.2, 0.21], // cold ash
      groundAlt: [0.33, 0.22, 0.19], // oxidised basalt
      sand: [0.12, 0.11, 0.12], // black sand
      shallow: [0.45, 0.24, 0.18], // rust, where the iron bleeds out
    },
    accent: "#f87171",
    kit: "ember",
  },
  {
    id: "frost",
    centre: placeOnSphere(CONTINENT, 2.1, 1.75),
    coreRadius: 0.34,
    falloff: 0.15,
    palette: {
      ground: [0.86, 0.89, 0.94], // snow
      groundAlt: [0.71, 0.79, 0.9], // blue shadow
      sand: [0.78, 0.8, 0.82], // grey shingle
      shallow: [0.55, 0.78, 0.85], // pale meltwater
    },
    accent: "#67e8f9",
    kit: "frost",
  },
  {
    id: "dune",
    centre: placeOnSphere(CONTINENT, 4.2, 1.8),
    coreRadius: 0.3,
    falloff: 0.14,
    palette: {
      ground: [0.76, 0.6, 0.36], // ochre
      groundAlt: [0.62, 0.36, 0.26], // red rock
      sand: [0.9, 0.86, 0.72], // bone
      shallow: [0.35, 0.62, 0.55], // jade
    },
    accent: "#c084fc",
    kit: "dune",
  },
  {
    id: "verdant",
    centre: placeOnSphere(CONTINENT, Math.PI, 2.75),
    coreRadius: 0.4,
    falloff: 0.16,
    palette: {
      ground: [0.16, 0.4, 0.24], // deep jungle
      groundAlt: [0.23, 0.48, 0.28], // canopy light
      sand: [0.6, 0.55, 0.42], // dark volcanic sand
      shallow: [0.18, 0.55, 0.45], // emerald
    },
    accent: "#86efac",
    kit: "verdant",
  },
];

export const DISTRICT_BY_ID: Readonly<Record<DistrictId, DistrictDef>> =
  Object.fromEntries(DISTRICTS.map((d) => [d.id, d])) as Record<
    DistrictId,
    DistrictDef
  >;

export const ACCENT_BY_DISTRICT: Readonly<Record<DistrictId, string>> =
  Object.fromEntries(DISTRICTS.map((d) => [d.id, d.accent])) as Record<
    DistrictId,
    string
  >;

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Per-island weight in 0..1 at `dir` (unit vector): 1 inside the core, fading
 * to 0 across the falloff band. Order matches `DISTRICTS`.
 */
export function districtWeights(dir: Dir): number[] {
  const out = new Array<number>(DISTRICTS.length);
  for (let i = 0; i < DISTRICTS.length; i++) {
    const d = DISTRICTS[i];
    const cos =
      dir.x * d.centre.x + dir.y * d.centre.y + dir.z * d.centre.z;
    const angle = Math.acos(Math.min(1, Math.max(-1, cos)));
    // Inverted edges: full weight at the core radius, zero past the falloff.
    out[i] = smoothstep(d.coreRadius + d.falloff, d.coreRadius, angle);
  }
  return out;
}

/**
 * The strongest island weight at `dir`, without allocating.
 *
 * `districtWeights` builds an array on every call, which is fine for the
 * build-time passes that use it but not for the render loop: the player asks
 * "am I in the water" every frame, and the frame loop in player.tsx is
 * deliberately allocation-free.
 */
export function maxDistrictWeight(dir: Dir): number {
  let best = 0;
  for (let i = 0; i < DISTRICTS.length; i++) {
    const d = DISTRICTS[i];
    const cos = dir.x * d.centre.x + dir.y * d.centre.y + dir.z * d.centre.z;
    const angle = Math.acos(Math.min(1, Math.max(-1, cos)));
    const w = smoothstep(d.coreRadius + d.falloff, d.coreRadius, angle);
    if (w > best) best = w;
  }
  return best;
}

/** The kit that dresses the ground at `dir`: the strongest island if any has
 *  meaningful weight there, otherwise the wilds. */
export function dominantDistrict(dir: Dir): { id: PropKitId; w: number } {
  const weights = districtWeights(dir);
  let best = -1;
  let bestW = 0;
  for (let i = 0; i < weights.length; i++) {
    if (weights[i] > bestW) {
      bestW = weights[i];
      best = i;
    }
  }
  if (best < 0 || bestW < 0.01) return { id: "wilds", w: 0 };
  return { id: DISTRICTS[best].id, w: bestW };
}

/**
 * Dev-time guard: no two islands may overlap, including their falloff bands.
 *
 * This is not cosmetic. `biomeColor` picks the single strongest island and
 * paints its palette, so two overlapping falloffs would produce a hard seam
 * where the winner flips, with one island's sand meeting another's shallows.
 * Islands are no longer all the same size, so the bar is the sum of the two
 * outer radii rather than a fixed angle.
 */
export function assertDistrictsSeparated() {
  for (let i = 0; i < DISTRICTS.length; i++) {
    for (let j = i + 1; j < DISTRICTS.length; j++) {
      const a = DISTRICTS[i];
      const b = DISTRICTS[j];
      const cos =
        a.centre.x * b.centre.x +
        a.centre.y * b.centre.y +
        a.centre.z * b.centre.z;
      const angle = Math.acos(Math.min(1, Math.max(-1, cos)));
      const needed = a.coreRadius + a.falloff + b.coreRadius + b.falloff;
      if (angle < needed) {
        console.warn(
          `[planet] islands ${a.id} and ${b.id} are ${angle.toFixed(
            2
          )} rad apart but need ${needed.toFixed(2)}; their shorelines overlap.`
        );
      }
    }
  }
}

/**
 * The authored geography of the planet: four districts on a sphere, everything
 * between them is wilds.
 *
 * Districts replace the old procedural 7-centre biome blend for anything that
 * matters: marker placement, ground colour, prop kits, and accent colours all
 * key off this file. The layout is data, not code, so moving a district is a
 * two-number edit and its markers follow (see `world-layout.ts`).
 *
 * This file must never import `three`; it returns plain objects and is safe to
 * import from server code and the eager DOM overlay.
 */

import type { Dir } from "./layout";
import type { DistrictId, PropKitId } from "./types";

export type Rgb = readonly [number, number, number];

export interface DistrictDef {
  readonly id: DistrictId;
  /** Unit vector to the district centre. */
  readonly centre: Dir;
  /** Angular radius (radians) of the district proper: full ground colour and
   *  prop kit inside this. */
  readonly coreRadius: number;
  /** Width (radians) of the blend band beyond the core where the district
   *  fades into the wilds. */
  readonly falloff: number;
  /** Ground colour at full district weight, linear-ish 0..1. */
  readonly ground: Rgb;
  /** Accent colour for this district's markers (pad glow, body tint, beam). */
  readonly accent: string;
  readonly kit: PropKitId;
}

function norm(x: number, y: number, z: number): Dir {
  const l = Math.sqrt(x * x + y * y + z * z);
  return { x: x / l, y: y / l, z: z / l };
}

/**
 * Water world: four tropical islands at the vertices of a regular
 * tetrahedron, so every pairwise centre angle is 1.911 rad and the ocean
 * between any two islands is an even channel; there is no large empty basin
 * anywhere. The house island faces the spawn; the three project islands
 * (machine, bio, gallery) fill the other vertices. Interiors are green
 * variants (identity comes from accents, props, and beacons); the beach and
 * shallows rings are painted by biome.ts from the falloff band.
 */
export const DISTRICTS: readonly DistrictDef[] = [
  {
    id: "house",
    centre: norm(0, 0.0995, 0.995),
    coreRadius: 0.38,
    falloff: 0.16,
    ground: [0.34, 0.5, 0.3], // warm tropical grass
    accent: "#fbbf24",
    kit: "house",
  },
  {
    id: "machine",
    centre: norm(0.8165, 0.4359, -0.3786),
    coreRadius: 0.4,
    falloff: 0.16,
    ground: [0.3, 0.42, 0.32], // cooler tech-camp green
    accent: "#5eead4",
    kit: "machine",
  },
  {
    id: "bio",
    centre: norm(-0.8165, 0.4359, -0.3786),
    coreRadius: 0.4,
    falloff: 0.16,
    ground: [0.2, 0.44, 0.27], // deep jungle
    accent: "#86efac",
    kit: "bio",
  },
  {
    id: "gallery",
    centre: norm(0, -0.9713, -0.2379),
    coreRadius: 0.38,
    falloff: 0.16,
    ground: [0.48, 0.63, 0.46], // pale mint
    accent: "#c084fc",
    kit: "gallery",
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
 * Per-district weight in 0..1 at `dir` (unit vector): 1 inside the core,
 * fading to 0 across the falloff band. Order matches `DISTRICTS`.
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

/** The kit that dresses the ground at `dir`: the strongest district if any has
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

/** Dev-time guard: district cores must never overlap. */
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
      if (angle < 1.25) {
        console.warn(
          `[planet] districts ${a.id} and ${b.id} are only ${angle.toFixed(
            2
          )} rad apart; cores may collide.`
        );
      }
    }
  }
}

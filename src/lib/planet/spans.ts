/**
 * Bridges: chains of segments laid along the great circle between two islands.
 *
 * A span is described by its ENDPOINTS AND A COUNT rather than by a list of
 * placed segments, because the interesting property of a bridge is that it
 * connects two specific places. Move an island in `districts.ts` and the
 * bridge still lands on it; author the segments by hand and the first tweak to
 * the archipelago leaves a bridge to nowhere.
 *
 * `segments()` returns both the position and the tangent at each step, because
 * the renderer needs the tangent to aim the model along the span and the
 * platform builder needs the position to place the walkable caps. One source,
 * so the thing you see and the thing you stand on cannot disagree.
 *
 * This file must never import `three`.
 */

import { DISTRICT_BY_ID } from "./districts";
import { tangentToward, type Dir } from "./layout";
import type { DistrictId } from "./types";

export interface SpanSegment {
  /** Unit position on the sphere. */
  readonly dir: Dir;
  /** Unit tangent, pointing along the span toward the far island. */
  readonly tangent: Dir;
}

export interface SpanDef {
  readonly id: string;
  readonly from: DistrictId;
  readonly to: DistrictId;
  /** Arc from the `from` island's centre where the span starts. Set inside
   *  that island's core radius so the bridge begins on dry land. */
  readonly startArc: number;
  /** Arc from the `from` island's centre where it ends, likewise inside the
   *  far island's core. */
  readonly endArc: number;
  /** Number of rendered segments. */
  readonly count: number;
  readonly scale: number;
  /** Walkable surface height above RADIUS, world units. */
  readonly deckHeight: number;
  /** Half-width of the walkable caps, world units. */
  readonly deckRadius: number;
}

/**
 * The continent to the ice island.
 *
 * Their centres are 1.750 rad apart and their cores are 0.62 and 0.34, so the
 * open water between the two shorelines is 0.79 rad, about 12.6 units. The
 * span deliberately starts and ends a little inside each core (0.58 and 1.45)
 * so both ends sit on dry ground and you walk onto the bridge rather than
 * stepping off a beach into mid-air.
 */
export const SPANS: readonly SpanDef[] = [
  {
    id: "shore-frost",
    from: "shore",
    to: "frost",
    startArc: 0.58,
    endArc: 1.45,
    count: 9,
    scale: 1.9,
    // Clears the ocean shell at RADIUS + WATER_HEIGHT (0.18) with room to
    // spare, so the deck reads as being above the water, not awash in it.
    deckHeight: 0.52,
    deckRadius: 0.95,
  },
];

/** Positions and tangents for a span's segments, evenly spaced along the arc. */
export function segments(def: SpanDef): SpanSegment[] {
  const a = DISTRICT_BY_ID[def.from].centre;
  const b = DISTRICT_BY_ID[def.to].centre;
  const t0 = tangentToward(a, b);
  if (!t0) return [];

  const out: SpanSegment[] = [];
  const step = (def.endArc - def.startArc) / def.count;
  for (let i = 0; i < def.count; i++) {
    const s = def.startArc + (i + 0.5) * step;
    const cos = Math.cos(s);
    const sin = Math.sin(s);
    // Great circle through `a` in direction `t0`. Both the point and its
    // derivative are already unit length, since a and t0 are orthonormal.
    out.push({
      dir: { x: a.x * cos + t0.x * sin, y: a.y * cos + t0.y * sin, z: a.z * cos + t0.z * sin },
      tangent: { x: -a.x * sin + t0.x * cos, y: -a.y * sin + t0.y * cos, z: -a.z * sin + t0.z * cos },
    });
  }
  return out;
}

/**
 * Positions for the walkable caps, at TWICE the segment density.
 *
 * Caps are circles, so a chain of them spaced one segment apart would sag
 * between neighbours and drop the player toward the water every stride. At
 * double density the spacing is under the cap radius, the overlapping caps
 * take the max height, and the deck is continuous.
 */
export function deckPoints(def: SpanDef): Dir[] {
  const a = DISTRICT_BY_ID[def.from].centre;
  const b = DISTRICT_BY_ID[def.to].centre;
  const t0 = tangentToward(a, b);
  if (!t0) return [];

  const n = def.count * 2;
  const out: Dir[] = [];
  const step = (def.endArc - def.startArc) / n;
  for (let i = 0; i <= n; i++) {
    const s = def.startArc + i * step;
    const cos = Math.cos(s);
    const sin = Math.sin(s);
    out.push({
      x: a.x * cos + t0.x * sin,
      y: a.y * cos + t0.y * sin,
      z: a.z * cos + t0.z * sin,
    });
  }
  return out;
}

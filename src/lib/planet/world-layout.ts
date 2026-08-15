/**
 * The authored placement of everything in the world: where the character
 * spawns, and where every piece of scenery sits.
 *
 * Positions are expressed as (district, bearing, arc) in the island's tangent
 * frame rather than raw xyz: move an island in `districts.ts` and its contents
 * follow; nudge one item by editing two numbers. `placeOnSphere` in `layout.ts`
 * turns these into unit vectors.
 *
 * Bearing convention: 0 = local north (toward +Y projected onto the tangent
 * plane), increasing eastward.
 *
 * This world carries no portfolio content. It used to place 14 markers built
 * from `src/data/resume.tsx`, each opening a project or resume modal; that
 * turned the landing page into a scavenger hunt a first-time visitor had to
 * solve to read a CV. The planet now lives behind an opt-in launcher in the
 * Playground tab and is purely somewhere to walk around, so the marker table
 * is gone and the scenery below is the whole of it.
 *
 * Every model in the manifest is placed here. A dozen of them were originally
 * marker bodies (bookshelf, workbench, terminal, greenhouse, microscope,
 * chess-knight and friends) and were orphaned when the markers went; they are
 * good models that were already paid for and attributed, so they are scenery
 * now. Objects with no obvious business being where they are (a chess knight
 * in a desert, a piano in the sand) are deliberate: an island you remember is
 * one that had something odd on it.
 *
 * This file must never import `three`.
 */

import { DISTRICT_BY_ID } from "./districts";
import { placeOnSphere, tangentToward } from "./layout";
import type { DistrictId, SpawnPoint } from "./types";

interface Dir {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

const CONTINENT = DISTRICT_BY_ID.shore.centre;

/**
 * On the continent's southern beach, at the waterline, facing inland.
 *
 * Derived rather than hardcoded (it used to be a literal xyz with a comment
 * explaining which island it was near) so that moving the continent moves the
 * spawn with it. Arc 0.55 is inside the 0.62 core, just short of the beach
 * band, and clear of every scenery footprint.
 */
const SPAWN_AT = placeOnSphere(CONTINENT, Math.PI, 0.55);

export const SPAWN: SpawnPoint = {
  ...SPAWN_AT,
  // Looking inland, up the beach toward the windmill. The fallback can only
  // trigger if the spawn is placed exactly at a pole of the continent frame.
  facing: tangentToward(SPAWN_AT, CONTINENT) ?? undefined,
};

// ---------------------------------------------------------------- scenery

export interface SceneryItem {
  /** assetId into ASSETS, or "proc:mountain" for the procedural hero. */
  readonly asset: string;
  /** Stable handle, for the few items something else needs to refer to. Only
   *  set on items that are interactive or animated. */
  readonly id?: string;
  /**
   * Animated by a dedicated component rather than drawn by `Scenery`.
   *
   * It stays in this table regardless, because its placement, its scatter
   * keep-out and its collider all still come from here; only the rendering
   * moves. Splitting the position out to the component instead would mean the
   * pad, the keep-out and the rocket could drift apart.
   */
  readonly dynamic?: boolean;
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
  /** Radius (radians) the player cannot walk inside. Deliberately separate
   *  from `clearAngle`, which is a decoration keep-out and is set much wider
   *  than the physical footprint so labels and walk-ups stay clear. Omit to
   *  make an item walk-through: the lanterns and the bridge read better as
   *  scenery you move among than as obstacles. */
  readonly collideAngle?: number;
  /**
   * Height in world units, used only to decide whether a jump clears this.
   *
   * MEASURED, not estimated, and measured FROM THE LIVE SCENE: each value is
   * the world-space top of the placed object, taken by walking its rendered
   * bounding box. An earlier pass read GLB accessor min/max offline instead
   * and got two of them badly wrong (the windmill came out at 2.34 against a
   * true 4.74) because that script applied each node's own scale but not the
   * scales it inherited from its parents. Neither error changed behaviour,
   * since both were far above the apex either way, but do not trust an offline
   * bbox for this: re-measure in the browser.
   *
   * Nothing here is rounded to make it hoppable or not. The jump apex is 1.19
   * units, so the small objects (a chess knight at 0.58, a microscope at 0.59)
   * are easy to clear, and things close to the apex (a satellite dish at 1.17)
   * are nearly impossible. That is the honest result and it is also the one a
   * player would predict from looking, which is what matters.
   */
  readonly collideHeight?: number;
  /**
   * Additional collision caps, for a shape one circle models badly.
   *
   * A cap centred on the anchor either misses the far end of a long building or
   * blocks a wide ring of ground around it. The fix is more caps, not a
   * different primitive: that keeps the closed-form pushout in `player.tsx` and
   * its one-rotation property, which is what the whole collision scheme rests
   * on.
   *
   * `dx` and `dz` are WORLD-UNIT offsets in the item's own tangent frame, with
   * +x along the item's heading, so they are the same numbers the geometry is
   * authored with. `radius` is in world units too, unlike `collideAngle`, for
   * the same reason.
   */
  readonly extraCaps?: readonly {
    readonly dx: number;
    readonly dz: number;
    readonly radius: number;
    readonly height: number;
  }[];
  /** World units to bury the item below the surface. Wide flat bases only
   *  touch a sphere at their centre point; sinking hides the hovering rim. */
  readonly sink?: number;
  /** Rock colour for "proc:mountain" only, in LINEAR space (same convention as
   *  `biomeColor`, not sRGB hex). Lets one procedural shape be a green hill, a
   *  basalt volcano, a red mesa and a grey sea stack. */
  readonly tint?: readonly [number, number, number];
}

/** A sea stack in open water, placed relative to the continent so the three
 *  of them sit in the channels between the mid-latitude islands. With the
 *  beacons gone these are load-bearing navigation: in open water they are
 *  often the only thing above the horizon. */
function seaStack(bearing: number, arc: number): Dir {
  return placeOnSphere(CONTINENT, bearing, arc);
}

/** Everything inert. None of these get a pad, glow, label, or prompt: that
 *  vocabulary is reserved for content. */
export const SCENERY: readonly SceneryItem[] = [
  // ---------------------------------------------------------- shore
  // The continent. Ordinary on purpose: it is the baseline the other four
  // islands are strange relative to. Spawn is on its southern beach, so the
  // northern half is what you find by walking rather than by arriving.
  // The mill: tower, sails, cottage, fence and crop, all one procedural piece.
  //
  // The `windmill` GLB used to stand here and no longer does. Measured in the
  // live scene it is only the sail cross, 0.47 thick by 3.11 square with the
  // blade tips reaching the ground, so it read as a giant X planted in the sand
  // with no mill behind it. Nothing can be attached to a model from the outside
  // (a row places a model at a point, and the sails have to sit off the tower's
  // axis and clear of the roof), so the sails are drawn with everything else
  // they belong to. The GLB and its attribution row stay in the repo; nothing
  // references it, so it is no longer fetched.
  //
  // Three caps, because one circle over a 4-unit-long building either misses
  // the far end of it or blocks the ground around it.
  {
    asset: "proc:millhouse", id: "mill", district: "shore", bearing: 0, arc: 0.12,
    heading: Math.PI, scale: 1, clearAngle: 0.19, sink: 0.05,
    // Tower, then two along the cottage. Heights are the built geometry: the
    // tower cap tops out at 3.1 and the cottage roof at 2.0.
    collideAngle: 0.044, collideHeight: 3.1,
    extraCaps: [
      { dx: 1.35, dz: 0, radius: 1.05, height: 2.0 },
      { dx: 2.2, dz: 0, radius: 0.85, height: 2.0 },
    ],
  },
  { asset: "watermill", district: "shore", bearing: 2.4, arc: 0.56, heading: 2.2, scale: 1.4, clearAngle: 0.1, collideAngle: 0.07, collideHeight: 2.4, sink: 0.18 },
  { asset: "bridge", district: "shore", bearing: 3.6, arc: 0.4, heading: 0.8, scale: 2.0, clearAngle: 0.08, sink: 0.1 },
  { asset: "proc:mountain", district: "shore", bearing: 2.9, arc: 0.26, heading: 0.4, scale: 0.55, clearAngle: 0.16, collideAngle: 0.09, collideHeight: 3.69, sink: 0.3, tint: [0.4, 0.43, 0.39] },

  // A little settlement on the western side: the study nook and the post.
  { asset: "bookshelf", district: "shore", bearing: 4.6, arc: 0.26, heading: 1.2, scale: 1.3, clearAngle: 0.05, collideAngle: 0.03, collideHeight: 1.14, sink: 0.03 },
  { asset: "workbench", district: "shore", bearing: 4.9, arc: 0.29, heading: 2.5, scale: 2.0, clearAngle: 0.06, collideAngle: 0.04, collideHeight: 0.75, sink: 0.03 },
  { asset: "picture-frame", district: "shore", bearing: 4.75, arc: 0.33, heading: 0.9, scale: 1.5, clearAngle: 0.05, collideAngle: 0.025, collideHeight: 0.86, sink: 0.02 },
  // By the mill's gable wall. It used to be at bearing 5.6 / arc 0.22, which
  // put it at (dx 2.21, dz 0.82) in the mill's own frame, i.e. inside the
  // cottage once the cottage became a real building. Solved for, not nudged:
  // this lands it at (2.21, 2.16), a bit under a unit clear of the wall.
  { asset: "mailbox", district: "shore", bearing: 5.783, arc: 0.29, heading: 3.4, scale: 1.1, clearAngle: 0.04, collideAngle: 0.02, collideHeight: 1.06, sink: 0.02 },
  { asset: "food-stand", district: "shore", bearing: 0.5, arc: 0.3, heading: 4.0, scale: 1.15, clearAngle: 0.07, collideAngle: 0.04, collideHeight: 1.42, sink: 0.05 },

  // A lantern-lit path running down toward the eastern shore.
  { asset: "lantern", district: "shore", bearing: 1.2, arc: 0.42, heading: 0, scale: 1.3, clearAngle: 0.04, sink: 0.03 },
  { asset: "lantern", district: "shore", bearing: 1.5, arc: 0.46, heading: 0, scale: 1.3, clearAngle: 0.04, sink: 0.03 },
  { asset: "lantern", district: "shore", bearing: 1.8, arc: 0.5, heading: 0, scale: 1.3, clearAngle: 0.04, sink: 0.03 },

  // ---------------------------------------------------------- ember
  // Volcanic. The mountain sits dead centre as the crater; everything else is
  // a monitoring post huddled on the lower slopes.
  { asset: "proc:mountain", district: "ember", bearing: 0, arc: 0, heading: 0.6, scale: 0.95, clearAngle: 0.2, collideAngle: 0.155, collideHeight: 6.37, sink: 0.4, tint: [0.19, 0.16, 0.16] },
  { asset: "rocket", id: "rocket", dynamic: true, district: "ember", bearing: 4.0, arc: 0.26, heading: 0.6, scale: 0.55, clearAngle: 0.12, collideAngle: 0.05, collideHeight: 5.45, sink: 0.12 },
  { asset: "generator", district: "ember", bearing: 3.4, arc: 0.31, heading: 2.1, scale: 1.5, clearAngle: 0.08, collideAngle: 0.04, collideHeight: 1.02, sink: 0.08 },
  { asset: "terminal", district: "ember", bearing: 3.75, arc: 0.33, heading: 3.0, scale: 1.7, clearAngle: 0.05, collideAngle: 0.03, collideHeight: 1.08, sink: 0.03 },
  { asset: "satellite-dish", district: "ember", bearing: 4.45, arc: 0.31, heading: 5.0, scale: 1.9, clearAngle: 0.07, collideAngle: 0.04, collideHeight: 1.17, sink: 0.04 },

  // ---------------------------------------------------------- frost
  // Ice. The snowman finally lives somewhere it makes sense; it used to be the
  // deliberate out-of-place joke on a tropical island.
  { asset: "snowman", id: "snowman", district: "frost", bearing: 0, arc: 0.1, heading: 5.1, scale: 1.8, clearAngle: 0.07, collideAngle: 0.03, collideHeight: 1.92, sink: 0.05 },
  // Knee high, and standing on its own. It used to be at bearing 0.6 / arc
  // 0.15, which is 1.41 units from the snowman's centre, so a 1.76-unit pile
  // and a 1.92-unit snowman were inside each other. This spot is the most open
  // ground on the island: found by sweeping every bearing and arc that is still
  // well inland and taking the one whose nearest neighbour is furthest, which
  // is 3.06 units (the snowman), then 3.25 (a pine).
  { asset: "proc:snowpile", id: "snowpile", district: "frost", bearing: 0.39, arc: 0.28, heading: 1.2, scale: 1, clearAngle: 0.03, collideAngle: 0.021, collideHeight: 0.44, sink: 0.03 },
  // A second pile on the far side, so the island has snowballs at both ends and
  // you are never walking the width of it to fetch one. Same id deliberately:
  // the prompt and what E does are identical, and `INTERACTABLES` is scanned
  // rather than keyed, so two rows sharing an id simply means two of the thing.
  // Found the same way as the first, restricted to bearings within 50 degrees
  // of opposite: nearest neighbour 2.93 units (a lantern), then 3.01 (a pine).
  { asset: "proc:snowpile", id: "snowpile", district: "frost", bearing: 4.012, arc: 0.32, heading: 4.4, scale: 1, clearAngle: 0.03, collideAngle: 0.021, collideHeight: 0.44, sink: 0.03 },
  // The pines carry ids only so a snowball can find them: see targets.ts.
  { asset: "tree-snow-a", id: "snow-tree-a", district: "frost", bearing: 1.2, arc: 0.22, heading: 0.3, scale: 1.4, clearAngle: 0.05, collideAngle: 0.025, collideHeight: 2.69, sink: 0.04 },
  { asset: "tree-snow-b", id: "snow-tree-b", district: "frost", bearing: 2.0, arc: 0.24, heading: 2.7, scale: 1.5, clearAngle: 0.05, collideAngle: 0.025, collideHeight: 2.96, sink: 0.04 },
  { asset: "tree-snow-a", id: "snow-tree-c", district: "frost", bearing: 4.6, arc: 0.2, heading: 4.4, scale: 1.2, clearAngle: 0.05, collideAngle: 0.025, collideHeight: 2.3, sink: 0.04 },
  { asset: "tree-snow-b", id: "snow-tree-d", district: "frost", bearing: 5.4, arc: 0.26, heading: 1.1, scale: 1.3, clearAngle: 0.05, collideAngle: 0.025, collideHeight: 2.56, sink: 0.04 },
  { asset: "lantern", district: "frost", bearing: 3.0, arc: 0.18, heading: 0, scale: 1.3, clearAngle: 0.04, sink: 0.03 },
  { asset: "lantern", district: "frost", bearing: 3.4, arc: 0.24, heading: 0, scale: 1.3, clearAngle: 0.04, sink: 0.03 },

  // ---------------------------------------------------------- dune
  // Desert canyon, and the emptiest island by design: the pavilion is visible
  // from anywhere on it, so the walk is about the two things that have no
  // business being here.
  // No collider. A pavilion is a roof on poles and the interesting thing about
  // it is standing under it, which a single cap cannot express: the cap covers
  // the open middle as solidly as it covers the posts, so the one shape in the
  // world you should be able to walk into was the one you bounced off.
  { asset: "pavilion", district: "dune", bearing: 0, arc: 0.08, heading: 0, scale: 2.6, clearAngle: 0.15, sink: 0.12 },
  { asset: "piano", id: "piano", district: "dune", bearing: 2.2, arc: 0.2, heading: 2.4, scale: 0.55, clearAngle: 0.06, collideAngle: 0.035, collideHeight: 0.82, sink: 0.05 },
  // `dynamic`: the knight moves, so `knight.tsx` draws it. No collider, because
  // one authored at the anchor would sit where the piece used to be. The board
  // it wanders is small and open, so there is nothing to walk into anyway.
  { asset: "chess-knight", id: "knight", dynamic: true, district: "dune", bearing: 4.3, arc: 0.19, heading: 1.7, scale: 4.0, clearAngle: 0.16, sink: 0.06 },
  // The telescope, on the emptiest island, pointing at the emptiest sky.
  { asset: "proc:telescope", id: "telescope", district: "dune", bearing: 0.9, arc: 0.3, heading: 2.1, scale: 1, clearAngle: 0.07, collideAngle: 0.028, collideHeight: 1.5, sink: 0.02 },
  { asset: "proc:mountain", district: "dune", bearing: 5.5, arc: 0.24, heading: 2.9, scale: 0.4, clearAngle: 0.14, collideAngle: 0.065, collideHeight: 2.68, sink: 0.26, tint: [0.64, 0.41, 0.29] },

  // ---------------------------------------------------------- verdant
  // Jungle. Everything here is oversized: the mushrooms are taller than the
  // buildings on the continent.
  { asset: "crystal-large", district: "verdant", bearing: 0, arc: 0.1, heading: 0.9, scale: 4.2, clearAngle: 0.13, collideAngle: 0.07, collideHeight: 2.27, sink: 0.4 },
  { asset: "mushroom-red", id: "mushroom-red", district: "verdant", bearing: 1.9, arc: 0.26, heading: 0.3, scale: 9, clearAngle: 0.08, collideAngle: 0.03, collideHeight: 2.25, sink: 0.06 },
  { asset: "mushroom-tan", id: "mushroom-tan", district: "verdant", bearing: 4.2, arc: 0.28, heading: 4.1, scale: 8, clearAngle: 0.08, collideAngle: 0.03, collideHeight: 2.0, sink: 0.06 },
  // The trampoline, where the greenhouse and the microscope used to be. Those
  // two were leftovers from the portfolio map (a "research camp" that explained
  // nothing once the markers went), and this island is the one you visit at
  // night for the fireflies, so a thing that throws you up among them beats two
  // props you walk past. No collider: you are meant to stand on it, and the
  // deck it gives you is a Platform, built in `world.tsx` from these same
  // constants.
  { asset: "proc:trampoline", id: "trampoline", district: "verdant", bearing: 2.9, arc: 0.22, heading: 1.5, scale: 1, clearAngle: 0.09, sink: 0.02 },
  { asset: "lantern", district: "verdant", bearing: 5.4, arc: 0.22, heading: 0, scale: 1.3, clearAngle: 0.04, sink: 0.03 },

  // ---------------------------------------------------------- wilds
  // Sea stacks in the three channels. Centres are normalized by placeOnSphere.
  { asset: "proc:mountain", district: "wilds", centre: seaStack(1.05, 1.75), bearing: 0, arc: 0, heading: 0.4, scale: 0.45, clearAngle: 0.14, collideAngle: 0.073, collideHeight: 3.02, sink: 0.5 },
  { asset: "proc:mountain", district: "wilds", centre: seaStack(3.15, 1.78), bearing: 0, arc: 0, heading: 2.9, scale: 0.38, clearAngle: 0.12, collideAngle: 0.062, collideHeight: 2.55, sink: 0.45 },
  { asset: "proc:mountain", district: "wilds", centre: seaStack(5.25, 1.75), bearing: 0, arc: 0, heading: 4.4, scale: 0.5, clearAngle: 0.14, collideAngle: 0.081, collideHeight: 3.35, sink: 0.5 },
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

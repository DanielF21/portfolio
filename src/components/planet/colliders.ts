import * as THREE from "three";

import { RADIUS } from "@/lib/planet/config";
import { resolveSceneryDir, SCENERY } from "@/lib/planet/world-layout";

const UP = new THREE.Vector3(0, 1, 0);

/**
 * What the player cannot walk through.
 *
 * A collider is a CAP ON THE SPHERE, not a box: a unit direction plus an
 * angular radius. That choice is what makes collision cost a dot product per
 * prop and keeps it in the same coordinate system as everything else here
 * (marker triggers, island weights, scatter clearance are all angles too).
 * The resolution step lives in `player.tsx`, next to the walk it has to stay
 * consistent with.
 *
 * `cosR` and `sinR` are precomputed because the frame loop needs both and
 * `Math.acos`/`Math.sin` per prop per frame is the one part of this that would
 * actually show up in a profile.
 */
export interface Collider {
  /** Unit direction to the centre of the footprint. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly cosR: number;
  readonly sinR: number;
  /**
   * Height in world units. A player whose jump altitude exceeds this passes
   * over the prop instead of being stopped by it, which is what makes a rock
   * something to hop and a windmill something to walk around. Jump apex is
   * JUMP_VELOCITY^2 / (2 * GRAVITY) = 1.19 units, so anything above that is
   * effectively solid.
   */
  readonly height: number;
}

/** Above this, nothing can be jumped. Just a readable stand-in for Infinity. */
export const UNJUMPABLE = 999;

/**
 * Something you can stand ON, as opposed to something you cannot walk through.
 *
 * Same cap geometry as a collider and the opposite behaviour: instead of
 * pushing the player out, it lifts the player's standing altitude to `height`.
 * That is what makes a bridge deck and a ship's deck walkable on a world with
 * no terrain elevation, where land and sea are both at exactly RADIUS.
 *
 * `ramp` is the fraction of the cap radius, measured inward from its edge,
 * over which the height eases in from 0. Without it, stepping onto a platform
 * would be an instantaneous 1.2-unit jolt; with it, the last stride onto a
 * bridge reads as walking up onto it. A chain of overlapping caps with ramped
 * edges gives a continuous walkable span, which is how the bridge is built.
 */
export interface Platform {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly cosR: number;
  /** Angular radius, kept because the ramp needs the angle, not its cosine. */
  readonly radius: number;
  /** World units above RADIUS that standing here puts the player's feet. */
  readonly height: number;
  /** 0..1 fraction of the radius used as the run-up. */
  readonly ramp: number;
}

export function makePlatform(
  dir: { x: number; y: number; z: number },
  angularRadius: number,
  height: number,
  ramp = 0.35
): Platform {
  return {
    x: dir.x,
    y: dir.y,
    z: dir.z,
    cosR: Math.cos(angularRadius),
    radius: angularRadius,
    height,
    ramp,
  };
}

export function makeCollider(
  dir: { x: number; y: number; z: number },
  angularRadius: number,
  height: number
): Collider {
  return {
    x: dir.x,
    y: dir.y,
    z: dir.z,
    cosR: Math.cos(angularRadius),
    sinR: Math.sin(angularRadius),
    height,
  };
}

/** Convert a footprint radius in world units into the angular radius this
 *  file works in. The only place the two unit systems meet. */
export function angularRadius(worldRadius: number): number {
  return worldRadius / RADIUS;
}

/**
 * Colliders for the authored landmarks. Static, so this is computed once.
 *
 * An item with no `collideAngle` has no collider at all. That is deliberate
 * rather than a default: several pieces of scenery (the lantern path, the
 * bridge) read better as things you walk among than things you bump into.
 * The bridge is also the case a single cap models worst, being long and thin.
 *
 * Heights come from `collideHeight`, which is measured off each model's GLB
 * rather than guessed, so whether a landmark can be vaulted follows from how
 * big it actually looks.
 */
export function sceneryColliders(): Collider[] {
  const out: Collider[] = [];
  const dir = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const heading = new THREE.Quaternion();
  const offset = new THREE.Vector3();

  for (const item of SCENERY) {
    const d = resolveSceneryDir(item);
    if (item.collideAngle) {
      out.push(makeCollider(d, item.collideAngle, item.collideHeight ?? UNJUMPABLE));
    }
    if (!item.extraCaps) continue;

    // Extra caps are authored in the item's own tangent frame, so they need the
    // same rotation `useSurfaceTransform` builds: up onto the item's direction,
    // then the heading about that. Rebuilt here rather than shared, because
    // that one lives in a component and this file must stay callable before
    // anything mounts.
    dir.set(d.x, d.y, d.z);
    q.setFromUnitVectors(UP, dir);
    q.multiply(heading.setFromAxisAngle(UP, item.heading));

    for (const cap of item.extraCaps) {
      // Step along the surface, not across the chord: the offsets are small
      // next to RADIUS but this is the same arc the geometry is bent along in
      // `surface-bend.ts`, and the two have to agree or the collider sits
      // beside the wall rather than in it.
      offset.set(cap.dx, 0, cap.dz).applyQuaternion(q);
      const dist = Math.hypot(cap.dx, cap.dz);
      const a = dist / RADIUS;
      offset.normalize().multiplyScalar(Math.sin(a));
      out.push(
        makeCollider(
          {
            x: d.x * Math.cos(a) + offset.x,
            y: d.y * Math.cos(a) + offset.y,
            z: d.z * Math.cos(a) + offset.z,
          },
          angularRadius(cap.radius),
          cap.height
        )
      );
    }
  }
  return out;
}

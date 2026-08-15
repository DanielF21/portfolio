/**
 * Where the ship actually is right now, and how it sails.
 *
 * `ship.ts` holds the ship's authored constants (size, deck height, the spot
 * it starts anchored at). This holds the LIVE state, because once the ship can
 * be steered its position is no longer a constant: the hull's transform, the
 * walkable deck caps and, while you are at the wheel, the player's own
 * position are all derived from it every frame.
 *
 * A mutable singleton for the same reason as `input` and `setpieces`: this
 * changes 120 times a second and three separate consumers read it, so React
 * state would re-render the scene tree to communicate a heading.
 *
 * This file must never import `three`.
 */

import { WATER_EDGE_WEIGHT } from "./config";
import { maxDistrictWeight } from "./districts";
import { placeOnSphere, tangentToward, type Dir } from "./layout";
import { DISTRICT_BY_ID } from "./districts";
import { SHIP } from "./ship";

/**
 * Top speed under sail, world units per second.
 *
 * A heavy ship, deliberately slower than a walk. It went the other way once:
 * the original 4.2 came with a 2.6s ramp and no wake, and the throttle looked
 * broken, because one second of full helm moved the hull 0.72 units and the
 * camera is carried by the ship, so the only thing on screen that changed was
 * the horizon. The speed is back down but the two things that made it legible
 * are not: the ramp is 1s, so the key and the movement are the same event, and
 * the wake gives the eye something fixed to the water to measure against.
 */
export const SHIP_MAX_SPEED = 4.25;
/** Seconds to reach top speed. Short enough that pressing the key and seeing
 *  the ship move are the same event. */
export const SHIP_ACCEL_TAU = 1;
/** Seconds to coast back down, longer than the ramp up. Letting go of the helm
 *  should feel like way running off a hull, not like releasing a button. */
export const SHIP_COAST_TAU = 2.4;
/** Turn rate at full helm, radians per second. */
export const SHIP_TURN_RATE = 0.55;
/** Fraction of each deck cap's radius spent ramping up to full height. Matches
 *  the value `world.tsx` uses for the bridges. */
const SHIP_DECK_RAMP = 0.45;

function initialDir(): Dir {
  return placeOnSphere(DISTRICT_BY_ID.shore.centre, SHIP.bearing, SHIP.arc);
}

function initialForward(dir: Dir): Dir {
  const toward = tangentToward(dir, DISTRICT_BY_ID.shore.centre) ?? {
    x: 0,
    y: 1,
    z: 0,
  };
  return rotateAboutNormal(toward, dir, SHIP.heading);
}

const START = initialDir();

export const shipState = {
  /** Unit position on the sphere. */
  dir: START as Dir,
  /**
   * Unit tangent along the hull, pointing at the bow.
   *
   * CARRIED, NOT DERIVED. The obvious alternative is a scalar heading measured
   * against some fixed reference direction, and that is what this was first:
   * `rotateAboutNormal(tangentToward(dir, continent), dir, heading)`. It has a
   * singularity, and unlike the player's the ship can sail into it, because
   * `tangentToward` has no answer at the reference point or its antipode and
   * the whole frame collapses there. Transporting the tangent the same way the
   * player transports `faceDir` has no such point.
   */
  fwd: initialForward(START) as Dir,
  /** Current speed, world units per second. */
  speed: 0,
  /** True while the player has the wheel. */
  helmed: false,
  /** Set for a moment when the bow refuses to enter shallow water, so the
   *  hull can shudder and the HUD could say something later. */
  grounded: false,

  /**
   * The rigid motion the ship underwent on the last `sailShip` call, so
   * anything standing on the deck can be carried along with it.
   *
   * Written as two rotations rather than a velocity because everything here
   * lives on a sphere: the ship yaws by `yawAngle` about the axis it was
   * standing on (`yawAxis`), then swings forward by `stepAngle` about
   * `stepAxis`. Apply those two, in that order, to a point on the deck and it
   * arrives where the planking under it did.
   */
  yawAxis: { x: 0, y: 1, z: 0 } as Dir,
  yawAngle: 0,
  stepAxis: { x: 0, y: 1, z: 0 } as Dir,
  stepAngle: 0,
};

function rotateAboutNormal(t: Dir, n: Dir, angle: number): Dir {
  // Rodrigues, simplified because t is perpendicular to n.
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const cx = n.y * t.z - n.z * t.y;
  const cy = n.z * t.x - n.x * t.z;
  const cz = n.x * t.y - n.y * t.x;
  return { x: t.x * c + cx * s, y: t.y * c + cy * s, z: t.z * c + cz * s };
}

/**
 * The ship's orthonormal frame at its CURRENT pose: x along the hull (bow),
 * y the surface normal, z completing a right-handed basis.
 *
 * `fwd` is re-orthogonalised against the normal here rather than trusted, so
 * a long voyage's worth of accumulated float error cannot tilt the hull off
 * the surface.
 */
export function liveShipFrame(): { x: Dir; y: Dir; z: Dir } {
  const y = shipState.dir;
  const f = shipState.fwd;
  const d = f.x * y.x + f.y * y.y + f.z * y.z;
  let x = { x: f.x - y.x * d, y: f.y - y.y * d, z: f.z - y.z * d };
  const l = Math.sqrt(x.x * x.x + x.y * x.y + x.z * x.z);
  x = l > 1e-9 ? { x: x.x / l, y: x.y / l, z: x.z / l } : { x: 0, y: 0, z: 1 };
  const z = {
    x: x.y * y.z - x.z * y.y,
    y: x.z * y.x - x.x * y.z,
    z: x.x * y.y - x.y * y.x,
  };
  return { x, y, z };
}

/** Step `d` world units along the hull's long axis from the ship's centre.
 *  A rotation about the sphere, not a translation: on a 16-unit planet a
 *  2-unit offset is already 0.125 rad. */
export function alongHull(d: number, radius: number): Dir {
  const { x, y } = liveShipFrame();
  const a = d / radius;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: y.x * c + x.x * s, y: y.y * c + x.y * s, z: y.z * c + x.z * s };
}

/**
 * Would the hull be aground at `dir`?
 *
 * Tested at the BOW rather than at the centre, because a ship is long: with a
 * centre test you would drive half the hull up the beach before anything
 * stopped you. Uses the same island-weight field that paints the shoreline and
 * decides whether the player is wading, so the water the ship refuses to leave
 * is exactly the water you can see.
 */
export function shipAground(centre: Dir, radius: number): boolean {
  const { x, y } = liveShipFrame();
  const a = (SHIP.length * 0.55) / radius;
  const c = Math.cos(a);
  const s = Math.sin(a);
  // Bow position if the ship's centre were at `centre`, using the current
  // heading's tangent carried to that point (close enough over one frame's
  // travel, which is at most a few centimetres).
  const bow = {
    x: centre.x * c + x.x * s,
    y: centre.y * c + x.y * s,
    z: centre.z * c + x.z * s,
  };
  void y;
  return (
    maxDistrictWeight(bow) >= WATER_EDGE_WEIGHT ||
    maxDistrictWeight(centre) >= WATER_EDGE_WEIGHT
  );
}

/**
 * Advance the ship one frame.
 *
 * `turn` and `throttle` are -1..1. Turning always works even when aground,
 * which is the whole reason grounding blocks translation rather than freezing
 * the ship: run yourself onto a sandbar and you can still steer off it.
 */
export function sailShip(
  dt: number,
  turn: number,
  throttle: number,
  radius: number
) {
  // Cleared first, so a consumer reading these always sees this frame's motion
  // and never last frame's repeated.
  shipState.yawAxis = shipState.dir;
  shipState.yawAngle = turn * SHIP_TURN_RATE * dt;
  shipState.stepAngle = 0;

  if (shipState.yawAngle !== 0) {
    shipState.fwd = rotateAboutNormal(
      shipState.fwd,
      shipState.dir,
      shipState.yawAngle
    );
  }

  // No sternway: square riggers do not back up, so S simply takes the way off.
  const target = Math.max(0, throttle) * SHIP_MAX_SPEED;
  const tau = target > shipState.speed ? SHIP_ACCEL_TAU : SHIP_COAST_TAU;
  shipState.speed += (target - shipState.speed) * (1 - Math.exp(-dt / tau));
  if (shipState.speed < 0.02) shipState.speed = 0;

  if (shipState.speed <= 0) {
    shipState.grounded = false;
    return;
  }

  const { x, y } = liveShipFrame();
  const a = (shipState.speed * dt) / radius;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const next = {
    x: y.x * c + x.x * s,
    y: y.y * c + x.y * s,
    z: y.z * c + x.z * s,
  };
  const l = Math.sqrt(next.x * next.x + next.y * next.y + next.z * next.z);
  next.x /= l;
  next.y /= l;
  next.z /= l;

  if (shipAground(next, radius)) {
    // Refuse the step and kill way, so the hull stops dead at the shallows
    // instead of grinding along an invisible wall.
    shipState.grounded = true;
    shipState.speed = 0;
    return;
  }

  shipState.grounded = false;
  // The step is the rotation about cross(normal, bow) that sends the normal to
  // the bow, which is the only rotation that walks the ship forward along a
  // great circle. Recorded so deck riders can be carried through the same one.
  shipState.stepAxis = {
    x: y.y * x.z - y.z * x.y,
    y: y.z * x.x - y.x * x.z,
    z: y.x * x.y - y.y * x.x,
  };
  shipState.stepAngle = a;
  shipState.dir = next;
  // The tangent rides through the same rotation: cross(axis, x) = -y, so the
  // bow tips by exactly the arc the hull travelled and stays tangent.
  shipState.fwd = {
    x: x.x * c - y.x * s,
    y: x.y * c - y.y * s,
    z: x.z * c - y.z * s,
  };
}

/**
 * How high the ship's deck is at `dir`, world units above the surface, or 0 if
 * you are not over it.
 *
 * Same ramped angular caps `colliders.ts` builds for the bridges, but computed
 * live rather than baked, because the ship sails and the bridges do not. The
 * quarterdeck cap is listed last and wins by being taller, which is what makes
 * the step up to the wheel a step rather than a wall.
 */
export function shipDeckHeightAt(dir: Dir, radius: number): number {
  const capR = SHIP.deckRadius / radius;
  const quarterR = SHIP.quarterRadius / radius;
  let best = 0;
  for (let i = 0; i < SHIP.deckOffsets.length + 1; i++) {
    const quarter = i === SHIP.deckOffsets.length;
    const p = alongHull(
      quarter ? SHIP.quarterOffset : SHIP.deckOffsets[i],
      radius
    );
    const dot = dir.x * p.x + dir.y * p.y + dir.z * p.z;
    const r = quarter ? quarterR : capR;
    if (dot <= Math.cos(r)) continue;
    const angle = Math.acos(Math.min(1, Math.max(-1, dot)));
    // 0 at the cap edge, 1 once fully inside the ramp band.
    const t = Math.min(1, (1 - angle / r) / SHIP_DECK_RAMP);
    const h = (quarter ? SHIP.helmHeight : SHIP.deckHeight) *
      (t * t * (3 - 2 * t));
    if (h > best) best = h;
  }
  return best;
}

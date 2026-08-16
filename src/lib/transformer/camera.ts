/**
 * Orbit camera math.
 *
 * THE RULE HERE IS RE-AIM, NOT REWRITE. There is no "scripted camera" mode that
 * takes control away and hands it back. There are two poses: `desired`, which
 * both the drag handler and the index panel write into, and `current`, which
 * chases it every frame. Clicking an index entry sets `desired` and nothing
 * else. Grabbing the mouse mid-flight therefore takes over with no state to
 * cancel, no mode to exit, and no way to get stuck in a transition.
 *
 * The planet learned this the expensive way with its telescope, which changes
 * the look target and the fov and leaves every other camera invariant alone.
 * Same idea, same reason.
 *
 * IMPORTANT: this file must never import `three`. It is pulled in by the DOM
 * overlay, which is loaded eagerly. Everything here is plain numbers; the one
 * place a Vector3 is needed is inside the lazy chunk.
 */

export interface Pose {
  /** What the camera looks at, in world units. */
  readonly target: readonly [number, number, number];
  /** How far the camera sits from the target. */
  readonly distance: number;
  /** Azimuth in radians. 0 looks down -Z at the front face. */
  readonly theta: number;
  /** Polar angle from +Y in radians. PI/2 is level with the target. */
  readonly phi: number;
  /** Vertical field of view in degrees. Narrowing it is how a detail shot
   *  gets close without the perspective going fisheye. */
  readonly fov: number;
}

/**
 * The 3/4 overview: the whole stack in frame, receding to the right.
 *
 * Tuned by eye against the real geometry, and the fov is the part worth
 * explaining. A 28 block stack is 30 world units long against a 3 unit
 * residual stream, so at a normal 45 degree fov the near end is more than
 * twice as close as the far end and the perspective is violent enough that the
 * blocks stop reading as identical. Backing off to 45 units and narrowing to
 * 22 degrees brings that ratio under 1.8 while still filling the frame. Long
 * lens, far back: the same thing a photographer does to a row of columns.
 */
export const DEFAULT_POSE: Pose = {
  // Raised off the stream, because the machinery sits on a branch above it and
  // targeting y=0 puts the model in the top half of the frame.
  target: [0, 2.2, 0],
  // Far enough back to hold the embedding wall and the tied LM head at either
  // end, not just the 28 blocks between them. The model is 39 units long once
  // both ends are on it.
  distance: 70,
  theta: 0.62,
  // Tipped further above level than it looks like it needs to be. The MLP's
  // bulge is a plate lying across the stack, so a camera near eye level sees
  // its edge and the widest thing in the model reads as a dark line.
  phi: 1.2,
  fov: 22,
};

export const PHI_MIN = 0.08;
export const PHI_MAX = Math.PI - 0.08;
export const DISTANCE_MIN = 1.2;
export const DISTANCE_MAX = 220;

/** How fast `current` chases `desired`, in e-folds per second. Higher is
 *  snappier. 5 lands a long flight in a bit under a second while still
 *  feeling damped rather than instant. */
export const CHASE_LAMBDA = 5;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function clampPose(p: Pose): Pose {
  return {
    ...p,
    phi: clamp(p.phi, PHI_MIN, PHI_MAX),
    distance: clamp(p.distance, DISTANCE_MIN, DISTANCE_MAX),
  };
}

/**
 * Where the camera actually sits.
 *
 * theta = 0, phi = PI/2 puts it on +Z looking at the target, which is the
 * front of the stack. Layout depends on this convention, so changing it moves
 * every authored pose.
 */
export function poseToPosition(p: Pose): [number, number, number] {
  const s = Math.sin(p.phi);
  return [
    p.target[0] + p.distance * s * Math.sin(p.theta),
    p.target[1] + p.distance * Math.cos(p.phi),
    p.target[2] + p.distance * s * Math.cos(p.theta),
  ];
}

/** Frame-rate independent exponential approach. At lambda per second, the gap
 *  shrinks by the same fraction per unit time regardless of frame timing. */
export function damp(current: number, desired: number, lambda: number, dt: number): number {
  return desired + (current - desired) * Math.exp(-lambda * dt);
}

/** Signed shortest way round from `a` to `b`, in (-PI, PI]. Without this a
 *  flight from 3.1 to -3.1 radians takes the long way and the camera spins
 *  almost all the way around the model. */
export function shortestAngle(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function dampAngle(current: number, desired: number, lambda: number, dt: number): number {
  return current + shortestAngle(current, desired) * (1 - Math.exp(-lambda * dt));
}

/**
 * One frame of chase.
 *
 * Distance is damped in LOG space: equal time spent flying should multiply the
 * distance equally, or a flight from 200 units out to 2 spends most of its
 * duration crawling the last unit.
 */
export function dampPose(current: Pose, desired: Pose, dt: number, lambda = CHASE_LAMBDA): Pose {
  return clampPose({
    target: [
      damp(current.target[0], desired.target[0], lambda, dt),
      damp(current.target[1], desired.target[1], lambda, dt),
      damp(current.target[2], desired.target[2], lambda, dt),
    ],
    distance: Math.exp(
      damp(Math.log(current.distance), Math.log(desired.distance), lambda, dt)
    ),
    theta: dampAngle(current.theta, desired.theta, lambda, dt),
    phi: damp(current.phi, desired.phi, lambda, dt),
    fov: damp(current.fov, desired.fov, lambda, dt),
  });
}

/** True once the chase is close enough that further frames are invisible.
 *  Used only to skip work, never to gate correctness. */
export function poseSettled(a: Pose, b: Pose): boolean {
  return (
    Math.abs(a.distance - b.distance) < 1e-3 &&
    Math.abs(shortestAngle(a.theta, b.theta)) < 1e-4 &&
    Math.abs(a.phi - b.phi) < 1e-4 &&
    Math.abs(a.fov - b.fov) < 1e-3 &&
    Math.abs(a.target[0] - b.target[0]) < 1e-3 &&
    Math.abs(a.target[1] - b.target[1]) < 1e-3 &&
    Math.abs(a.target[2] - b.target[2]) < 1e-3
  );
}

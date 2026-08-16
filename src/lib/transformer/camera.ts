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

/**
 * An axis-aligned box's half extents ON SCREEN, given the orbit angles.
 *
 * The camera sits at spherical (theta, phi) from its target, so its right and up
 * vectors are known in closed form:
 *
 *   right = (-cos t,          0,       sin t)
 *   up    = (-sin t cos p,  sin p,  -cos t cos p)
 *
 * and a box of size s projects onto either axis with half extent
 * `0.5 * (sx|ax| + sy|ay| + sz|az|)`, which is the standard support function of
 * a box along a direction.
 *
 * ALL THREE TERMS MATTER, and getting that wrong is the whole reason this
 * function exists rather than being inlined. The first version computed screen
 * height as `sy * sin(phi)` alone, on the reasoning that world Y is what points
 * up the screen. At a three quarter view it is not: a 51 unit run along Z rises
 * across the frame as it recedes and contributed 17 units of screen height that
 * were simply not counted, so the fit was out by a factor of two and the model
 * ran off the bottom of a frame the arithmetic said it filled.
 */
export function screenHalfExtents(
  sx: number,
  sy: number,
  sz: number,
  theta: number,
  phi: number
): { halfW: number; halfH: number } {
  const ct = Math.cos(theta);
  const st = Math.sin(theta);
  const cp = Math.cos(phi);
  const sp = Math.sin(phi);

  const halfW = 0.5 * (sx * Math.abs(ct) + sz * Math.abs(st));
  const halfH =
    0.5 *
    (sx * Math.abs(st * cp) + sy * Math.abs(sp) + sz * Math.abs(ct * cp));

  return { halfW, halfH };
}

/**
 * How far back to stand so a subject of a given size fills `fill` of the frame.
 *
 * Pure trigonometry, no three, so it can live here next to the pose it produces.
 * `halfW`, `halfH` come from `screenHalfExtents`.
 *
 * WHY DISTANCES ARE NO LONGER TYPED BY HAND. Every camera pose in the glossary
 * used to carry a literal distance tuned against the geometry of the day. When
 * tensor heights became real, all fourteen went wrong at once and in opposite
 * directions: the output projection went from 11% of frame height to 67%, and
 * the MLP went from 16% to 141%, overflowing. Tuning fourteen numbers by eye
 * against geometry that is still moving is how a scene ends up with its
 * geometry bent to suit its cameras, which is exactly the trade this piece
 * cannot make. Measuring instead means a badly framed shot is impossible to
 * ship and a new station cannot be added mis-framed.
 *
 * Both axes are fitted, and the larger requirement wins. Fitting only the
 * height lets a wide subject run out of the sides, which is how the MLP (17.5
 * units across) behaved.
 */
export function distanceFor(
  halfW: number,
  halfH: number,
  aspect: number,
  fov: number,
  fill: number
): number {
  const halfFov = (fov * Math.PI) / 360;
  // A horizontal half extent has to be divided by the aspect ratio before it
  // can be compared against the same vertical half angle.
  const need = Math.max(halfH, halfW / Math.max(aspect, 0.0001));
  return clamp(need / Math.tan(halfFov) / fill, DISTANCE_MIN, DISTANCE_MAX);
}

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

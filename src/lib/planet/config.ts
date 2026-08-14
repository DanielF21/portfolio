/**
 * Every tuning constant for the planet lives here.
 *
 * IMPORTANT: this file must never import `three`. It is pulled in by the DOM
 * overlay, which is loaded eagerly. A value import of `three` here would hoist
 * three.js out of the lazy chunk and into the shared bundle.
 */

/** Planet radius in world units. 60% of the original 18: the water-world
 *  layout concentrates content on four tropical islands, so the sphere can be
 *  roomy without reading as empty. Half a lap is ~5.7s walking. */
export const RADIUS = 10.8;

/** Half the character's height; used to sit it on the surface. */
export const CHAR_HALF_HEIGHT = 0.42;

/** Surface walking speed, world units per second. Retuned with RADIUS so
 *  traversal time stays pleasant on the bigger sphere. */
export const WALK_SPEED = 6.0;

/** Sprint multiplier applied to WALK_SPEED while shift is held (or the touch
 *  stick is at the rim). */
export const SPRINT_MULT = 1.9;

// ---------------------------------------------------------------- jump
//
// Tuned for float, not realism. apex = JUMP_VELOCITY^2 / (2 * GRAVITY) = 1.19
// units, hang time = 2 * JUMP_VELOCITY / GRAVITY = 1.19s. Walking, that covers
// 7.2 units of ground; sprinting, 13.6. Markers now cluster inside districts,
// so a jump is for flavour and small shortcuts, not for clearing marker gaps.

/** Radial acceleration pulling the character back to the surface, units/s^2. */
export const GRAVITY = 6.7;

/** Upward (radial) speed imparted by a jump, units/s. */
export const JUMP_VELOCITY = 4.0;

/** Fraction of the character's jump altitude the camera rises by. Deliberately
 *  well under 1: a camera that tracks the jump exactly reads as the world
 *  dropping away rather than the character leaping, and it is nauseating.
 *  At 0.35 the camera pitches up slightly instead. */
export const CAM_JUMP_FOLLOW = 0.35;

/** How fast the character rotates to face its travel direction, rad/sec.
 *  Deliberately snappy. With the camera no longer yawing under movement (see
 *  the camera section), the character's own turn is the only thing that has to
 *  communicate a direction change, so it should read instantly. */
export const TURN_SPEED = 9;

/** Damping time (seconds) for the character's orientation quaternion. */
export const ORIENT_SMOOTH = 0.08;

/** Ramp time (seconds) for walking speed, applied on both start and stop.
 *  Without it, velocity is a step function from 0 to WALK_SPEED, which the
 *  position-damped camera turns into a lurch. Short enough that the coast
 *  after releasing a key is well under half a world unit. */
export const MOVE_ACCEL_TAU = 0.09;

// ---------------------------------------------------------------- camera

/** Resting framing. Pulled in from 16: at that distance the character was
 *  roughly 20px tall in a 680px viewport, so its facing (the entire feedback
 *  channel for which way you are about to move) was unreadable, and the planet
 *  filling the frame meant every degree of camera yaw swept a huge amount of
 *  visible world. 13.5 still shows most of the sphere. Scroll zoom multiplies
 *  these, so 0.55x still gives a close-up and 2.2x restores the wide shot. */
export const CAM_DISTANCE = 13.5;
export const CAM_HEIGHT = 1.7;
export const CAM_HEAD_OFFSET = 0.9;

/** Minimum gap between the camera and the planet surface. */
export const CAM_MIN_CLEARANCE = 0.8;

export const CAM_PITCH_MIN = -0.12;
export const CAM_PITCH_MAX = 1.05;
/** Raised again, 0.51 -> 0.62 (~29 to ~36 degrees). Beyond reading the planet
 *  better, pitch controls how a yaw FEELS: from a low angle a yaw sweeps the
 *  horizon across the screen, which is the nauseating case, while from higher
 *  up the same yaw reads as rotating a map about the character. Raising it
 *  buys tolerance for whatever camera motion remains. */
export const CAM_PITCH_DEFAULT = 0.62;

/** Damping times in seconds. Up is deliberately slower than position: a laggy
 *  up vector reads as weight, a snappy one reads as broken. */
export const CAM_POS_SMOOTH = 0.22;
export const CAM_ROT_SMOOTH = 0.14;
export const CAM_UP_SMOOTH = 0.45;
export const CAM_LOOK_SMOOTH = 0.16;

/** Radians of camera yaw per pixel of pointer drag. */
export const CAM_YAW_SENS = 0.005;
export const CAM_PITCH_SENS = 0.004;

/** Auto-recenter behind the direction of travel.
 *
 *  This is the knob that made the camera feel like it was whipping around, so
 *  it is worth stating the principle it now follows: THE CAMERA'S YAW BELONGS
 *  TO THE PLAYER, NOT TO THE MOVEMENT KEYS. Super Mario Galaxy never swings
 *  the camera because Mario ran left; it reorients only because the level says
 *  to. Movement input is screen-relative, and that mapping is only trustworthy
 *  while the screen holds still. A camera that re-aims itself off the movement
 *  keys breaks its own control scheme.
 *
 *  So the recenter is now a weak assist, not a mechanic:
 *   - forward only. A strafe leaves the camera completely alone, because
 *     during a strafe the character's facing is 90 degrees off the camera and
 *     recentering onto it is exactly the 90-degree yank that read as a whip.
 *   - proportional, not a constant-rate slew. `turnToward` moved at a fixed
 *     rad/sec and then stopped dead on arrival, a velocity discontinuity that
 *     reads as "whip, then clunk". An exponential approach decelerates into
 *     the target instead.
 *   - rate-capped, so even a large error can never produce a fast sweep.
 *   - gated behind the drag delay below, so a hand-placed camera angle
 *     survives a second of walking before anything touches it. */
export const CAM_RECENTER_DELAY_MS = 900;
/** Damping time (seconds) of the proportional approach. */
export const CAM_RECENTER_TAU = 0.8;
/** Hard ceiling on recenter yaw, rad/sec. ~50 deg/sec: perceptible as drift,
 *  never as a swing. The old constant-rate value here was 5 rad/sec. */
export const CAM_RECENTER_MAX_RATE = 0.9;

// Scroll-wheel zoom: a multiplier on the camera's orbit distance and height.
// 1 is the authored framing; smaller is closer. Exponential steps so zooming
// feels uniform in both directions.
export const CAM_ZOOM_MIN = 0.55;
export const CAM_ZOOM_MAX = 2.2;
/** Zoom factor change per pixel of wheel delta, applied as exp(delta * sens). */
export const CAM_ZOOM_SENS = 0.0015;
/** Damping time (seconds) toward the wheel's target zoom. */
export const CAM_ZOOM_SMOOTH = 0.18;

export const CAM_FOV = 55;
export const CAM_NEAR = 0.1;
/** Far plane sits beyond the sky props (sun sprite, gas giant, stars), which
 *  scaled out with the planet. */
export const CAM_FAR = 340;

// ---------------------------------------------------------------- markers

/** Angular radius (radians) at which a marker's prompt appears / disappears.
 *  EXIT must be larger than ENTER. That gap is the entire anti-flicker
 *  mechanism: standing on the boundary cannot oscillate because entering and
 *  leaving require crossing different lines.
 *
 *  These are angles: at R=10.8 they give a ~1.1-unit trigger and a
 *  ~1.5-unit exit. Adjacent House markers sit 0.15 rad apart (world-layout),
 *  so EXIT must stay below that. */
export const MARKER_ENTER_ANGLE = 0.1;
export const MARKER_EXIT_ANGLE = 0.14;

export const COS_ENTER = Math.cos(MARKER_ENTER_ANGLE);
export const COS_EXIT = Math.cos(MARKER_EXIT_ANGLE);

/** Scatter props keep this angular clearance from every marker, so nothing
 *  clutters a walk-up or hides a label. Slightly wider than the old 1.6x
 *  factor because marker bodies are now full models, not small primitives. */
export const SCATTER_CLEARANCE_ANGLE = MARKER_ENTER_ANGLE * 1.8;

/** Scatter instance budgets. Scaled with surface area (R^2) so density stays
 *  constant when the radius is tuned. */
/** Nearly all scatter lands on the four islands (~20% of the sphere); the
 *  ocean gets only rare rock islets. */
export const SCATTER_HIGH = 300;
export const SCATTER_LOW = 110;

// ---------------------------------------------------------------- beacons

/** Per-marker beam: an in-island signpost, visible once you are on or near
 *  the island, deliberately not cross-planet. */
export const MARKER_BEAM_HEIGHT = 3;

/** Per-island beacon: the cross-planet navigation tier. A tip at R+8 clears
 *  the horizon from acos(10.8/18.8) = 0.96 rad; four such caps cover the
 *  whole sphere. */
export const DISTRICT_BEACON_HEIGHT = 8;

// ---------------------------------------------------------------- quality

export const DPR_HIGH: [number, number] = [1, 1.75];
export const DPR_LOW: [number, number] = [1, 1];

/** Icosahedron subdivision. Scales with RADIUS so face size stays roughly
 *  constant; district colour borders resolve across 2-3 face rings. */
export const SPHERE_DETAIL_HIGH = 13;
export const SPHERE_DETAIL_LOW = 7;

/** Guard against tab-switch / GC pauses handing us a multi-second delta,
 *  which would teleport the character across the planet in one frame. */
export const MAX_DELTA = 1 / 30;

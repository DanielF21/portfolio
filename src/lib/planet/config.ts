/**
 * Every tuning constant for the planet lives here.
 *
 * IMPORTANT: this file must never import `three`. It is pulled in by the DOM
 * overlay, which is loaded eagerly. A value import of `three` here would hoist
 * three.js out of the lazy chunk and into the shared bundle.
 */

/** Planet radius in world units.
 *
 *  History worth keeping, because this number has been wrong in both
 *  directions: 18 originally, cut to 10.8 when the world was four small
 *  islands and the sphere read as empty, now 16 for an archipelago with a
 *  continent on it. Half a lap is ~8.4s walking, ~4.4s sprinting.
 *
 *  Everything angular scales with this for free (marker triggers, district
 *  radii, scatter clearance). Everything measured in world units does NOT:
 *  scenery scales, character size and camera distance all have to be
 *  reconsidered by hand when this changes. */
export const RADIUS = 16;

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
 *  visible world. Scroll zoom multiplies these, so 0.55x still gives a
 *  close-up and 2.2x restores the wide shot.
 *
 *  DELIBERATELY NOT scaled up with RADIUS. The temptation when the planet grew
 *  to 16 was to pull the camera back proportionally to keep the same amount of
 *  sphere in frame, which is exactly the mistake this constant was lowered to
 *  fix: the framing that matters is the CHARACTER's, not the planet's. Holding
 *  the distance means a bigger planet reads as a nearer horizon, which is what
 *  a bigger planet should feel like. */
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

/** Field of view through the telescope, degrees. A 2.5x narrowing, which is
 *  enough that a constellation fills a useful part of the frame without the
 *  motion of the damped camera becoming sickening at the long end. */
export const CAM_FOV_TELESCOPE = 22;
export const CAM_NEAR = 0.1;
/** Far plane sits beyond the sky props (sun sprite, gas giant, stars), which
 *  scaled out with the planet. Furthest star is at ~340, and the camera can
 *  itself be ~53 out from the origin at maximum zoom, so 460 leaves headroom
 *  rather than clipping the sky at the far corners. */
export const CAM_FAR = 460;

// ---------------------------------------------------------------- markers

/** Angular radius (radians) at which a marker's prompt appears / disappears.
 *  EXIT must be larger than ENTER. That gap is the entire anti-flicker
 *  mechanism: standing on the boundary cannot oscillate because entering and
 *  leaving require crossing different lines.
 *
 *  These are angles: at R=10.8 they give a ~1.1-unit trigger and a ~1.5-unit
 *  exit. The world currently ships no markers, so nothing consumes these yet;
 *  they are kept because the interactive set pieces reuse the same proximity
 *  path. Whatever gets a trigger, keep neighbours further apart than EXIT. */
export const MARKER_ENTER_ANGLE = 0.07;
export const MARKER_EXIT_ANGLE = 0.1;

export const COS_ENTER = Math.cos(MARKER_ENTER_ANGLE);
export const COS_EXIT = Math.cos(MARKER_EXIT_ANGLE);

/** Scatter props keep this angular clearance from every marker, so nothing
 *  clutters a walk-up or hides a label. Slightly wider than the old 1.6x
 *  factor because marker bodies are now full models, not small primitives. */
export const SCATTER_CLEARANCE_ANGLE = MARKER_ENTER_ANGLE * 1.8;

/** Scatter instance budgets.
 *
 *  These are counts of PLACED props, not of draw calls: every instance of a
 *  shape shares one InstancedMesh, so the cost of raising these is vertex
 *  throughput and one-time placement work, never draw calls.
 *
 *  Scaled with surface area (R^2) AND with how much of that surface is land,
 *  since almost everything lands on an island: the archipelago covers ~41% of
 *  the sphere against the old four islands' ~29%. */
export const SCATTER_HIGH = 700;
export const SCATTER_LOW = 240;

// ---------------------------------------------------------------- water

/**
 * The ocean surface, as an offset above RADIUS.
 *
 * The islands are NOT raised above sea level: without terrain displacement
 * (deliberately out of scope, see CLAUDE.md) land and sea sit at exactly the
 * same radius. So the waterline is not a height, it is a COLOUR BOUNDARY: the
 * water shell fades out across the beach band, which `biome.ts` already paints
 * as a gradient. The 0.18 offset is only enough to lift the surface to shin
 * height on a standing character, which is what sells wading.
 */
export const WATER_HEIGHT = 0.18;

/** Island weight at which the shoreline sits. Below this you are in the water.
 *  Chosen mid-beach (biome.ts paints sand across weights 0.06 to 0.5) so there
 *  is dry sand above the waterline rather than water lapping the grass. */
export const WATER_EDGE_WEIGHT = 0.22;

/** Wading is slow. Well under half speed reads as effort without making a
 *  crossing tedious, given a channel is only a few seconds wide. */
export const SWIM_SPEED_MULT = 0.55;

/** How far the character sinks once in open water, world units. Set against
 *  CHAR_HALF_HEIGHT 0.42 so the surface cuts around chest height. */
export const SWIM_SUBMERGE = 0.3;

// -------------------------------------------------------------- trampoline

/**
 * The trampoline on the jungle island.
 *
 * One set of numbers read by three places, for the same reason the ship's are:
 * `scenery.tsx` builds the frame and the mat from them, `world.tsx` builds the
 * Platform you stand on from them, and `player.tsx` decides from them whether
 * you are on it when you land. A mat you can see but not stand on, or bounce
 * off the empty air beside, is the failure mode.
 */
export const TRAMPOLINE_RADIUS = 1.15;
/** Height of the mat, world units above the surface. Low enough to step onto
 *  without the ramp reading as a hill. */
export const TRAMPOLINE_HEIGHT = 0.34;
/**
 * Launch speed, world units per second.
 *
 * Against JUMP_VELOCITY 4.0 and GRAVITY 6.7 this is an apex of 2.7 units and
 * 1.8 seconds of hang time, against 1.19 and 1.19 for a normal jump: about
 * twice as high as you can jump, which is enough to see over the giant
 * mushrooms. It was 8.5 first, and 5.4 units up put the character in orbit
 * over a 16-unit planet, so far above the island that the ground read as a map.
 */
export const TRAMPOLINE_BOUNCE = 6;
/** Fraction of impact speed returned when you land on it without pressing
 *  anything, so a bounce decays over a few hops instead of running forever. */
export const TRAMPOLINE_RESTITUTION = 0.82;
/**
 * How far above the mat E still works, world units.
 *
 * Not zero, because the mat throws you back on landing, so a strict "feet on
 * the ground" rule would leave a window of a frame or two per hop to press
 * anything in, and the prompt would strobe. Half a unit is about the last
 * tenth of a second of a hop, which is when a person aiming for the mat
 * presses the key anyway.
 *
 * It cannot be used to climb: the bounce SETS the vertical speed rather than
 * adding to it, so pressing E again on the way up gains nothing, and the apex
 * from this height is still well under a unit above a normal one.
 */
export const TRAMPOLINE_REACH = 0.5;

// ---------------------------------------------------------------- snowballs

/** How fast a thrown snowball leaves the hand, world units per second. */
export const SNOWBALL_SPEED = 11;
/** Upward component of the throw. A flat throw on a sphere this small stays
 *  level with the horizon and reads as a laser; a lob reads as a throw. */
export const SNOWBALL_LOFT = 2.4;
/** How many can be in the air at once. A ring buffer, so the oldest is
 *  recycled rather than the throw being refused. */
export const SNOWBALL_POOL = 8;

// ---------------------------------------------------------------- collision

/**
 * Whether scattered props block the player, or only the authored landmarks do.
 *
 * The authored landmarks (windmill, volcano, pavilion...) always collide; this
 * governs the ~250 trees, boulders, crates and crystals the scatter places.
 * Ground clutter never collides either way, because that is decided per shape
 * by `solid` in kits.ts.
 *
 * Kept as one switch because it is a taste call, not a technical one: solid
 * trees make the islands feel like places with substance, and also make them
 * fiddlier to cross. Load the world with `?colliders` to see every footprint
 * drawn as a ring before deciding.
 *
 * Currently OFF: walking is unobstructed except by the things a visitor would
 * actually expect to be solid, which keeps the islands pleasant to cross. The
 * `solid` entries in kits.ts are kept ready for flipping this back.
 */
export const COLLIDE_WITH_SCATTER = false;

// ---------------------------------------------------------------- beacons

/** Per-marker beam: an in-island signpost, visible once you are on or near
 *  the island, deliberately not cross-planet. A tip at R+3.5 clears the
 *  horizon from acos(16/19.5) = 0.60 rad. */
export const MARKER_BEAM_HEIGHT = 3.5;

/** Per-island beacon: the cross-planet navigation tier. A tip at R+14 clears
 *  the horizon from acos(16/30) = 1.01 rad.
 *
 *  That is deliberately short of full coverage, and cannot practically be
 *  otherwise. The old four-island layout was a regular tetrahedron, so the
 *  largest gap between beacons was exactly half the pairwise separation and
 *  the height could be tuned to close it precisely. This archipelago is uneven
 *  on purpose: the furthest any point gets from an island centre is 1.183 rad
 *  (measured by dense sampling, not estimated), and covering that would need a
 *  beacon 26 units tall on a 16-unit planet.
 *
 *  So there is a stretch of open water with no beacon above the horizon. Left
 *  that way on purpose. It is not featureless: the ember volcano is ~6.8 units
 *  tall and so breaks the horizon from 0.80 rad, and the three sea stacks in
 *  the channels exist precisely to give that water something to steer by. */
export const DISTRICT_BEACON_HEIGHT = 14;

// ---------------------------------------------------------------- quality

export const DPR_HIGH: [number, number] = [1, 1.75];
export const DPR_LOW: [number, number] = [1, 1];

/** Icosahedron subdivision. Scales with RADIUS so face size stays roughly
 *  constant; shoreline colour bands resolve across 2-3 face rings.
 *
 *  Face edge is about 1.0515 * RADIUS / (detail + 1), so holding the old
 *  0.81-unit face at R=16 needs detail 19 (20 * 20^2 = 8000 triangles). The
 *  low-power tier holds a 1.53-unit face at detail 10. */
export const SPHERE_DETAIL_HIGH = 19;
export const SPHERE_DETAIL_LOW = 10;

/** Guard against tab-switch / GC pauses handing us a multi-second delta,
 *  which would teleport the character across the planet in one frame. */
export const MAX_DELTA = 1 / 30;

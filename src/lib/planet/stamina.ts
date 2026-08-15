/**
 * Sprint stamina, and the bridge that carries it to the DOM bar.
 *
 * Same architecture, and same reason, as `compass.ts`: the render loop writes
 * here every frame and the overlay reads it from its own rAF loop. A value
 * that changes 120 times a second has no business going through React state.
 *
 * This file must never import `three`.
 */

/** Seconds of sprint from full. Long enough to cross a channel or close the
 *  last stretch to a landmark, short enough that sprinting is a decision. */
export const STAMINA_MAX_S = 4;

/** Recovery is slower than the burn, or there is no reason not to hold shift
 *  permanently. Full refill from empty takes ~6.7s. */
export const STAMINA_REGEN_PER_S = 0.6;

/** Beat after sprinting stops before recovery starts, so tapping shift
 *  repeatedly is not a way to sprint forever. */
export const STAMINA_REGEN_DELAY_S = 0.7;

/**
 * Once empty, sprint stays locked until stamina climbs back to this fraction.
 *
 * The gap between "runs out at 0" and "available again" is the whole
 * anti-stutter mechanism, and it is exactly the trick MARKER_ENTER_ANGLE and
 * MARKER_EXIT_ANGLE use in config.ts: without hysteresis, a player holding
 * shift at zero stamina would get one frame of sprint per frame of regen and
 * the character would visibly judder.
 *
 * Set high rather than merely nonzero. At 0.25 the hysteresis technically
 * worked but a player who just holds shift got a 1-second burst, a stall, and
 * another 1-second burst, which reads as chop rather than as exhaustion. At
 * 0.45 the forced recovery buys ~1.8s of sprint, long enough to feel like a
 * second wind instead of a stutter.
 */
export const STAMINA_UNLOCK = 0.45;

export const stamina = {
  /** 0..1. */
  value: 1,
  /** True while sprint is refused because the meter bottomed out. */
  locked: false,
  /** True while the player is actually spending it, for the bar's styling. */
  draining: false,
};

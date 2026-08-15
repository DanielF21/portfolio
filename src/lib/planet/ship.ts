/**
 * The pirate ship: how big it is, where its decks are, and where it starts.
 *
 * One set of numbers, read by three different consumers: `pirate-ship.tsx`
 * builds the hull from them, `ship-state.ts` derives the walkable caps and the
 * helm position from them, and the deck heights appear in both. Splitting them
 * would let the deck you see drift from the deck you stand on, which is the one
 * failure this object cannot survive.
 *
 * The ship's LIVE pose is not here: it sails, so it lives in `ship-state.ts`.
 * What is here is authored and constant.
 *
 * This file must never import `three`.
 */

export const SHIP = {
  /**
   * THE REMOTEST POINT IN THE OCEAN, found by dense sampling rather than
   * picked by eye: the direction maximising the minimum angular distance to
   * any island's shoreline. It comes out equidistant from three of them,
   * 0.632 rad (about 10 units) from the nearest coast of shore, frost and
   * dune alike, and very nearly antipodal to ember.
   *
   * That spot is also the stretch of water with no beacon above the horizon
   * (see DISTRICT_BEACON_HEIGHT: reach is 1.008 rad, the nearest island centre
   * here is 1.073). So the ship is the only landmark in the one part of the
   * world that had none, which is a better reason to put it there than
   * "somewhere in the sea".
   *
   * Expressed relative to the continent so it follows if the map is re-laid.
   */
  bearing: 3.099,
  arc: 1.432,
  /** STARTING rotation of the hull about the surface normal, radians, after
   *  which the wheel owns it. Deliberately not aligned to any crossing: a ship
   *  lying at an angle reads as anchored, one pointing straight down a route
   *  reads as scenery. */
  heading: 0.7,

  /** Hull dimensions in world units, bow along local +X. */
  length: 7,
  beam: 2.5,

  /** Walkable surface, world units above RADIUS. Well clear of the ocean shell
   *  at RADIUS + 0.18. */
  deckHeight: 1.05,
  /** Half-width of each walkable cap, world units. */
  deckRadius: 1.35,
  /** Offsets along the hull's long axis at which those caps sit, world units.
   *  Spaced closer than the radius so they overlap into one deck. */
  deckOffsets: [-2.4, -0.8, 0.8, 2.2],

  /** Where the wheel stands, as an offset along the hull from the centre.
   *  On the quarterdeck, aft, which is where a ship's wheel goes. */
  helmOffset: -2.05,
  /** Height of the quarterdeck the helmsman stands on, world units. Higher
   *  than `deckHeight` because the wheel is up a level. Must equal the
   *  geometry's QUARTER_Y in `pirate-ship.tsx`, or the helmsman stands in
   *  the planking. */
  helmHeight: 1.67,
  /** Centre and half-width of the raised quarterdeck's walkable cap, world
   *  units, matching the planking the geometry lays at -L * 0.31. */
  quarterOffset: -2.17,
  quarterRadius: 0.8,
} as const;


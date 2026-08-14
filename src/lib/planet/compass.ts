/**
 * Bridge for the off-screen marker indicators.
 *
 * Same architecture, and same reason, as `input.ts`: the render loop writes
 * here every frame and the DOM overlay reads it from its own rAF loop. Routing
 * per-frame screen-space data through React state or zustand would re-render
 * the overlay 60 times a second for what is ultimately two CSS properties.
 *
 * This file must never import `three`. It holds plain numbers only; the
 * projection math lives in `components/planet/compass-tracker.tsx`, which is
 * inside the lazy three.js chunk.
 */

/** How many indicators are shown at once. All 14 markers pointing at you from
 *  every screen edge is noise, not navigation. */
export const COMPASS_SLOTS = 3;

export interface CompassSlot {
  /** Marker id, or null when this slot is unused this frame. */
  id: string | null;
  /** Short marker label, for the text next to the arrow. */
  label: string;
  /** Screen-space angle in radians, 0 = right, measured counter-clockwise.
   *  Already resolved for the behind-camera case. */
  angle: number;
  /** Arc length along the surface to walk there, in world units. This is the
   *  honest distance: the straight-line chord would understate a target on the
   *  far side of the planet by up to 36%. */
  distance: number;
}

function emptySlot(): CompassSlot {
  return { id: null, label: "", angle: 0, distance: 0 };
}

export const compass = {
  slots: Array.from({ length: COMPASS_SLOTS }, emptySlot),
};

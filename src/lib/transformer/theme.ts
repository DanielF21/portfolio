/**
 * The palette, and the render constants that go with it.
 *
 * Every colour is an sRGB hex string. R3F has colour management on, so hex is
 * the correct input and three converts it. Do NOT hand-write linear values
 * here: the planet does that (and documents why at length), and a scene that
 * mixes the two conventions gets objects rendering three times too dark. This
 * scene picks hex and never deviates.
 *
 * The three material classes carry the lesson, so they must stay visually
 * distinct at a glance and in a screenshot:
 *
 *   weight      static, loaded once, costs memory at rest   cool, matte
 *   activation  transient, exists for one forward pass      warm, emissive
 *   cache       neither static nor transient, and it grows  its own hue
 *
 * This file must never import `three`. Strings only.
 */

/** Near black with a blue cast, matching the register of the rest of the site
 *  without being the planet's exact backdrop. */
export const BACKGROUND = "#070910";

/** Weights: machined, cool, structural. Deliberately desaturated so the warm
 *  activations read as the only live thing in the frame. */
export const WEIGHT = "#5b6780";
export const WEIGHT_DIM = "#39424f";
export const WEIGHT_LINE = "#8b9ab8";

/** Activations and the residual stream. This is the site's brand hue, so the
 *  piece reads as part of the portfolio rather than as a stock diagram. */
export const ACTIVATION = "#f4570d";
export const ACTIVATION_SOFT = "#ff9152";
export const STREAM = "#f4570d";

/** The KV cache. Its own hue because it is neither a weight nor an activation,
 *  and the whole point of the last view is that it is a third kind of thing. */
export const CACHE = "#2fd4bd";
export const CACHE_DIM = "#1b6f66";

/** Operations carry no parameters, so they are drawn as outline rather than
 *  mass. Mask, softmax, residual add, SiLU gate. */
export const OP_LINE = "#7c89a6";

/** What the cursor is on. One highlight colour for the whole scene. */
export const HIGHLIGHT = "#ffffff";

// ------------------------------------------------------------------ camera

export const CAM_NEAR = 0.05;
/** The stack is long and the embedding wall is enormous, so the far plane has
 *  to clear both. Kept as tight as it can be: depth precision is what stops
 *  the grid lines on a distant plate from z-fighting with the plate. */
export const CAM_FAR = 900;

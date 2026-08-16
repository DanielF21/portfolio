/**
 * The palette, and the render constants that go with it.
 *
 * Every colour is an sRGB hex string. R3F has colour management on, so hex is
 * the correct input and three converts it. Do NOT hand-write linear values
 * here: the planet does that (and documents why at length), and a scene that
 * mixes the two conventions gets objects rendering three times too dark. This
 * scene picks hex and never deviates.
 *
 * THE BACKGROUND IS THE ACCENT HUE AT VERY LOW LIGHTNESS, and that is the whole
 * trick of this register. It was measured off the reference this piece is
 * answering: its accent is hsl(108) and its backdrop is hsl(107) at 7%
 * lightness, so every neutral in the frame is quietly tinted toward the one
 * saturated colour and the accent never looks pasted on. The first version of
 * this file had a blue-black backdrop (hsl 225) under an orange accent (hsl 19),
 * 154 degrees apart, and that mismatch was a real part of why the piece read as
 * incoherent.
 *
 * VALUE, NOT HUE, SEPARATES THE THREE CLASSES. Weights sit only a little above
 * the background and read by silhouette, rim light and etched grid rather than
 * by being a competing colour. Saturation is spent exclusively on the things
 * that change per token.
 *
 *   weight      static, loaded once, costs memory at rest   near-background, matte
 *   activation  transient, exists for one forward pass      the accent, emissive
 *   cache       neither static nor transient, and it grows  its own hue
 *   operation   carries no parameters at all                line work only
 *
 * This file must never import `three`. Strings only.
 */

/** Accent hue, in degrees. Every neutral below is mixed toward it. */
const ACCENT_HUE = 19;

// -------------------------------------------------------------- the field

/** The accent at 7% lightness. See the note above: this is not a neutral. */
export const BACKGROUND = "#1a0f0a";

/** Panel and card surfaces. A touch above the field so a bordered region reads
 *  as a region even before its border is drawn. */
export const SURFACE = "#1e1410";

// ------------------------------------------------------------- the classes

/**
 * Weights: static mass, near the background value.
 *
 * Much darker than they used to be (these were a mid slate at 43% lightness).
 * The reference's module is nearly black and reads entirely through silhouette
 * and edge light, and that is what stops 28 repeated blocks from becoming a
 * wall of grey. The rim light in `scene.tsx` and the etched grid in
 * `grid-material.ts` are what make these legible; if either is removed, these
 * values are too dark and must move together with it.
 */
export const WEIGHT = "#423b38";
export const WEIGHT_DIM = "#292523";
export const WEIGHT_LINE = "#81716a";

/** Activations and the residual stream. This is the site's brand hue, so the
 *  piece reads as part of the portfolio rather than as a stock diagram, and it
 *  is the ONLY saturated thing in the frame. */
export const ACTIVATION = "#f4570d";
export const ACTIVATION_SOFT = "#ff9152";
export const STREAM = "#f4570d";

/** The KV cache. Its own hue because it is neither a weight nor an activation,
 *  and the whole point of the last view is that it is a third kind of thing.
 *  The one deliberate exception to "one accent". */
export const CACHE = "#2fd4bd";
export const CACHE_DIM = "#1b6f66";

/** Operations carry no parameters, so they are drawn as outline rather than
 *  mass. Mask, softmax, residual add, SiLU gate, both norms, RoPE.
 *
 *  Under the new proportional rule this is load bearing rather than stylistic:
 *  a tensor's on-screen AREA is its parameter count, so RMSNorm's 1,536
 *  parameters against q_proj's 2.36M would be a hairline. Drawing operations as
 *  line work keeps them visible and clickable while making it obvious they are
 *  not carrying weight. */
export const OP_LINE = "#6d5d55";

/** The ground grid. Present so nothing floats in a void; kept well below the
 *  weights so it never competes with the model standing on it. */
export const GROUND_LINE = "#372b25";

/** What the cursor is on. One highlight colour for the whole scene. */
export const HIGHLIGHT = "#ffffff";

// -------------------------------------------------------------- the shell

/**
 * The accent at an arbitrary alpha, for the DOM shell.
 *
 * The reference's whole chrome is three values of one colour: the outer frame at
 * full accent, inner rules at 20%, dim text around 35%. Deriving them here
 * rather than scattering `rgba(244, 87, 13, 0.2)` literals through the overlay
 * is what keeps the frame and the scene the same piece of design.
 */
export function accent(alpha = 1): string {
  return alpha >= 1 ? ACTIVATION : `rgba(244, 87, 13, ${alpha})`;
}

/** Named steps off `accent`, so the overlay never picks an alpha by feel. */
export const FRAME = accent(1);
export const RULE = accent(0.2);
export const RULE_SOFT = accent(0.1);
export const TEXT_DIM = accent(0.45);

/** Foreground text. Warm off-white rather than pure white, for the same reason
 *  the background is not neutral. */
export const TEXT = "#f6ece7";
export const TEXT_MUTED = "rgba(246, 236, 231, 0.45)";
export const TEXT_FAINT = "rgba(246, 236, 231, 0.28)";

// ------------------------------------------------------------------ camera

export const CAM_NEAR = 0.05;
/** The stack is long and the embedding wall is enormous, so the far plane has
 *  to clear both. Kept as tight as it can be: depth precision is what stops
 *  the grid lines on a distant plate from z-fighting with the plate. */
export const CAM_FAR = 900;

// -------------------------------------------------------------------- fog

/**
 * Linear fog range, in world units from the camera.
 *
 * Depth cueing, not atmosphere. The model runs tens of units deep and every
 * block is identical, so without this the far end of the stack is lit exactly
 * like the near end and the eye has nothing to order them by. Fog colour is the
 * background, so receding geometry dissolves into the field rather than into a
 * visible haze.
 */
export const FOG_NEAR = 26;
export const FOG_FAR = 105;

/** Hue every neutral above was mixed toward. Exported so a future colour can be
 *  derived rather than eyeballed. */
export { ACCENT_HUE };

/**
 * The palette, and the render constants that go with it.
 *
 * Every colour is an sRGB hex string. R3F has colour management on, so hex is
 * the correct input and three converts it. Do NOT hand-write linear values
 * here: the planet does that (and documents why at length), and a scene that
 * mixes the two conventions gets objects rendering three times too dark. This
 * scene picks hex and never deviates.
 *
 * THE FIELD IS NEUTRAL AND ONLY THE SIGNAL IS SATURATED, and that is a reversal
 * of what this file used to say. The old recipe was "the background is the
 * accent hue at 7% lightness", measured off gpu.kylejeong.com, which is the
 * piece this one was built in answer to. It works, and it is exactly why the two
 * looked like the same instrument in different colours: when the field, the
 * rules, the labels and the geometry are all one hue, the result is that site's
 * signature whatever hue you choose. The resemblance was the thing being
 * removed, so the recipe went with it.
 *
 * What replaces it is a drafting plate seen as a negative print. The field is a
 * cool ink with almost no chroma, the chrome is bone white line work at low
 * alpha, and the ONE saturated colour in the frame is the signal: activations
 * and the residual stream. A plate is line work plus one ink, and that is now
 * literally true here.
 *
 * VALUE, NOT HUE, STILL SEPARATES THE THREE CLASSES. Weights sit only a little
 * above the field and read by silhouette, rim light and etched grid rather than
 * by being a competing colour.
 *
 *   weight      static, loaded once, costs memory at rest   near-field, matte
 *   activation  transient, exists for one forward pass      the signal, emissive
 *   cache       neither static nor transient, and it grows  its own hue
 *   operation   carries no parameters at all                line work only
 *
 * DERIVED, NOT TYPED. The neutrals below are computed from one hue and one
 * saturation, so the relationship between them is executed rather than asserted
 * and the whole field can be moved by editing two numbers. Same rule the
 * geometry follows.
 *
 * This file must never import `three`. Strings only.
 */

// ------------------------------------------------------------------ mixing

function hex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n * 255)))
    .toString(16)
    .padStart(2, "0");
}

/**
 * HSL to sRGB hex. Ten lines, and it buys the whole palette one place to be
 * wrong instead of a dozen hand-mixed literals that drift apart.
 */
function hsl(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r, g, b] =
    hp < 1 ? [c, x, 0]
    : hp < 2 ? [x, c, 0]
    : hp < 3 ? [0, c, x]
    : hp < 4 ? [0, x, c]
    : hp < 5 ? [x, 0, c]
    : [c, 0, x];
  const m = l - c / 2;
  return `#${hex(r + m)}${hex(g + m)}${hex(b + m)}`;
}

/** The field hue. Cool, and almost entirely desaturated: it is ink, not a
 *  colour. Every neutral in the piece is this hue. */
const FIELD_HUE = 215;

// -------------------------------------------------------------- the field

export const BACKGROUND = hsl(FIELD_HUE, 0.22, 0.07);
/** Panel and card surfaces. A touch above the field so a bordered region reads
 *  as a region even before its border is drawn. */
export const SURFACE = hsl(FIELD_HUE, 0.2, 0.1);

// ------------------------------------------------------------- the classes

/**
 * Weights: static mass, near the field value.
 *
 * Dark on purpose. The nearly-black module in the reference reads entirely
 * through silhouette and edge light, and that is what stops 28 repeated blocks
 * from becoming a wall of grey; the same reasoning survives the change of
 * register, because a plate's mass is also read by its outline. The rim light in
 * `scene.tsx` and the etched grid in `grid-material.ts` are what make these
 * legible; if either is removed, these values are too dark and must move with it.
 */
export const WEIGHT = hsl(FIELD_HUE, 0.1, 0.24);
export const WEIGHT_DIM = hsl(FIELD_HUE, 0.1, 0.15);
export const WEIGHT_LINE = hsl(FIELD_HUE, 0.12, 0.48);

/**
 * Activations and the residual stream: THE ONLY SATURATED THING IN THE FRAME.
 *
 * The site's brand hue, so the piece reads as part of the portfolio rather than
 * as a stock diagram. It used to be the hue everything else was tinted toward as
 * well; now it is spent exclusively on the thing that changes per token, which
 * is what makes it read as a signal rather than as a theme.
 */
export const SIGNAL = "#f4570d";
export const ACTIVATION = SIGNAL;
export const ACTIVATION_SOFT = "#ff9152";
export const STREAM = SIGNAL;

/** The KV cache. Its own hue because it is neither a weight nor an activation,
 *  and the whole point of the last view is that it is a third kind of thing.
 *  The one deliberate exception to "one signal". */
export const CACHE = "#2fd4bd";
export const CACHE_DIM = "#1b6f66";

/** Operations carry no parameters, so they are drawn as outline rather than
 *  mass. Mask, softmax, residual add, SiLU gate, both norms, RoPE.
 *
 *  Under the proportional rule this is load bearing rather than stylistic: a
 *  tensor's on-screen AREA is its parameter count, so RMSNorm's 1,536 parameters
 *  against q_proj's 2.36M would be a hairline. Drawing operations as line work
 *  keeps them visible and clickable while making it obvious they are not
 *  carrying weight. */
export const OP_LINE = hsl(FIELD_HUE, 0.12, 0.4);

/** The datum the model stands on. Kept well below the weights so it never
 *  competes with the thing standing on it. */
export const GROUND_LINE = hsl(FIELD_HUE, 0.2, 0.17);

// -------------------------------------------------------------- the shell

/** Foreground text and full-strength line work. A cool bone rather than pure
 *  white, so it reads as ink on a print rather than as a screen's white.
 *  Declared before `line`, which returns it: a `const` referenced from a
 *  function called during module evaluation has to already exist. */
const INK = "#e9edf2";

/**
 * Bone white at an arbitrary alpha: every rule, border and label in the chrome.
 *
 * THIS IS WHAT THE ACCENT USED TO DO. The reference's whole chrome is three
 * values of one saturated colour, and copying that recipe is most of why the two
 * pieces read alike. Here the chrome is line work, the way a drawing's rules and
 * annotations are, and the signal is never spent on furniture.
 */
export function line(alpha = 1): string {
  return alpha >= 1 ? INK : `rgba(233, 237, 242, ${alpha})`;
}

/** The signal at an arbitrary alpha, for the few places the chrome is allowed to
 *  carry it: what is selected, and the legend's own swatch. */
export function accent(alpha = 1): string {
  return alpha >= 1 ? SIGNAL : `rgba(244, 87, 13, ${alpha})`;
}

/** Named steps off `line`, so the overlay never picks an alpha by feel. A plate
 *  has a margin rule, division rules between its regions, and hairlines inside a
 *  table; these are those three. */
export const FRAME = line(0.3);
export const RULE = line(0.16);
export const RULE_SOFT = line(0.08);

export const TEXT = INK;
export const TEXT_MUTED = line(0.5);
export const TEXT_FAINT = line(0.3);

// ------------------------------------------------------------------ lights

/** The two fixed light colours, here rather than in `scene.tsx` so the rig and
 *  the palette cannot drift apart. Sky and ground for the hemisphere, and the
 *  rim that rides the camera. All three are field-hue, because a warm rim over a
 *  cool field is exactly the two-temperature look this register is not. */
export const SKY_LIGHT = hsl(FIELD_HUE, 0.18, 0.42);
export const GROUND_LIGHT = hsl(FIELD_HUE, 0.25, 0.05);
export const RIM_LIGHT = hsl(FIELD_HUE, 0.16, 0.88);

// ------------------------------------------------------------------ camera

export const CAM_NEAR = 0.05;
/** The stack is long and the embedding wall is enormous, so the far plane has
 *  to clear both. Kept as tight as it can be: depth precision is what stops
 *  the grid lines on a distant plate from z-fighting with the plate. */
export const CAM_FAR = 900;

// -------------------------------------------------------------------- fog

/**
 * Fog range, as MULTIPLES OF THE CAMERA'S DISTANCE rather than world units.
 *
 * Depth cueing, not atmosphere. The model runs tens of units deep and every
 * block is identical, so without fog the far end of the stack is lit exactly
 * like the near end and the eye has nothing to order them by. Fog colour is the
 * background, so receding geometry dissolves into the field rather than into a
 * visible haze.
 *
 * WHY RELATIVE. A fixed range cannot serve both ends of this piece. The camera
 * sits 5 units from the output projection and 114 from the whole stack, a
 * factor of more than twenty, so any absolute far plane is either so close that
 * the overview is a solid wall of background (which is exactly what happened at
 * 105) or so far that a close-up gets no depth cue at all. Tying it to the shot
 * means every shot gets the same amount of cueing, which is what depth cueing
 * meant in the drafting sense the term comes from.
 */
export const FOG_NEAR_SCALE = 0.55;
export const FOG_FAR_SCALE = 2.1;

/** The hue every neutral above is mixed from. Exported so a future colour can be
 *  derived rather than eyeballed. */
export { FIELD_HUE };

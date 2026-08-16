/**
 * Where things are, in world units.
 *
 * The one rule: WIDTH IS PROPORTIONAL TO THE REAL DIMENSION. `widthFor` is the
 * only way a hidden size becomes a number of units, so the MLP is 5.83 times
 * wider than the residual stream on screen because it is 5.83 times wider in
 * the model, not because that looked good. This is the whole reason the
 * geometry counts as evidence rather than illustration.
 *
 * The exception is the vocabulary axis. 151936 rows at this scale is 297 world
 * units against a 3 unit stream, so the embedding wall is drawn ELIDED: real
 * rows, a break, and the last row, with the true count on the label. An elision
 * that is visible and stated is honest; silently squashing it to fit is not.
 *
 * AXES. The stack runs along Z, blocks stacked front to back. Tensor width is
 * X, the sequence axis is Y. The focused block sits at the origin and the whole
 * stack slides so that stays true, which is why block positions are relative to
 * the focused layer rather than absolute.
 *
 * This file must never import `three`.
 */

import { CONFIG } from "./config";
import { DERIVED } from "./model";

// ------------------------------------------------------------------- scale

/** World units per unit of tensor width. Fixed by choosing the residual stream
 *  to be 3 units wide; everything else follows from the config. */
export const STREAM_WIDTH = 3.0;
const WIDTH_SCALE = STREAM_WIDTH / CONFIG.hiddenSize;

/** Turn a real tensor dimension into a world width. */
export function widthFor(dim: number): number {
  return dim * WIDTH_SCALE;
}

/** Above this many world units a tensor is drawn elided rather than whole.
 *  Sized so the MLP (17.5 units) stays real and only the vocabulary axis
 *  breaks. */
export const ELIDE_ABOVE = 40;

export function needsElision(dim: number): boolean {
  return widthFor(dim) > ELIDE_ABOVE;
}

// -------------------------------------------------------------- the stack

/** How many tokens the activations are drawn with.
 *
 *  A sequence length is a runtime property, not a model dimension, so unlike
 *  every width in this file it is chosen rather than derived. It matches the
 *  prompt length the capture uses, so the grids on activations agree with the
 *  attention maps that will be laid over them. */
export const SEQ_TOKENS = 12;

/** Distance between adjacent block centres along Z. */
export const BLOCK_PITCH = 1.1;
/** Thickness of a block in its collapsed forms. Less than the pitch, so the
 *  stack reads as discrete blocks with gaps rather than as one bar. */
export const PLATE_DEPTH = 0.5;
/** How far the sequence axis extends. Not proportional to anything: sequence
 *  length is a runtime property, not a model dimension. */
export const SEQ_HEIGHT = 2.0;

/**
 * How high above the stream a block's machinery sits.
 *
 * THE BLOCKS DO NOT ENCLOSE THE STREAM, THEY BRANCH OFF IT. Two earlier
 * attempts had the stream running through the middle of each block, and both
 * failed the same way: the stream is then invisible everywhere except its own
 * end cap, so the single most important object in the scene reads as an orange
 * box at the near end and nothing else.
 *
 * Branching also happens to be the truth. A block does not transform the
 * stream in place. It READS the stream, computes off to one side, and ADDS the
 * result back. Drawing the machinery on a branch with a tap at each end says
 * that, and it keeps the stream unbroken from the embedding to the final norm.
 */
export const BRANCH_Y = 2.5;

/** Cross section of a collapsed block, on the branch. Not proportional to
 *  anything: a block's world extent never was. */
export const BLOCK_W = 4.2;
export const BLOCK_H = 2.6;

/**
 * Cross section of the long run of stream between blocks.
 *
 * Deliberately NOT the stream's true 1536-wide cross section, and this is the
 * one place in the file that departs from proportionality on purpose. A bar at
 * true section running the whole 40 unit length of the model has more surface
 * area than every other object in the scene put together, and it renders as a
 * girder with some small dark fins attached. It stopped reading as a stream at
 * all.
 *
 * What it costs is nothing, because the comparison that matters is LOCAL: the
 * MLP taper starts from a slab drawn at the true `STREAM_WIDTH` and widens to
 * the true intermediate width, inside the station where you actually look at
 * it. The long run between stations is a conduit, and a conduit is schematic.
 * The inspector still reports its real shape.
 */
export const CONDUIT_W = 1.0;
export const CONDUIT_H = 0.55;

/** Z extent the hero block occupies once it opens up. Everything else on the
 *  stack is pushed outward to make room, which is the "blooming open" motion.
 *  Must cover every station plus its own depth; see `STATIONS`. */
export const EXPLODED_DEPTH = 9.4;

/** How far each side of the stack is pushed out by the open block. */
const EXPLOSION_GAP = (EXPLODED_DEPTH - BLOCK_PITCH) / 2;

/**
 * Z of block `i` when `focused` is the hero. The focused block is always at the
 *  origin and the stack slides underneath it.
 *
 * The sign matters. Block 0 sits at POSITIVE z, nearest the default camera, and
 * later blocks recede away from it. So the model runs left to right and into
 * the distance, which is both reading order and the direction the fly-through
 * travels. Flipping this reverses the dataflow on screen.
 */
export function blockZ(i: number, focused: number): number {
  const d = focused - i;
  if (d === 0) return 0;
  return d * BLOCK_PITCH + Math.sign(d) * EXPLOSION_GAP;
}

/** Where the stack starts and ends along Z, so the residual stream knows how
 *  long to be and the overview knows what it has to frame. */
export function stackZRange(focused: number): [number, number] {
  const first = blockZ(0, focused);
  const last = blockZ(CONFIG.numHiddenLayers - 1, focused);
  return [Math.min(first, last), Math.max(first, last)];
}

// -------------------------------------------- inside the exploded block

/**
 * Where each station sits along Z inside the open block, input first.
 *
 * Ordered exactly as the dataflow runs: normalise, attend, add back, normalise
 * again, mix, add back. The two adds are what make the residual stream a stream
 * rather than a chain, so they get their own stations instead of being implied.
 */
export const STATIONS = Object.freeze({
  ln1: 4.2,
  attn: 2.4,
  add1: 0.6,
  ln2: -0.1,
  mlp: -1.8,
  add2: -3.6,
});

/** Naming and ordering of stations lives in `glossary.ts`, with the poses, so
 *  there is one list to keep in step with the index rather than two. */

/** Z depth the MLP's own parts are spread over, inside its station. Wide enough
 *  that the projections and the activation between them stay separable when the
 *  camera is near the stack's axis. */
export const MLP_DEPTH = 2.6;

/** Z depth attention spreads over. It has four sub-stations to the MLP's three
 *  and one of them, the score grid, is a square rather than a plate. */
export const ATTN_DEPTH = 3.6;

/** Sub-stations inside attention, local to its group, input first. */
export const ATTN_STATIONS = Object.freeze({
  /** The three weight matrices. Where GQA becomes visible. */
  qkv: 1.55,
  /** Rotation applied to Q and K on the way in. Sits between the projections
   *  and the head split because that is where it happens. */
  rope: 0.75,
  /** Their outputs, split into heads. */
  heads: -0.05,
  /** Q dot K transpose, masked. */
  scores: -0.85,
  /** Heads recombined and mixed back to the stream's width. */
  out: -1.65,
});

/**
 * How big the score grid is drawn.
 *
 * Both its axes are sequence length, which is a runtime property and not a
 * model dimension, so `widthFor` does not apply and this is a chosen size like
 * `SEQ_HEIGHT`. Every width that IS a model dimension stays proportional.
 */
export const SCORES_SIZE = 2.6;

/** Head slices are drawn this fraction of their true pitch, so there is a gap
 *  between them. The slice CENTRES stay exact, so the group's total extent is
 *  still the true width of the projection. */
export const HEAD_FILL = 0.72;

// ------------------------------------------------------------------ tiers

export type Tier = "exploded" | "solid" | "plate";

/** How many blocks either side of the hero stay solid before dropping to
 *  plates. One each side is enough to say "the neighbours are the same thing"
 *  without cluttering the hero. */
export const SOLID_RADIUS = 1;

export function tierFor(i: number, focused: number): Tier {
  const d = Math.abs(i - focused);
  if (d === 0) return "exploded";
  if (d <= SOLID_RADIUS) return "solid";
  return "plate";
}

// ------------------------------------------------- widths worth naming once

export const WIDTHS = Object.freeze({
  stream: STREAM_WIDTH,
  intermediate: widthFor(CONFIG.intermediateSize),
  head: widthFor(DERIVED.headDim),
  kv: widthFor(DERIVED.kvDim),
  /** What the vocabulary axis WOULD be, unelided. Kept so the elision can say
   *  by how much it is cheating. */
  vocabTrue: widthFor(CONFIG.vocabSize),
});

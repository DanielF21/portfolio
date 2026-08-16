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

/**
 * Turn a real tensor dimension into a world height.
 *
 * The same scale as `widthFor`, deliberately, and that is the whole point: when
 * BOTH axes of a weight matrix go through one scale, the slab's on-screen AREA
 * becomes proportional to its parameter count, because `area = widthFor(out) *
 * heightFor(in) = out * in * WIDTH_SCALE^2` and `params = in * out`. One
 * constant, no tuning, and the MLP's dominance stops being a caption.
 *
 * Before this existed, height was an arbitrary 0.38 to 0.72 and only width
 * carried meaning.
 *
 * WHICH AXIS IS WHICH. `tensor-slab` maps columns across the face and rows up
 * it, and every caller passes `rows = the INPUT dim, cols = the OUTPUT dim`. So
 * width is the output dim and height is the input dim, not the other way round.
 * Getting this backwards transposes every matrix in the scene and, worse, turns
 * the Q/K/V comparison from a width comparison into a height one, which is
 * exactly the reading its camera pose exists to make.
 */
export function heightFor(dim: number): number {
  return dim * WIDTH_SCALE;
}

/**
 * Thickness of every weight slab.
 *
 * One constant rather than the 0.16-here-0.12-there it replaced. Once slabs are
 * bevelled and lit the eye reads VOLUME rather than area, so a shared depth is
 * what makes volume-proportionality follow from area-proportionality for free.
 */
export const SLAB_DEPTH = 0.16;

/**
 * Below this many world units an axis is drawn at the floor and MARKED.
 *
 * The mirror of `ELIDE_ABOVE`, and it exists because area proportionality has a
 * bottom end as well as a top one. RMSNorm is a 1,536 element vector, so its
 * second axis is `heightFor(1) = 0.002` units: sub-pixel everywhere and
 * impossible to hover. Drawing it at a usable size is unavoidable.
 *
 * What is avoidable is doing that silently. The old code drew RMSNorm at 4.2 x
 * 0.38, which under an area rule reads as roughly 418,000 parameters against an
 * actual 1,536, a 270x overstatement with nothing on screen to say so. A floor
 * that is drawn with the same visible break the embedding wall uses is honest;
 * the same floor drawn as an ordinary slab is not.
 */
export const MIN_AXIS = 0.16;

export function needsFloor(dim: number): boolean {
  return widthFor(dim) < MIN_AXIS;
}

/** Above this many world units a tensor is drawn elided rather than whole.
 *  Sized so the MLP (17.5 units) stays real and only the vocabulary axis
 *  breaks. */
export const ELIDE_ABOVE = 40;

// ----------------------------------------------------------------- ground

/**
 * Y of the ground plane the model stands on.
 *
 * The ground is not decoration. Without it every object floats in an unbounded
 * void, which is most of what made the empty parts of the frame read as nothing
 * rather than as space; a grid under the model turns the same pixels into a
 * workbench. It also gives the eye a horizontal to measure the model's height
 * against, which matters now that height carries meaning.
 *
 * Sits below the stream rather than at it, so the stream is visibly suspended
 * and the two never z-fight.
 */
export const GROUND_Y = -3.2;

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
 *  anything: a block's world extent never was.
 *
 *  `BLOCK_H` was 2.6 when every weight inside a block was a 0.38 to 0.72 unit
 *  bar. Now that heights are real and the tallest weight in a block stands 17.5
 *  units, a 2.6 plate reads as a wafer next to the one block that is open, and
 *  the stack looks like a flat plain with a single spire on it. Five is a
 *  summary of the block rather than a contradiction of it. */
export const BLOCK_W = 4.2;
export const BLOCK_H = 5.0;

/**
 * Everything in a block is BOTTOM ALIGNED ON THE BRANCH, growing upward.
 *
 * One rule, enforced everywhere, and it exists because heights are now real and
 * wildly unequal: `down` is 17.5 units and `gate` is 3.0. Centring both on the
 * branch would sink `down` 8.75 units below it, through the residual stream at
 * y=0 and out the bottom of the ground plane at y=-3.2. Centring only the tall
 * ones is worse, because then half the tensors sit on a line and half straddle
 * it and no reading of the picture is consistent.
 *
 * Growing upward from a common baseline also makes the branch read as the floor
 * the machinery stands on, which is what it is: the block's parts all read the
 * stream from the same place.
 */
export const BLOCK_BASELINE = 0;

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
export function blockZ(i: number, focused: number, open = true): number {
  const d = focused - i;
  if (!open) return d * BLOCK_PITCH;
  if (d === 0) return 0;
  return d * BLOCK_PITCH + Math.sign(d) * EXPLOSION_GAP;
}

/** Where the stack starts and ends along Z, so the residual stream knows how
 *  long to be and the overview knows what it has to frame. */
export function stackZRange(focused: number, open = true): [number, number] {
  const first = blockZ(0, focused, open);
  const last = blockZ(CONFIG.numHiddenLayers - 1, focused, open);
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

/**
 * Vertical pitch of the Q, K and V plates.
 *
 * They all have the same INPUT dimension, so under real heights they are all
 * exactly `heightFor(1536)` = 3.0 tall and the only thing that differs between
 * them is width. That is the bar chart the view exists to be, and it is now true
 * rather than a drawing convention: equal height because equal input, different
 * width because different output.
 *
 * The pitch has to clear that height or the plates interpenetrate. It used to be
 * 0.72 against a 0.5 height.
 */
export const QKV_PITCH = heightFor(CONFIG.hiddenSize) + 0.34;

// ------------------------------------------------------------------ tiers

export type Tier = "exploded" | "solid" | "plate";

/** How many blocks either side of the hero stay solid before dropping to
 *  plates. One each side is enough to say "the neighbours are the same thing"
 *  without cluttering the hero. */
export const SOLID_RADIUS = 1;

export function tierFor(i: number, focused: number, open = true): Tier {
  // THE OVERVIEW OPENS NOTHING. Every block is a plate until you ask for one.
  //
  // It used to hold the hero open at all times, and that cost the whole-model
  // shot twice over. The MLP's `down` stands 17.5 units where a plate is 5, so
  // one open block made the model 20 units tall against 52 long: measured, its
  // projected bounding box is 1.11:1 and it cannot fill a 2.1:1 viewport at any
  // three quarter angle, at any distance. It also made the overview a picture
  // of one MLP with a stack behind it rather than a picture of the stack.
  //
  // Closed, the same shot projects at 1.91:1, which is the frame. And the
  // opening becomes what drilling in is FOR.
  if (!open) return "plate";
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

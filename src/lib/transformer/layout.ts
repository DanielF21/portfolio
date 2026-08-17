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
 * The area rule, stated in the units a reader can check it in.
 *
 * DERIVED, NOT WRITTEN DOWN. `area = widthFor(out) * heightFor(in)` and
 * `params = in * out`, so the ratio is `WIDTH_SCALE^2` and its inverse is how
 * many parameters one square world unit stands for. Typing that number into the
 * overlay would be the one hard-coded figure in a piece whose whole claim is
 * that there are none; computing it here means moving `STREAM_WIDTH` moves the
 * sentence too.
 *
 * It comes out at exactly 262,144 (2^18) for this model, which is a coincidence
 * of 1536 dividing 3.0 and not something to rely on.
 */
export const PARAMS_PER_SQUARE_UNIT = 1 / (WIDTH_SCALE * WIDTH_SCALE);

/**
 * Kept to one line. The panel has room for the claim, not for the argument; the
 * geometry makes the argument.
 *
 * IT NAMES ITS OWN EXCEPTION, and has to. Two axes are now drawn with a break:
 * the vocabulary and the intermediate. A rule with silent exceptions is worse
 * than no rule, and the break is visible on the object itself, so the sentence
 * only has to tell a reader what the break means.
 */
export const WIDTH_SCALE_NOTE =
  `A weight's area is its parameter count: one square unit is ` +
  `${Math.round(PARAMS_PER_SQUARE_UNIT).toLocaleString("en-US")} parameters. ` +
  `Where an axis is too long to draw it is broken, not squashed.`;

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

/** Above this many world units a tensor is drawn elided rather than whole. */
export const ELIDE_ABOVE = 40;

/**
 * The intermediate axis, drawn short.
 *
 * THIS IS THE SECOND PLACE THE AREA RULE IS BROKEN, and like the first it is
 * broken visibly or not at all. `widthFor(8960)` is 17.5 units, which is the
 * truth: gate, up and down hold 13,762,560 parameters each, 5.8 times Q, and
 * drawn to scale the MLP is 88% of a block and towers over everything near it.
 * Daniel asked for it closer to the size of the other parts.
 *
 * A silent squash is not available. The whole claim of this piece is that the
 * geometry can be trusted, and the key on screen states the area rule in
 * parameters per square unit. So the intermediate axis gets exactly what the
 * vocabulary axis gets: real cells at the real pitch, a VISIBLE BREAK, and the
 * true count on the label. A reader can see that something has been removed and
 * read how much.
 *
 * The cost, stated so nobody has to rediscover it: area is no longer parameter
 * count for the three MLP weights. `WIDTH_SCALE_NOTE` and the key say so.
 */
export const INTERMEDIATE_TRUE = widthFor(CONFIG.intermediateSize);
export const INTERMEDIATE_DRAWN = 7.0;
/** Width of the break, in the drawn axis. */
export const INTERMEDIATE_BREAK = 0.8;
/** What one drawn segment covers, either side of the break. */
export const INTERMEDIATE_SEGMENT =
  (INTERMEDIATE_DRAWN - INTERMEDIATE_BREAK) / 2;
/** How many of the 8,960 columns a segment stands for, so the CELL PITCH is
 *  unchanged from every other tensor in the scene and only the count is cut. */
export const INTERMEDIATE_SEGMENT_COLS = Math.round(
  CONFIG.intermediateSize * (INTERMEDIATE_SEGMENT / INTERMEDIATE_TRUE)
);

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

/**
 * Columns the KV cache grid is drawn with, and therefore what decode can fill.
 *
 * IT LIVES HERE RATHER THAN IN `kv-cache.tsx` BECAUSE TWO THINGS NEED IT. The
 * grid draws this many columns; the store has to stop decode at the same number,
 * or the counter runs past the last drawn column and the caption reports tokens
 * that are nowhere on screen. A capacity known to only one of the two is a
 * capacity the other silently violates.
 *
 * The prompt plus room to watch decode extend it, which is the whole point of
 * the mode toggle.
 */
export const CACHE_TOKENS = SEQ_TOKENS + 8;

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
 *
 * THE RULE IS NOW UNIVERSAL, AND IT WAS NOT BEFORE. The RoPE dial bank, both
 * head rows, the fan and the score grid were all centred on the branch instead,
 * so half of each hung below the line the projections feeding them grew up from,
 * and the whole key/value row sat underneath it. Measured, the station centres
 * ran 1.04, 2.50, 3.58, 4.00, 7.34 and 11.38, which is what "the individual
 * items are different sizes centred at different points" was describing. Nothing
 * in a block may straddle this line.
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

// -------------------------------------------- inside the exploded block

/**
 * Z depth the MLP's own parts are spread over, inside its station.
 *
 * Five stages at 0.9 apart. It was 2.6, which at five stages left `up` 0.05 from
 * the intermediate activation, so each hid the other completely.
 */
export const MLP_DEPTH = 2.7;

/**
 * The block's stations, in dataflow order, and the CLEAR GAP after each.
 *
 * THIS SPACING IS THE WHOLE REASON A STATION CAN BE LOOKED AT WITHOUT HIDING
 * ITS NEIGHBOURS, so it is measured rather than chosen for looks.
 *
 * Every station sits on the branch at x = 0, and every tensor face points along
 * ±Z, which is the station axis. So a camera close to that axis sees the whole
 * block stacked into one column and the only fix is to hide things, which is
 * what this piece used to do and what makes an isolated part meaningless. The
 * fix is the other one: stand off the axis, and space the stations far enough
 * apart that standing off the axis actually separates them.
 *
 * The arithmetic. A camera at azimuth `theta` from a subject sees an occluder
 * `u` units upstream displaced sideways by `u * sin(theta)` (exactly, in the
 * orthographic limit; more than that up close, which only helps). Two stations
 * of half width `wA` and `wB` therefore stop overlapping once
 *
 *     u * sin(theta) > wA + wB
 *
 * At the in-block azimuth of 0.8 radians that is `u > 1.4 * (wA + wB)`.
 *
 * EVERY GAP WAS THEN CUT TO 0.75 OF WHAT THAT ARITHMETIC ASKS FOR, deliberately,
 * because at the full figure the block was mostly dead space between parts. Two
 * of the chosen drawing scales came down with it (the dial pitch and the score
 * grid, neither of which is a model dimension) so the loss of clearance is
 * smaller than the loss of gap. What is left is partial EDGE overlap on the two
 * tightest pairs, around 0.6 units each, where before there was none: an
 * occluder clipping the edge of its neighbour rather than sitting across it.
 * That is a different thing from the rail that used to run through the middle of
 * three stations, and it is the trade this spacing now makes.
 *
 * TWO THINGS BUY THE REST. A close-up stands only a few units back, so anything
 * more than `distance / cos(theta)` upstream falls BEHIND the camera and stops
 * mattering entirely: that is what lets `add2` sit 7.6 units from an MLP that is
 * 17.5 wide and would otherwise swamp it. And an occluder SMALLER than its
 * subject is tolerated on purpose, because a 0.16 tall norm bar silhouetted
 * against the MLP's grid costs nothing and says where the two sit relative to
 * each other.
 *
 * The consequence is a station span near 50 units, which is most of the length
 * of the whole 28 block stack. That is not a bug and not a scale that was
 * chosen: it is what an exploded view of an object whose largest part holds 88%
 * of its mass has to look like.
 */
const STATION_SEQUENCE: ReadonlyArray<readonly [string, number]> = [
  ["ln1", 2.6],
  ["qkv", 4.5],
  ["rope", 3.4],
  ["heads", 3.4],
  ["scores", 3.4],
  ["out", 2.6],
  ["add1", 2.6],
  ["ln2", 3.5],
  // Downstream of the MLP you are looking THROUGH it, and it is the one station
  // wider than its neighbours, so the lateral criterion binds here rather than
  // being waived: half width 3.5 against the junction's 0.75 needs 4.25 of
  // throw, i.e. 5.93 units. This was 15 when the intermediate axis was drawn to
  // scale and `gate` was 17.5 wide; the elision that shrank it to 7.0 gives
  // half the block's length back.
  ["mlp", 5.6],
  ["add2", 0],
];

/**
 * Station centres along Z, centred on the block's origin.
 *
 * Upstream is +Z, so `ln1` is nearest the default camera and `add2` furthest,
 * and the dataflow runs away from the viewer. That is the same sign convention
 * the stack itself uses, and it is why every station's downstream neighbours
 * stay visible BEHIND it in a close-up: you are always looking along the
 * pipeline in the direction the data travels.
 */
const STATION_Z: Readonly<Record<string, number>> = (() => {
  const out: Record<string, number> = {};
  let z = 0;
  for (const [id, gap] of STATION_SEQUENCE) {
    out[id] = z;
    z -= gap;
  }
  // `z` has run past the last station by its own zero gap, so the span is the
  // distance from the first station to the last.
  const span = -out[STATION_SEQUENCE[STATION_SEQUENCE.length - 1][0]];
  for (const id of Object.keys(out)) out[id] += span / 2;
  return Object.freeze(out);
})();

/**
 * Clearance between the end stations and the plates pushed aside to make room.
 *
 * Sized off where the CAMERA ends up, not off where the geometry ends. The first
 * station is a norm, which is small, so its shot is taken from about 7 units
 * back, which puts the camera 27 units out from the block's centre: at a margin
 * of 3.6 that was inside the plate field, and the shot came out as a wall of
 * plates filling the left half of the frame with the subject small beside it.
 * Five is the tightest that still works, and it was eight. At the first
 * station's own shot the camera stands about 33 units out and the nearest plate
 * needs 3.6 of lateral throw to clear the norm's silhouette; five units of
 * margin gives 3.98 and four gives 3.26, which overlaps. Closer than this and
 * the stack starts standing in front of the thing you asked to look at.
 */
const BLOCK_END_MARGIN = 5;

/**
 * Where each station sits along Z inside the open block, input first.
 *
 * Ordered exactly as the dataflow runs: normalise, attend, add back, normalise
 * again, mix, add back. The two adds are what make the residual stream a stream
 * rather than a chain, so they get their own stations instead of being implied.
 *
 * `attn` is the CENTRE of its five sub-stations rather than a place of its own,
 * so focusing "Attention" frames exactly the five and nothing has to be kept in
 * step by hand.
 */
export const STATIONS = Object.freeze({
  ln1: STATION_Z.ln1,
  attn: (STATION_Z.qkv + STATION_Z.out) / 2,
  add1: STATION_Z.add1,
  ln2: STATION_Z.ln2,
  mlp: STATION_Z.mlp,
  add2: STATION_Z.add2,
});

/** Sub-stations inside attention, local to its group, input first. Derived from
 *  the same sequence as everything else, so attention cannot drift out of step
 *  with the stations either side of it. */
export const ATTN_STATIONS = Object.freeze({
  /** The three weight matrices. Where GQA becomes visible. */
  qkv: STATION_Z.qkv - STATIONS.attn,
  /** Rotation applied to Q and K on the way in. Sits between the projections
   *  and the head split because that is where it happens. */
  rope: STATION_Z.rope - STATIONS.attn,
  /** Their outputs, split into heads. */
  heads: STATION_Z.heads - STATIONS.attn,
  /** Q dot K transpose, masked. */
  scores: STATION_Z.scores - STATIONS.attn,
  /** Heads recombined and mixed back to the stream's width. */
  out: STATION_Z.out - STATIONS.attn,
});

/** Z depth attention spreads over, i.e. the run from the projections to the
 *  output projection. */
export const ATTN_DEPTH = ATTN_STATIONS.qkv - ATTN_STATIONS.out;

/** Z extent the hero block occupies once it opens up. Everything else on the
 *  stack is pushed outward to make room, which is the "blooming open" motion. */
export const EXPLODED_DEPTH =
  STATION_Z.ln1 - STATION_Z.add2 + BLOCK_END_MARGIN * 2;

/** How far each side of the stack is pushed out by a fully open block. */
export const EXPLOSION_GAP = (EXPLODED_DEPTH - BLOCK_PITCH) / 2;

/**
 * Z of block `i` when `focused` is the hero. The focused block is always at the
 * origin and the stack slides underneath it.
 *
 * `open` is a FRACTION, not a flag, and that is what makes opening a block an
 * animation rather than a jump. At 0 the stack is a solid run at `BLOCK_PITCH`;
 * at 1 the hero's neighbours have been pushed the full `EXPLOSION_GAP` aside.
 * Everything between is a frame of the bloom.
 *
 * The sign matters. Block 0 sits at POSITIVE z, nearest the default camera, and
 * later blocks recede away from it. So the model runs left to right and into
 * the distance, which is both reading order and the direction the fly-through
 * travels. Flipping this reverses the dataflow on screen.
 */
export function blockZ(i: number, focused: number, open = 1): number {
  const d = focused - i;
  if (d === 0) return 0;
  return d * BLOCK_PITCH + Math.sign(d) * EXPLOSION_GAP * open;
}

/**
 * Where the stack starts and ends along Z, so the residual stream knows how long
 * to be and the two ends know how far out to stand.
 *
 * THE OPEN HERO'S OWN REACH COUNTS, and leaving it out broke the first and last
 * blocks specifically. This used to return the min and max of the block CENTRES,
 * which is right whenever the hero has neighbours on both sides: they are pushed
 * `EXPLOSION_GAP` aside and end up further out than the hero's own stations. At
 * layer 0 there is nothing on one side, so the max centre was the hero itself at
 * z = 0, the embedding wall was placed 5 units from that, and the block's own
 * stations reach about 25 units past it. The wall ended up standing in the
 * middle of the exploded view. Layer 27 did the same thing at the other end.
 *
 * The hero sits at the origin by construction, so its reach is simply half its
 * exploded depth, scaled by how far open it is.
 */
export function stackZRange(focused: number, open = 1): [number, number] {
  const first = blockZ(0, focused, open);
  const last = blockZ(CONFIG.numHiddenLayers - 1, focused, open);
  const reach = (EXPLODED_DEPTH / 2) * open;
  return [
    Math.min(first, last, -reach),
    Math.max(first, last, reach),
  ];
}

/** Naming and ordering of stations lives in `glossary.ts`, with the poses, so
 *  there is one list to keep in step with the index rather than two. */

// -------------------------------------------------------------- the ends

/**
 * How far past the last block the wall and the final norm stand.
 *
 * EXPORTED SO ONE NUMBER SERVES BOTH FILES. `stack.tsx` placed the wall at 4.5
 * while `residual.tsx` overshot the stack by its own `PAD` of 1.6, leaving a 2.9
 * unit air gap between the end of the stream and the wall it is supposed to flow
 * out of. Two constants that had to agree and no mechanism making them.
 *
 * Five, not the 3.2 this started at: with the wall, the logits, the return's
 * terminus and the feed stub all now gathered at the input end, 3.2 put the wall
 * hard against the first plate and the whole cluster read as part of the stack.
 * Everything at that end needs room from the stack, not just from each other.
 */
export const END_GAP = 5.0;

/** How far past the wall the logits stand. At the overview azimuth the wall's
 *  1.5 half width and the logits' 1.125 need 2.63 of lateral throw, i.e. 3.51
 *  units; 4.5 leaves a margin, 4.0 leaves none. */
export const LOGITS_GAP = 5.5;

/** How far upstream of a junction the block's output arrives on the branch, so
 *  the merge leans in rather than dropping vertically. Shared, because the
 *  branch rail has to stop exactly there and not overhang past it. */
export const JUNCTION_RUN = 1.6;

/**
 * Both ends of the model sit this far past the outermost block.
 *
 * The lookup at one end and the projection at the other, in reading order. They
 * are the same 233M tensor, tied, and that is recorded where it belongs: the LM
 * head carries `params: 0` and `tiedTo: "embed"` in `model.ts`, so the total is
 * 1.54B and not the 1.78B you get by counting it twice.
 *
 * Drawing it as a LOOP instead, with one wall and a return path underneath, was
 * tried and reverted. It is true about memory and it wrecks the reading: both
 * ends of the model end up crowded at the near end of the stack with nothing but
 * a norm at the far one.
 */

/**
 * Where the KV cache stands, off to one side of the model.
 *
 * IT USED TO SIT ON THE ORIGIN, which was invisible while focusing something
 * hid everything else and became a mess the moment it did not: the residual
 * stream runs through the origin at y = 0, so the cache was drawn with a bright
 * conduit through the middle of it and the plate field behind.
 *
 * Standing it beside the stack is also the more honest placement. The cache is
 * the one thing in the piece that is neither a weight nor an activation: it is
 * what survives BETWEEN forward passes, so it belongs next to the model rather
 * than in the line of it, with the stack visible alongside to say whose cache
 * it is.
 */
export const KV_ORIGIN: readonly [number, number, number] = [14, 4.2, 0];

/**
 * How big the score grid is drawn.
 *
 * Both its axes are sequence length, which is a runtime property and not a
 * model dimension, so `widthFor` does not apply and this is a chosen size like
 * `SEQ_HEIGHT`. Every width that IS a model dimension stays proportional.
 */
export const SCORES_SIZE = 2.3;

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

/** Below this much bloom the block counts as shut, so the hero gets its plate
 *  back at the end of the closing animation rather than at the start of it. */
export const OPEN_EPSILON = 0.02;

export function tierFor(i: number, focused: number, open = 1): Tier {
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
  if (open <= OPEN_EPSILON) return "plate";
  const d = Math.abs(i - focused);
  if (d === 0) return "exploded";
  if (d <= SOLID_RADIUS) return "solid";
  return "plate";
}

// ------------------------------------------------- widths worth naming once

export const WIDTHS = Object.freeze({
  stream: STREAM_WIDTH,
  /** DRAWN width, not true width. See `INTERMEDIATE_DRAWN`. */
  intermediate: INTERMEDIATE_DRAWN,
  intermediateTrue: INTERMEDIATE_TRUE,
  head: widthFor(DERIVED.headDim),
  kv: widthFor(DERIVED.kvDim),
  /** What the vocabulary axis WOULD be, unelided. Kept so the elision can say
   *  by how much it is cheating. */
  vocabTrue: widthFor(CONFIG.vocabSize),
});

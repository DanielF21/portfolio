/**
 * The index: every named thing you can click, and where the camera goes.
 *
 * SCOPE PATHS. An entry's id is a dotted path. Focus selects a subtree of the
 * scene, and what that selection now does is FRAME and MARK it. It does not
 * remove anything.
 *
 * That is a reversal, and it is worth saying why the old rule existed. Every
 * tensor face in this scene points along ±Z, which is also the axis the
 * stations are strung along, so a camera square on to any one face looks
 * straight down the line at everything upstream of it. Hiding the siblings made
 * each station legible on its own and made the piece useless: an RMSNorm alone
 * in a void is a bar on a stick, and a score grid alone is a staircase belonging
 * to nothing. Somebody who already knows what a transformer is could read it.
 * Nobody else could.
 *
 * What replaces it is the geometry doing the work instead of the renderer. The
 * stations are spaced so that a camera standing off the axis separates them (see
 * `STATION_SEQUENCE` in `layout.ts` for that arithmetic), and every in-block
 * pose below therefore uses the same off-axis azimuth. The cost is that faces
 * are seen at about 70% of their true width; since foreshortening is a uniform
 * scale along one axis, every ratio the piece claims to show survives it, which
 * is the only property that mattered.
 *
 * Paths match `model.ts` node ids wherever a node exists, so the inspector can
 * look up the real shape and parameter count for whatever is focused.
 *
 * This file must never import `three`.
 */


/**
 * The editorial half of a camera pose.
 *
 * Angle and field of view only. WHERE to stand and HOW FAR BACK are measured
 * from what is actually in scope, by `auto-frame` inside the render layer, so
 * they cannot go stale when the geometry moves. What is left here is the part
 * that is a judgement rather than an arithmetic: which side to look from, and
 * how much of the frame the subject should occupy.
 */
export interface View {
  readonly theta: number;
  readonly phi: number;
  readonly fov: number;
  /** Fraction of the frame the subject fills. Around 0.8 for a portrait of one
   *  thing; lower where neighbouring context is part of the reading. */
  readonly fill: number;
}

export interface IndexEntry {
  /**
   * Dotted scope path, and a `model.ts` node id.
   *
   * THE TWO ARE THE SAME STRING ON PURPOSE, for every entry but the overview.
   * It is what lets hovering an index row raise the same card that hovering the
   * geometry does, with no table mapping one to the other. `block.attn.qkv` and
   * `block.attn.heads` were added to the graph rather than mapped around, and
   * this entry is `block.attn.o` rather than `.out` for the same reason.
   *
   * The overview is the exception and has no node, because it is not a thing in
   * the model: it is all of them. Nothing in the scene answers "the stack"
   * either, so hovering it raises no card, which is the truth.
   */
  readonly id: string;
  readonly label: string;
  /** Nesting depth for the panel's indent. */
  readonly depth: number;
  readonly view: View;
}

export const OVERVIEW_ID = "stack";

/** Square on, dead ahead. */
const SQUARE = Math.PI / 2;

/**
 * The azimuth every in-block shot is taken from.
 *
 * ONE ANGLE, USED EVERYWHERE INSIDE THE BLOCK, and that is deliberate. The
 * station spacing in `layout.ts` is solved for this number: an occluder `u`
 * units upstream is thrown `u * sin(theta)` sideways, and at 0.8 radians that is
 * 0.72 of the gap. Authoring a different azimuth per station would silently
 * invalidate the spacing for that one shot, which is exactly the class of bug
 * that made the old hand-tuned camera distances unmaintainable.
 *
 * It is also why nothing here is square on any more. A square view is a view
 * straight down the line of stations, which is the one direction that cannot
 * work now that the neighbours stay drawn.
 */
const IN_BLOCK = 0.8;

export const INDEX: readonly IndexEntry[] = [
  {
    id: OVERVIEW_ID,
    label: "The stack",
    depth: 0,
    // A long lens from far back, which is what a photographer does to a row of
    // columns: at a normal 45 degree fov the near end of a 28 block stack is
    // more than twice as close as the far end and the blocks stop reading as
    // identical.
    //
    // Theta is set from the frame rather than by eye. The model is roughly
    // 4.2 x 5.5 x 52, and its projected aspect at angle t is
    // (4.2|cos t| + 52|sin t|) : (5.5 sin p + 52|cos t| cos p). At the old 0.62
    // that comes out near 1.5:1 inside a 2.1:1 viewport, so the stack ran
    // diagonally corner to corner and left both other corners empty. 0.85 puts
    // it at almost exactly 2:1, which is the shape of the hole it has to fill.
    //
    // FILL IS HIGH BECAUSE THE SUBJECT IS A DIAGONAL. `fill` is a fraction of
    // the frame the bounding BOX occupies, and a 44 unit run seen at 0.85
    // radians puts its ink along the box's diagonal with both off-diagonal
    // corners empty. At 0.88 the box was correctly framed and the model itself
    // covered less than half the frame. Nothing here is clipped at 0.96; the
    // embedding wall is the near corner and it is the thing to check if this
    // moves again.
    view: { theta: 0.85, phi: 1.16, fov: 24, fill: 0.96 },
  },

  {
    id: "block",
    // Not "One block". The unit has a name and this is it; a reader who has met
    // the word anywhere else should find the same word here.
    label: "Transformer block",
    depth: 0,
    // The whole exploded run, about 50 units of it, with the plates it was
    // pushed out of receding at either end.
    //
    // PHI IS SET FROM THE FRAME, not by eye, the same way the overview's theta
    // is. The block projects 17.5 x 20 x 53, and at the tipped-above-level 1.14
    // this started at, its projected box is 50 x 39, which is 1.29:1 inside a
    // viewport nearer 2:1 and leaves both the top left and bottom right corners
    // empty. Near level the 53 unit run stops contributing to screen HEIGHT and
    // the same box projects 50 x 28, which is 1.79:1. Every slab in a block is
    // upright, so nothing loses its face by the camera coming down to meet it.
    // Same diagonal-ink reason the overview's fill is high; see there. Backed
    // off from 0.94, where `down` touched the top of the frame: its 17.5 units
    // are the block's whole height and it sits at the far end, so it is the
    // first thing to clip.
    view: { theta: IN_BLOCK, phi: 1.36, fov: 30, fill: 0.88 },
  },
  {
    id: "block.ln1",
    label: "RMSNorm · pre-attention",
    depth: 1,
    // FILL IS LOW ON PURPOSE HERE, and on every other small station.
    //
    // A 3.0 x 0.16 bar filling 0.72 of the frame is the shot that made this
    // station read as "some T shaped thing": at that distance the bar and the
    // tap under it are the only two objects on screen. Standing back to 0.4
    // costs nothing legible (the bar is a bar at any size) and buys the entire
    // reason it is where it is, which is the projections waiting behind it.
    view: { theta: IN_BLOCK, phi: 1.24, fov: 34, fill: 0.4 },
  },

  {
    id: "block.attn",
    label: "Attention",
    depth: 1,
    view: { theta: IN_BLOCK, phi: 1.18, fov: 34, fill: 0.8 },
  },
  {
    id: "block.attn.qkv",
    label: "Q, K, V projections",
    depth: 2,
    // The three plates sit side by side on one level and their WIDTHS are the
    // entire point. This used to be shot square on to protect that comparison,
    // which was over-careful: foreshortening along one axis scales all three
    // widths by the same factor, so the 6:1 that GQA is about survives it
    // exactly. What a square view does not survive is the rest of the block
    // being drawn.
    view: { theta: IN_BLOCK, phi: 1.3, fov: 34, fill: 0.6 },
  },
  {
    id: "block.attn.rope",
    label: "RoPE",
    depth: 2,
    // Nearly level, because every needle's angle is the reading and tipping the
    // camera above the dial faces turns circles into ellipses.
    view: { theta: IN_BLOCK, phi: 1.46, fov: 34, fill: 0.52 },
  },
  {
    id: "block.attn.heads",
    label: "Heads, and GQA",
    depth: 2,
    // Slightly above, so the six-to-one fan is seen as a fan rather than edge
    // on with the ribbons collapsed into lines.
    view: { theta: IN_BLOCK, phi: 1.34, fov: 34, fill: 0.5 },
  },
  {
    id: "block.attn.scores",
    label: "Scores, and the mask",
    depth: 2,
    // Level, so the staircase descends the frame the way the tokens arrive.
    // The horizontal foreshortening leaves a triangle a triangle.
    view: { theta: IN_BLOCK, phi: 1.5, fov: 34, fill: 0.54 },
  },
  {
    id: "block.attn.o",
    label: "Output projection",
    depth: 2,
    view: { theta: IN_BLOCK, phi: 1.38, fov: 34, fill: 0.56 },
  },

  {
    id: "block.add1",
    label: "Residual add · attention",
    depth: 1,
    view: { theta: IN_BLOCK, phi: 1.28, fov: 34, fill: 0.42 },
  },
  {
    id: "block.ln2",
    label: "RMSNorm · pre-MLP",
    depth: 1,
    view: { theta: IN_BLOCK, phi: 1.24, fov: 34, fill: 0.4 },
  },
  {
    id: "block.mlp",
    label: "SwiGLU MLP",
    depth: 1,
    // The shot the whole proportional rule pays for: gate and up are 17.5 wide,
    // down is 17.5 tall, all three hold 13,762,560 parameters and all three come
    // out the same area. Filled less than full so the norm that feeds it and the
    // add that receives it are both still in frame.
    view: { theta: IN_BLOCK, phi: 1.26, fov: 34, fill: 0.74 },
  },
  {
    id: "block.add2",
    label: "Residual add · MLP",
    depth: 1,
    // Filled tighter than its twin, and that is the second half of the same fix
    // as the 15 unit gap before it: the further back this camera stands, the
    // more of the MLP ends up in front of it. Close in, the MLP is behind the
    // camera and what is left in frame is the stream, the junction and the next
    // block, which is what this station is about.
    view: { theta: IN_BLOCK, phi: 1.28, fov: 34, fill: 0.68 },
  },

  {
    id: "kv",
    label: "KV cache",
    depth: 0,
    // Nearly square on, because the cache is a grid of layers by tokens and both
    // axes are being counted. It can afford that where a station cannot: the
    // cache stands off to one side of the model (`KV_ORIGIN`) rather than in the
    // line of it, so looking straight at it does not mean looking through
    // anything. The small azimuth keeps the stack itself in frame beside it.
    view: { theta: 0.22, phi: SQUARE, fov: 40, fill: 0.8 },
  },
];

const BY_ID = new Map(INDEX.map((e) => [e.id, e]));

export function entryById(id: string): IndexEntry | undefined {
  return BY_ID.get(id);
}

/**
 * Whether a thing at `path` is part of what is currently being looked at.
 *
 * This is what the camera measures and what the focus marker brackets. It is
 * NOT a visibility test any more: nothing in the scene is removed by focusing,
 * which is the whole point of the current design. The replaced function was
 * called `visibleUnder` and returned true for ancestors as well, because an
 * ancestor had to stay mounted for its descendant to be drawn at all. Nothing
 * needs that now, and including ancestors here would be actively wrong: the
 * `block` scope contains every station, so measuring it while focused on one
 * station would frame all forty-one units of the block.
 */
export function inFocus(focus: string | null, path: string): boolean {
  if (focus === null || focus === OVERVIEW_ID) return true;
  return isPrefix(focus, path);
}

/** True when `a` is `b` or a dotted ancestor of it. Compares segments, so
 *  "block.add1" is not treated as a prefix of "block.add2". */
function isPrefix(a: string, b: string): boolean {
  return a === b || b.startsWith(`${a}.`);
}

/**
 * The index: every named thing you can click, and where the camera goes.
 *
 * SCOPE PATHS. An entry's id is a dotted path, and visibility follows one rule:
 * while `focus` is set, a thing is drawn when its path is a prefix of the focus
 * or the focus is a prefix of its path. Ancestors and descendants stay,
 * siblings go. `block.attn.scores` therefore leaves the score grid and its
 * container, and removes the projections, the head split, the MLP, both norms
 * and the rest of the stack.
 *
 * That rule is not a convenience. The stations sit in a line along Z, so a
 * square view of any one of them looks straight down that line at everything
 * upstream, and the comparisons that matter most (the Q against K and V, the
 * causal mask) are exactly the ones that need a square view.
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
  /** Dotted scope path. Doubles as a `model.ts` node id where one exists. */
  readonly id: string;
  readonly label: string;
  /** Nesting depth for the panel's indent. */
  readonly depth: number;
  readonly view: View;
}

export const OVERVIEW_ID = "stack";

/** Square on, dead ahead. */
const SQUARE = Math.PI / 2;

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
    view: { theta: 0.85, phi: 1.16, fov: 24, fill: 0.88 },
  },

  {
    id: "block",
    label: "One block",
    depth: 0,
    // Tipped above level so the MLP's wide plates do not present their edge.
    view: { theta: 0.55, phi: 1.1, fov: 34, fill: 0.8 },
  },
  {
    id: "block.ln1",
    label: "RMSNorm",
    depth: 1,
    // Oblique, because it is a floored slab: seen square on, a bar drawn at
    // MIN_AXIS is a line, and the outline marking it as not-to-scale is the
    // thing worth seeing.
    view: { theta: 0.5, phi: 1.25, fov: 38, fill: 0.72 },
  },

  {
    id: "block.attn",
    label: "Attention",
    depth: 1,
    view: { theta: 0.3, phi: 1.2, fov: 38, fill: 0.85 },
  },
  {
    id: "block.attn.qkv",
    label: "Q, K, V projections",
    depth: 2,
    // Square on, and it has to be. The three plates are stacked vertically and
    // their widths are the entire point; any oblique angle foreshortens the one
    // comparison this view exists to make.
    view: { theta: 0.06, phi: SQUARE, fov: 38, fill: 0.86 },
  },
  {
    id: "block.attn.rope",
    label: "RoPE",
    depth: 2,
    // Square on. Every needle's angle is the reading, and an angle seen at a
    // slant is a different angle.
    view: { theta: 0, phi: SQUARE, fov: 40, fill: 0.82 },
  },
  {
    id: "block.attn.heads",
    label: "Heads, and GQA",
    depth: 2,
    // Slightly above, so the six-to-one fan is seen as a fan rather than edge
    // on with the ribbons collapsed into lines.
    view: { theta: 0.05, phi: 1.34, fov: 40, fill: 0.82 },
  },
  {
    id: "block.attn.scores",
    label: "Scores, and the mask",
    depth: 2,
    // Dead square. The staircase is only a staircase from directly in front.
    view: { theta: 0, phi: SQUARE, fov: 40, fill: 0.86 },
  },
  {
    id: "block.attn.out",
    label: "Output projection",
    depth: 2,
    view: { theta: 0.12, phi: 1.5, fov: 38, fill: 0.8 },
  },

  {
    id: "block.add1",
    label: "Residual add",
    depth: 1,
    view: { theta: 0.55, phi: 1.3, fov: 40, fill: 0.7 },
  },
  {
    id: "block.ln2",
    label: "RMSNorm",
    depth: 1,
    view: { theta: 0.5, phi: 1.25, fov: 38, fill: 0.72 },
  },
  {
    id: "block.mlp",
    label: "SwiGLU MLP",
    depth: 1,
    // Nearly square on, and this is the shot the whole proportional rule pays
    // for: gate and up are 17.5 wide, down is 17.5 tall, and the station is a
    // square. Any real angle sends a 17.5 unit object diagonally out of frame.
    view: { theta: 0.16, phi: 1.34, fov: 40, fill: 0.8 },
  },
  {
    id: "block.add2",
    label: "Residual add",
    depth: 1,
    view: { theta: 0.55, phi: 1.3, fov: 40, fill: 0.7 },
  },

  {
    id: "kv",
    label: "KV cache",
    depth: 0,
    // Square on. The cache is a grid of layers by tokens and both axes are
    // being counted, so any perspective on it makes the counting harder.
    view: { theta: 0, phi: SQUARE, fov: 40, fill: 0.84 },
  },
];

const BY_ID = new Map(INDEX.map((e) => [e.id, e]));

export function entryById(id: string): IndexEntry | undefined {
  return BY_ID.get(id);
}

/**
 * Whether a thing at `path` is drawn, given the current focus.
 *
 * Ancestors and descendants of the focus survive; everything else is hidden.
 * Null focus draws the whole model.
 */
export function visibleUnder(focus: string | null, path: string): boolean {
  if (focus === null || focus === OVERVIEW_ID) return true;
  return isPrefix(focus, path) || isPrefix(path, focus);
}

/** True when `a` is `b` or a dotted ancestor of it. Compares segments, so
 *  "block.add1" is not treated as a prefix of "block.add2". */
function isPrefix(a: string, b: string): boolean {
  return a === b || b.startsWith(`${a}.`);
}

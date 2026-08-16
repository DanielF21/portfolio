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
    // identical. Filled loosely, because the whole point of the shot is that
    // the model keeps going.
    view: { theta: 0.62, phi: 1.15, fov: 24, fill: 0.82 },
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

/**
 * How prominently a thing is drawn, given the current focus.
 *
 * Three states rather than `visibleUnder`'s two, because the instrument-panel
 * register wants context to DIM rather than vanish, and because dimming turns
 * out to be the wrong tool for some of what `visibleUnder` currently hides.
 *
 * The distinction is whether a thing is IN THE WAY or merely elsewhere:
 *
 *   subject   the focus, its ancestors and its descendants. Full brightness.
 *   context   things outside the focused subtree that the camera is not looking
 *             through: other blocks, the ground, the ends of the model. Dimmed,
 *             and clipped upstream of the subject so they read as a section
 *             rather than as objects that faded out.
 *   hidden    siblings sitting directly between the camera and the subject.
 *
 * WHY `context` CANNOT SIMPLY BE OPACITY. At the `block.attn.qkv` pose the
 * camera sits at z ~10.45 looking down -Z, and five block plates sit between it
 * and the subject at z 5.25, 6.35, 7.45, 8.55 and 9.65. Five layers at 35%
 * opacity give 1 - 0.65^5 = 88% coverage, so the subject is behind a wall
 * whatever the alpha. The clipping plane in the render layer is what makes
 * `context` workable; this function only decides who gets it.
 *
 * `visibleUnder` is deliberately left alone. `block.tsx` gates its stream taps
 * on a boolean and is correct as it stands.
 */
export type Emphasis = "subject" | "context" | "hidden";

export function emphasisFor(focus: string | null, path: string): Emphasis {
  if (focus === null || focus === OVERVIEW_ID) return "subject";
  if (isPrefix(focus, path) || isPrefix(path, focus)) return "subject";
  // A sibling INSIDE the focused block shares the block's Z line, so it is the
  // thing the camera has to look through. Everything else is elsewhere.
  return sharesLine(focus, path) ? "hidden" : "context";
}

/** True when two paths sit on the same run of stations, i.e. they share a
 *  parent. Those are the ones that occlude; a different block or the embedding
 *  wall does not. */
function sharesLine(a: string, b: string): boolean {
  const parent = (p: string) => p.slice(0, p.lastIndexOf("."));
  const pa = parent(a);
  return pa !== "" && pa === parent(b);
}

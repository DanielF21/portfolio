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

import { DEFAULT_POSE, type Pose } from "./camera";
import { ATTN_STATIONS, BRANCH_Y, STATIONS } from "./layout";

export interface IndexEntry {
  /** Dotted scope path. Doubles as a `model.ts` node id where one exists. */
  readonly id: string;
  readonly label: string;
  /** Nesting depth for the panel's indent. */
  readonly depth: number;
  readonly pose: Pose;
}

/** World Z of a station on the branch. */
const z = (s: keyof typeof STATIONS) => STATIONS[s];
/** World Z of a sub-station inside attention. */
const az = (s: keyof typeof ATTN_STATIONS) => STATIONS.attn + ATTN_STATIONS[s];

function pose(
  targetZ: number,
  distance: number,
  theta: number,
  phi: number,
  fov: number
): Pose {
  return { target: [0, BRANCH_Y, targetZ], distance, theta, phi, fov };
}

export const OVERVIEW_ID = "stack";

export const INDEX: readonly IndexEntry[] = [
  { id: OVERVIEW_ID, label: "The stack", depth: 0, pose: DEFAULT_POSE },

  {
    id: "block",
    label: "One block",
    depth: 0,
    // Far enough back to hold every station, tipped above level so the MLP
    // does not present its edge.
    pose: pose(0.3, 22, 0.55, 1.1, 34),
  },
  {
    id: "block.ln1",
    label: "RMSNorm",
    depth: 1,
    // A 0.38 unit bar is a line seen square on, so this one is oblique.
    pose: pose(z("ln1"), 4.2, 0.5, 1.25, 38),
  },

  { id: "block.attn", label: "Attention", depth: 1, pose: pose(az("heads"), 9, 0.3, 1.2, 38) },
  {
    id: "block.attn.qkv",
    label: "Q, K, V projections",
    depth: 2,
    // Square on, and it has to be. The three plates are stacked vertically and
    // their widths are the entire point; any oblique angle foreshortens the one
    // comparison this view exists to make.
    pose: pose(az("qkv"), 6.5, 0.06, 1.5708, 38),
  },
  {
    id: "block.attn.rope",
    label: "RoPE",
    depth: 2,
    // Square on. Every needle's angle is the reading, and an angle seen at a
    // slant is a different angle.
    pose: pose(az("rope"), 6.4, 0, 1.5708, 40),
  },
  {
    id: "block.attn.heads",
    label: "Heads, and GQA",
    depth: 2,
    // Slightly above, so the six-to-one fan is seen as a fan rather than edge
    // on with the ribbons collapsed into lines.
    pose: pose(az("heads"), 5.4, 0.05, 1.34, 40),
  },
  {
    id: "block.attn.scores",
    label: "Scores, and the mask",
    depth: 2,
    // Dead square. The staircase is only a staircase from directly in front.
    pose: pose(az("scores"), 4.4, 0, 1.5708, 40),
  },
  {
    id: "block.attn.out",
    label: "Output projection",
    depth: 2,
    pose: pose(az("out"), 6.5, 0.12, 1.5, 38),
  },

  {
    id: "block.add1",
    label: "Residual add",
    depth: 1,
    // Aimed low, at the junction itself: the add happens on the stream, not up
    // on the branch where the rest of the stations live.
    pose: { target: [0, BRANCH_Y * 0.45, z("add1")], distance: 6.2, theta: 0.55, phi: 1.3, fov: 40 },
  },
  { id: "block.ln2", label: "RMSNorm", depth: 1, pose: pose(z("ln2"), 4.2, 0.5, 1.25, 38) },
  {
    id: "block.mlp",
    label: "SwiGLU MLP",
    depth: 1,
    // Backed well off and tipped high: 17.5 units across and lying flat, so a
    // level camera sees its edge. Nearly square on as well, because at any real
    // angle a 17.5 unit object runs diagonally out of the frame and takes its
    // labels with it.
    pose: pose(z("mlp"), 17, 0.06, 1.16, 40),
  },
  {
    id: "block.add2",
    label: "Residual add",
    depth: 1,
    pose: { target: [0, BRANCH_Y * 0.45, z("add2")], distance: 6.2, theta: 0.55, phi: 1.3, fov: 40 },
  },

  {
    id: "kv",
    label: "KV cache",
    depth: 0,
    // Square on. The cache is a grid of layers by tokens and both axes are
    // being counted, so any perspective on it makes the counting harder.
    pose: { target: [0, 0, 0], distance: 15, theta: 0, phi: Math.PI / 2, fov: 40 },
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

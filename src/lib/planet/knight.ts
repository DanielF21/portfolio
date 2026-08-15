/**
 * The chess knight, which moves like a knight.
 *
 * It sits alone in a desert with a piano and a pavilion, and the joke only
 * lands if it does the one thing a knight does. So pressing E sends it two
 * squares one way and one square the other, in an arc, onto a board that is
 * not drawn.
 *
 * The board is authored in squares around the piece's SCENERY anchor and laid
 * on the sphere with `placeOnSphere`, the same call the scenery layout itself
 * uses. It is deliberately small, two squares of reach, so the knight wanders a
 * patch of sand rather than emigrating.
 *
 * This file must never import `three`.
 */

import { placeOnSphere, type Dir } from "./layout";

/** Square size, world units. Wide enough that a move reads as a move at the
 *  distance the camera sits. */
const SQUARE = 1.35;

/** The eight legal knight moves, in squares. */
const MOVES: readonly (readonly [number, number])[] = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];

/** How far from the anchor the piece may wander, in squares. Kept inside the
 *  island and clear of the pavilion. */
const BOUND = 2;

/** Seconds for one hop. */
export const HOP_S = 0.55;

export const knight = {
  /** Current square, in board coordinates. */
  col: 0,
  row: 0,
  /** Square it left, for the interpolation. */
  fromCol: 0,
  fromRow: 0,
  /** Clock time the hop started, or -1e9 when at rest. */
  startedAt: -1e9,
  /** Which move to try next. Cycling rather than random keeps it deterministic
   *  between sessions and stops it doubling back on itself immediately. */
  next: 0,
};

/** True while a hop is in flight, so a second press cannot interrupt it. */
export function knightHopping(now: number): boolean {
  return now - knight.startedAt < HOP_S;
}

/**
 * Send it to the next square. Returns false if it is already moving.
 *
 * Tries each move in turn until one lands on the board, so it can never walk
 * off the edge and never has to reject a press for want of a legal square.
 */
export function moveKnight(now: number): boolean {
  if (knightHopping(now)) return false;

  for (let i = 0; i < MOVES.length; i++) {
    const [dc, dr] = MOVES[(knight.next + i) % MOVES.length];
    const col = knight.col + dc;
    const row = knight.row + dr;
    if (Math.abs(col) > BOUND || Math.abs(row) > BOUND) continue;

    knight.fromCol = knight.col;
    knight.fromRow = knight.row;
    knight.col = col;
    knight.row = row;
    knight.next = (knight.next + i + 1) % MOVES.length;
    knight.startedAt = now;
    return true;
  }
  return false;
}

/**
 * Where the piece is, as a direction on the sphere plus a height above it.
 *
 * Expressed through `placeOnSphere` rather than as a tangent offset, because
 * TWO things need this and they must not disagree: the renderer draws the piece
 * here, and the interactable puts its prompt here. A prompt anchored to the
 * square the knight started on would drift a hop behind the piece and end up
 * offering itself over empty sand.
 *
 * The hop is a sine arc rather than a parabola, purely because a knight's move
 * is drawn as an arc and that is the shape people expect from the piece.
 */
export function knightAt(
  anchor: Dir,
  radius: number,
  now: number
): { dir: Dir; lift: number } {
  const t = Math.min(1, Math.max(0, (now - knight.startedAt) / HOP_S));
  // Ease in and out, so the piece leaves and arrives without a jerk.
  const e = t * t * (3 - 2 * t);
  const col = knight.fromCol + (knight.col - knight.fromCol) * e;
  const row = knight.fromRow + (knight.row - knight.fromRow) * e;
  return {
    dir: square(anchor, radius, col, row),
    lift: Math.sin(t * Math.PI) * 0.8,
  };
}

/** Where it will be when it lands, for anything that has no clock to hand. */
export function knightSquare(anchor: Dir, radius: number): Dir {
  return square(anchor, radius, knight.col, knight.row);
}

function square(anchor: Dir, radius: number, col: number, row: number): Dir {
  const dist = Math.hypot(col, row) * SQUARE;
  if (dist < 1e-6) return anchor;
  // Bearing measured from the board's own axes. Which way is "north" here does
  // not matter, only that the renderer and the prompt agree, which they do by
  // both arriving through this function.
  return placeOnSphere(anchor, Math.atan2(col, row), dist / radius);
}

/** Back to the middle of its board on leaving the stage. */
export function resetKnight() {
  knight.col = knight.row = knight.fromCol = knight.fromRow = 0;
  knight.startedAt = -1e9;
  knight.next = 0;
}

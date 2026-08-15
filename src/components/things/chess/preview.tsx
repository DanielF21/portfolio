"use client";

import { Chess } from "chess.js";
import { useEffect, useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";

/**
 * The ambient preview: a canned game replaying itself, one move at a time.
 *
 * Pure client. It never touches the bot API. Decoration on an index page should
 * not depend on a backend being reachable, and a tile that called it every time
 * someone scrolled past would put real load on the engine for no benefit. Keep
 * it that way even though the service is always on now.
 *
 * Input-free by construction: pieces are not draggable and there is no drop
 * handler. A preview is not the toy.
 */

/** A short, decisive game. Any legal SAN sequence works here. */
const MOVES = [
  "e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "b4", "Bxb4", "c3", "Ba5",
  "d4", "exd4", "O-O", "d3", "Qb3", "Qf6", "e5", "Qg6", "Re1", "Nge7",
  "Ba3", "b5", "Qxb5", "Rb8", "Qa4", "Bb6", "Nbd2", "Bb7", "Ne4", "Qf5",
];

const MOVE_MS = 1200;
const RESTART_MS = 2600;

export default function ChessPreview() {
  const [ply, setPly] = useState(0);

  const fen = useMemo(() => {
    const game = new Chess();
    for (let i = 0; i < ply; i++) {
      try {
        game.move(MOVES[i]);
      } catch {
        break;
      }
    }
    return game.fen();
  }, [ply]);

  useEffect(() => {
    const done = ply >= MOVES.length;
    const t = setTimeout(
      () => setPly((p) => (p >= MOVES.length ? 0 : p + 1)),
      done ? RESTART_MS : MOVE_MS
    );
    return () => clearTimeout(t);
  }, [ply]);

  return (
    <div
      aria-hidden
      className="flex h-full w-full items-center justify-center bg-[#f0d9b5] p-2"
    >
      <div className="aspect-square h-full max-h-full">
        <Chessboard
          position={fen}
          arePiecesDraggable={false}
          animationDuration={350}
          customBoardStyle={{ borderRadius: "0.25rem" }}
        />
      </div>
    </div>
  );
}

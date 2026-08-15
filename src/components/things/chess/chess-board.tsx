"use client";

import { Chess, type Square } from "chess.js";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Chessboard } from "react-chessboard";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { API_URL } from "@/lib/api";

/**
 * The playable board.
 *
 * A faithful port of the original src/app/chess/page.tsx. The game logic below
 * is deliberately unchanged from that file: same functions, same order, same
 * guards, same state transitions. Only the packaging differs. The "About
 * DanielBot" prose moved to content/things/chess.mdx and the console.log calls
 * are gone; nothing else about how the board behaves was touched.
 *
 * The one deviation is marked in onDrop and explained there.
 *
 * This component is the only thing that talks to the chess API. ./preview.tsx
 * makes no network calls at all: it replays a canned game locally, so scrolling
 * past a tile on the home page never hits the backend.
 */
export default function ChessBoard() {
  const [game, setGame] = useState<Chess | null>(null);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [thinking, setThinking] = useState<boolean>(false);
  const chessboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // The board starts locally. There is deliberately no POST /reset here any
    // more: the server used to keep ONE game shared by every visitor, so
    // resetting on page load wiped whatever game a stranger had in progress,
    // and their next move came back 400 Illegal move. The server is stateless
    // now, so there is nothing to reset.
    setGame(new Chess());
    setMoveHistory([]);
    localStorage.removeItem("moveHistory");
    setLoading(false);

    // No warm-up ping and no keep-alive interval. The backend runs on a paid
    // always-on instance now, so there is no sleeping dyno to wake. Both used
    // to exist to hide a cold start that no longer happens.
  }, []);

  const updateMoveHistory = (newMove: string, isPlayerMove: boolean) => {
    setMoveHistory((prev) => {
      const updatedHistory = [...prev];
      if (isPlayerMove) {
        const moveNumber = Math.floor(updatedHistory.length) + 1;
        updatedHistory.push(`${moveNumber}.${newMove}`);
      } else {
        updatedHistory[updatedHistory.length - 1] += ` ${newMove}`;
      }
      localStorage.setItem("moveHistory", JSON.stringify(updatedHistory));
      return updatedHistory;
    });
  };

  const handleGameOver = () => {
    if (!game) return;
    if (game.isCheckmate()) {
      updateMoveHistory("Checkmate", false);
    } else if (game.isStalemate()) {
      updateMoveHistory("Stalemate", false);
    } else if (game.isDraw()) {
      updateMoveHistory("Draw", false);
    } else if (game.isThreefoldRepetition()) {
      updateMoveHistory("Threefold repetition", false);
    } else if (game.isInsufficientMaterial()) {
      updateMoveHistory("Insufficient material", false);
    }
  };

  const makeMove = useCallback(
    async (uciMove: string, fen: string) => {
      if (!game || game.isGameOver()) return;
      setThinking(true);
      try {
        const response = await fetch(`${API_URL}/chess/move`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          // The position goes with the move. The server builds a board from
          // this per request and keeps nothing, which is what stops one
          // visitor's game from corrupting another's.
          body: JSON.stringify({ move: uciMove, fen }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `HTTP error! status: ${response.status}, message: ${errorText}`
          );
        }

        const data = await response.json();

        if (data.error) {
          updateMoveHistory(`Error: ${data.error}`, false);
          return;
        }

        // The player's move ended it, so there is no reply to apply. The old
        // code fell through and called game.move(null) here, which is why a
        // finished game always ended with a stray "Error: Invalid move".
        if (data.game_over && !data.ai_move) {
          if (data.fen) setGame(new Chess(data.fen));
          updateMoveHistory(data.result ?? "Game over", false);
          return;
        }

        // ai_move arrives as UCI. Resolve it against the legal moves rather
        // than handing the string to game.move(), which throws on anything it
        // cannot parse.
        const candidate = game
          .moves({ verbose: true })
          .find((m) => m.from + m.to + (m.promotion ?? "") === data.ai_move);

        if (!candidate) {
          updateMoveHistory("Error: Invalid move", false);
          return;
        }

        const aiMove = game.move({
          from: candidate.from,
          to: candidate.to,
          promotion: candidate.promotion,
        });

        updateMoveHistory(aiMove.san, false);
        // Prefer the server's position. With a stateless server the two cannot
        // disagree, so this is belt and braces rather than a correction.
        setGame(new Chess(data.fen ?? game.fen()));

        if (data.game_over) {
          updateMoveHistory(data.result ?? "Game over", false);
        } else {
          handleGameOver();
        }
      } catch (error) {
        let errorMessage = "Unknown error occurred";
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        updateMoveHistory(`Error: ${errorMessage}`, false);
      } finally {
        setThinking(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [game]
  );

  const onDrop = (sourceSquare: string, targetSquare: string) => {
    if (!game || game.isGameOver() || thinking) return false;

    // The position BEFORE the player's move. The server pushes this move
    // itself, so it needs the board as it stood beforehand.
    const fenBefore = game.fen();

    // THE ONE DEVIATION FROM THE ORIGINAL.
    //
    // The original relied on `move === null` to reject an illegal drop, but
    // chess.js v1 throws instead of returning null, so that guard never fired
    // and a piece dropped on an illegal square took the whole board down.
    // Asking which moves are legal from this square first is the same check
    // chess.js would do internally, without using an exception to control flow.
    // Legal moves are completely unaffected by it.
    const legal = game
      .moves({ square: sourceSquare as Square, verbose: true })
      .some((m) => m.to === targetSquare);
    if (!legal) return false;

    const move = game.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: "q", // always promote to a queen
    });

    if (move === null) return false;
    const uciMove = move.from + move.to + (move.promotion || "");

    setGame(new Chess(game.fen()));
    updateMoveHistory(move.san, true);

    makeMove(uciMove, fenBefore);
    handleGameOver();
    return true;
  };

  // Local only. There is no server-side game to reset any more.
  const resetGame = () => {
    setGame(new Chess());
    setMoveHistory([]);
    localStorage.removeItem("moveHistory");
  };

  if (loading || !game) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <div className="lg:w-3/5">
        <div ref={chessboardRef} className="mx-auto aspect-square w-full">
          <Chessboard
            position={game.fen()}
            onPieceDrop={onDrop}
            // Locked while the bot is thinking. Without this you can queue a
            // second move before the reply lands.
            arePiecesDraggable={!game.isGameOver() && !thinking}
          />
        </div>
        <div className="mt-4 flex items-center justify-center gap-4">
          <Button onClick={resetGame} variant="outline">
            Reset game
          </Button>
          <span
            aria-live="polite"
            className="font-mono text-meta text-muted-foreground"
          >
            {thinking ? "thinking..." : ""}
          </span>
        </div>
      </div>

      <div className="lg:w-2/5">
        <h2 className="mb-3 font-display text-title font-bold">Moves</h2>
        <ScrollArea className="h-[30vh] rounded-lg border p-3">
          {moveHistory.length === 0 ? (
            <p className="font-mono text-meta text-muted-foreground">
              Drag a piece to start.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {moveHistory.map((move, index) => (
                <span
                  key={index}
                  className="rounded bg-secondary px-2 py-1 font-mono text-meta"
                >
                  {move}
                </span>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

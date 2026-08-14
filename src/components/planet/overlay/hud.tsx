"use client";

import { useEffect, useState } from "react";

import { usePlanetStore } from "@/lib/planet/store";

import { CompassChevrons } from "./compass-chevrons";

/**
 * The in-world overlay.
 *
 * Deliberately thin. The world ships no markers, so the progress counter
 * ("n / 14 visited") and the proximity prompt that used to live here have gone
 * with them; what is left is an exit affordance and the controls hint. The
 * compass renders nothing while there is nothing to point at, and is kept
 * mounted so that adding points of interest later needs no wiring.
 */

interface Props {
  onExit: () => void;
}

export function Hud({ onExit }: Props) {
  const activeId = usePlanetStore((s) => s.activeId);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 text-white">
      <CompassChevrons />

      <button
        type="button"
        onClick={onExit}
        className="pointer-events-auto absolute left-4 top-4 flex items-center gap-2 rounded-lg bg-black/45 px-3 py-2 text-[12px] font-medium text-white/80 backdrop-blur-sm transition hover:bg-black/70 hover:text-white"
      >
        <span aria-hidden>&larr;</span>
        Exit
        <span className="rounded border border-white/25 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-white/50">
          Esc
        </span>
      </button>

      {/* Controls hint. Permanent on purpose: with nothing to collect there is
          no progress state that could justify hiding it, and figuring out the
          controls IS the activity here. */}
      {!activeId && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-4 py-2 text-center text-[11px] text-white/70 backdrop-blur-sm">
          {isTouch
            ? "Stick to walk · push to the rim to sprint · Jump to hop"
            : "WASD to walk · Shift to sprint · Space to jump · drag to look · scroll to zoom"}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

import { promptFor } from "@/lib/planet/interactables";
import { usePlanetStore } from "@/lib/planet/store";

import { CompassChevrons } from "./compass-chevrons";
import { KeyHints } from "./key-hints";
import { MuteButton } from "./mute-button";
import { StaminaBar } from "./stamina-bar";

/**
 * The in-world overlay.
 *
 * Deliberately thin. The world ships no markers, so the progress counter
 * ("n / 14 visited") and the proximity prompt that used to live here have gone
 * with them; what is left is an exit affordance and the controls. The compass
 * renders nothing while there is nothing to point at, and is kept mounted so
 * that adding points of interest later needs no wiring.
 */

interface Props {
  onExit: () => void;
}

export function Hud({ onExit }: Props) {
  const activeId = usePlanetStore((s) => s.activeId);
  // Edge-triggered, so zustand is right here where an rAF loop would be wrong:
  // this changes when you walk up to something, not every frame.
  const nearbyId = usePlanetStore((s) => s.nearbyId);
  const prompt = promptFor(nearbyId);
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

      <MuteButton />

      {/* Interaction prompt. Centre-bottom-ish and above the controls, where
          the eye already is: this is the only thing in the world that responds
          to a key other than movement, so it has to be unmissable. */}
      {prompt && !activeId && (
        <div className="absolute bottom-24 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-[12px] font-medium text-white backdrop-blur-sm">
          <span className="rounded border border-white/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-white/80">
            E
          </span>
          {prompt}
        </div>
      )}

      {/* Controls. On a real keyboard these are drawn as keys that light up
          when pressed (see key-hints.tsx); a touch player has the joystick and
          the jump button on screen already, so all they need is the one
          non-obvious binding. */}
      {!activeId &&
        (isTouch ? (
          <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center">
            <StaminaBar />
            <div className="rounded-full bg-black/45 px-4 py-2 text-center text-[11px] text-white/70 backdrop-blur-sm">
              Stick to walk · push to the rim to sprint
            </div>
          </div>
        ) : (
          <KeyHints />
        ))}
    </div>
  );
}

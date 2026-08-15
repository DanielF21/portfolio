"use client";

import { useEffect, useState } from "react";

import { isMuted, toggleMuted } from "@/lib/planet/audio";

/**
 * Sound toggle.
 *
 * Unlike the other overlay pieces this one is React state, not an rAF loop:
 * it changes when a human presses a key, which is several orders of magnitude
 * less often than a frame.
 *
 * Bound to `M` as well as the button. As with `H` for the key hints, the
 * binding is registered here rather than in lib/planet/input.ts, which owns
 * movement keys and preventDefaults them; muting is a UI concern and has no
 * business in the render loop's input path.
 *
 * This file must not import `three`.
 */
export function MuteButton() {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMuted(isMuted());

    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyM" || e.repeat) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      setMuted(toggleMuted());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <button
      type="button"
      onClick={() => setMuted(toggleMuted())}
      aria-label={muted ? "Unmute" : "Mute"}
      aria-pressed={muted}
      className="pointer-events-auto absolute left-[132px] top-4 flex items-center gap-2 rounded-lg bg-black/45 px-3 py-2 text-[12px] font-medium text-white/80 backdrop-blur-sm transition hover:bg-black/70 hover:text-white"
    >
      <span aria-hidden className="text-[13px] leading-none">
        {muted ? "🔇" : "🔊"}
      </span>
      <span className="rounded border border-white/25 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-white/50">
        M
      </span>
    </button>
  );
}

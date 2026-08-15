"use client";

import { useEffect, useRef } from "react";

import { stamina } from "@/lib/planet/stamina";

/**
 * The sprint meter.
 *
 * Driven by an rAF loop writing styles directly, like `key-hints.tsx` and
 * `compass-chevrons.tsx`. This one has no choice about it: the value changes
 * every frame while sprinting, so React state would re-render the whole
 * overlay at the frame rate for one CSS width.
 *
 * Hidden while the meter is full AND idle, which is most of the time. A gauge
 * that is permanently pinned at 100% is furniture; one that appears when it
 * starts mattering reads as information. It fades rather than unmounting so
 * the transition is not a pop.
 *
 * This file must not import `three`.
 */

/** Below this the bar warns, above it reads as healthy. */
const LOW = 0.3;

export function StaminaBar() {
  const root = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  /** Last applied colour, so the loop only touches the DOM when it changes. */
  const tone = useRef("");

  useEffect(() => {
    let raf = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const r = root.current;
      const f = fill.current;
      if (!r || !f) return;

      const v = stamina.value;
      r.style.opacity = v >= 0.999 && !stamina.draining ? "0" : "1";
      f.style.width = `${Math.max(0, Math.min(1, v)) * 100}%`;

      const next = stamina.locked
        ? "rgba(248,113,113,0.95)"
        : v < LOW
          ? "rgba(251,191,36,0.95)"
          : "rgba(255,255,255,0.8)";
      if (tone.current !== next) {
        tone.current = next;
        f.style.background = next;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={root}
      aria-hidden
      className="mb-1 h-[5px] w-[136px] overflow-hidden rounded-full border border-white/20 bg-black/30 transition-opacity duration-300"
      style={{ opacity: 0 }}
    >
      <div
        ref={fill}
        className="h-full w-full rounded-full transition-colors duration-200"
        style={{ background: "rgba(255,255,255,0.8)" }}
      />
    </div>
  );
}

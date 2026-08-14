"use client";

import { useEffect, useRef } from "react";

import { compass, COMPASS_SLOTS } from "@/lib/planet/compass";
import { usePlanetStore } from "@/lib/planet/store";

/**
 * Edge-of-screen arrows pointing at the nearest unvisited markers that are
 * currently off screen.
 *
 * The nodes are rendered once and then driven entirely by direct style
 * mutation from an rAF loop, never by setState. This is the same technique the
 * touch joystick uses for its knob, and for the same reason: this updates every
 * frame, and pushing it through React would re-render the overlay at 60Hz.
 *
 * This file must not import `three`. It reads plain numbers out of the
 * `compass` singleton, which the render loop fills in.
 */

/** Fraction of the viewport half-width/height the arrows sit at. */
const INSET_X = 0.4;
const INSET_Y = 0.36;

export function CompassChevrons() {
  const activeId = usePlanetStore((s) => s.activeId);
  const rootRefs = useRef<(HTMLDivElement | null)[]>([]);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const arrowRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);

      for (let i = 0; i < COMPASS_SLOTS; i++) {
        const root = rootRefs.current[i];
        if (!root) continue;

        const slot = compass.slots[i];
        if (slot.id === null) {
          root.style.opacity = "0";
          continue;
        }

        // Screen-space y grows downward, the stored angle is measured with y
        // up, hence the negation on the vertical term and on the rotation.
        const x = Math.cos(slot.angle) * INSET_X * 100;
        const y = -Math.sin(slot.angle) * INSET_Y * 100;

        root.style.opacity = "1";
        root.style.transform = `translate(-50%, -50%) translate(${x}vw, ${y}vh)`;

        const arrow = arrowRefs.current[i];
        if (arrow) {
          arrow.style.transform = `rotate(${-slot.angle}rad)`;
        }

        const label = labelRefs.current[i];
        if (label) {
          const text = `${slot.label} ${Math.round(slot.distance)}m`;
          // Assigning identical text still dirties layout in some engines.
          if (label.textContent !== text) label.textContent = text;
        }
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Hidden while a modal is open; the walk is paused anyway.
  if (activeId) return null;

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {Array.from({ length: COMPASS_SLOTS }, (_, i) => (
        <div
          key={i}
          ref={(el) => {
            rootRefs.current[i] = el;
          }}
          className="absolute left-1/2 top-1/2 flex items-center gap-1.5 rounded-full bg-black/45 px-2 py-1 backdrop-blur-sm transition-opacity duration-300"
          style={{ opacity: 0 }}
        >
          <span
            ref={(el) => {
              arrowRefs.current[i] = el;
            }}
            className="text-[13px] leading-none text-white/90"
            // A right-pointing triangle at 0 rad, matching the angle convention.
          >
            ➤
          </span>
          <span
            ref={(el) => {
              labelRefs.current[i] = el;
            }}
            className="whitespace-nowrap text-[10px] font-medium leading-none text-white/70"
          />
        </div>
      ))}
    </div>
  );
}

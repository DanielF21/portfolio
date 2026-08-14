"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { pressJump, setStick } from "@/lib/planet/input";
import { usePlanetStore } from "@/lib/planet/store";

const BASE = 56; // px radius of the joystick well
const KNOB = 26;
const JUMP_BTN = 72;

/**
 * Virtual joystick. Writes straight into the input singleton, same as the
 * keyboard, so the render loop needs no knowledge of which one is driving.
 *
 * Sits in its own bottom-left region and stops propagation, so joystick drags
 * are never also interpreted as camera-orbit drags.
 */
export function TouchControls() {
  const [visible, setVisible] = useState(false);
  const activeId = usePlanetStore((s) => s.activeId);

  const wellRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const pointerId = useRef<number | null>(null);

  useEffect(() => {
    setVisible(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  const reset = useCallback(() => {
    pointerId.current = null;
    setStick(0, 0);
    if (knobRef.current) {
      knobRef.current.style.transform = "translate(-50%, -50%)";
    }
  }, []);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    const well = wellRef.current;
    const knob = knobRef.current;
    if (!well || !knob) return;

    const rect = well.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const max = BASE - KNOB / 2;
    if (dist > max && dist > 0) {
      dx = (dx / dist) * max;
      dy = (dy / dist) * max;
    }

    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    // Screen down is +y, but forward is -y in screen terms, hence the negation.
    setStick(dx / max, -dy / max);
  }, []);

  if (!visible || activeId) return null;

  return (
    <>
      <div
        ref={wellRef}
        className="pointer-events-auto absolute bottom-8 left-8 z-20 touch-none rounded-full border border-white/20 bg-white/10 backdrop-blur-sm"
        style={{ width: BASE * 2, height: BASE * 2 }}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (pointerId.current !== null) return;
          pointerId.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          handleMove(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          e.stopPropagation();
          if (e.pointerId !== pointerId.current) return;
          handleMove(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          if (e.pointerId !== pointerId.current) return;
          reset();
        }}
        onPointerCancel={() => reset()}
      >
        <div
          ref={knobRef}
          className="absolute left-1/2 top-1/2 rounded-full bg-white/70 shadow"
          style={{ width: KNOB, height: KNOB, transform: "translate(-50%, -50%)" }}
        />
      </div>

      {/* Jump. Must stop propagation for the same reason the joystick does, or
          the tap is also read as a camera-orbit drag. There is no sprint
          button: pushing the stick to the rim sprints (see setStick). */}
      <button
        type="button"
        aria-label="Jump"
        className="pointer-events-auto absolute bottom-8 right-8 z-20 touch-none rounded-full border border-white/25 bg-white/15 text-[11px] font-semibold uppercase tracking-wide text-white/80 backdrop-blur-sm active:bg-white/30"
        style={{ width: JUMP_BTN, height: JUMP_BTN }}
        onPointerDown={(e) => {
          e.stopPropagation();
          pressJump();
        }}
        onPointerUp={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
      >
        Jump
      </button>
    </>
  );
}

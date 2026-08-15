"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { DirectionalLight } from "three";

import { dayPhase, SUN_DISTANCE, sunDirection } from "@/lib/planet/daylight";

/**
 * The key light, moved by the clock.
 *
 * This replaces a directionalLight nailed to [14, 10, 8]. A fixed sun was
 * survivable on the old four-island layout and became a real problem on the
 * five-island one, where two islands sat in permanent night: you could walk to
 * the desert and find it had never once been lit.
 *
 * Only the DIRECTION animates. Colour and intensity are constant, because the
 * thing that makes a day cycle read is the terminator moving across the
 * landscape, not the whole scene dimming and brightening in step. Dimming is
 * also what would make the night side unreadable, and the ambient term in
 * scene.tsx is deliberately doing the work of keeping it legible.
 */
export function Daylight() {
  const light = useRef<DirectionalLight>(null);

  useFrame((state) => {
    const l = light.current;
    if (!l) return;
    const sun = sunDirection(dayPhase(state.clock.elapsedTime));
    l.position.set(
      sun.x * SUN_DISTANCE,
      sun.y * SUN_DISTANCE,
      sun.z * SUN_DISTANCE
    );
  });

  return <directionalLight ref={light} intensity={1.5} color="#fff4e2" />;
}

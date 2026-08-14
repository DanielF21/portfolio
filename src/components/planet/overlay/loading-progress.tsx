"use client";

import { usePlanetStore } from "@/lib/planet/store";

/**
 * Small progress pill shown while the 3D world is still loading. The 2D page
 * stays fully visible and interactive behind it; this is additive feedback,
 * not a blocking screen.
 *
 * Eagerly loaded DOM, so it must never import `three` (it reads progress via
 * the store, bridged from inside the lazy chunk).
 */
export function LoadingProgress() {
  const sceneReady = usePlanetStore((s) => s.sceneReady);
  const progress = usePlanetStore((s) => s.loadProgress);

  if (sceneReady) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-xs text-white/80 backdrop-blur"
      role="status"
    >
      Loading world&hellip; {Math.round(progress)}%
    </div>
  );
}

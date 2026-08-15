"use client";

import dynamic from "next/dynamic";

import { SPAWN } from "@/lib/planet/world-layout";

/**
 * Ambient planet preview.
 *
 * `interactive={false}` is load-bearing, not cosmetic. Scene's default input
 * wiring binds keydown handlers to `window` that preventDefault the arrow keys
 * and Space, so an interactive Scene mounted in a page tile would stop the page
 * from scrolling. See the prop's doc comment in scene.tsx.
 *
 * Note this is only reachable from a `preview: "live"` registry entry. Planet
 * is deliberately registered as `preview: "video"`, because three.js, drei, and
 * R3F together are far too large to pull onto an index page for decoration.
 * This exists so that the choice stays a one-word change.
 */
const Scene = dynamic(() => import("./scene"), { ssr: false, loading: () => null });

export default function PlanetPreview() {
  return (
    <div className="absolute inset-0 bg-[#070b1c]">
      <Scene
        markers={[]}
        spawn={SPAWN}
        lowPower
        interactive={false}
        onContextLost={() => {}}
      />
    </div>
  );
}

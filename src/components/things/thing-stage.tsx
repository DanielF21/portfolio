"use client";

import Image from "next/image";
import { useState } from "react";

import { WebglBoundary } from "@/components/planet/webgl-boundary";
import { FULL } from "@/components/things/loaders";
import type { Thing } from "@/data/things";

/**
 * Where a thing actually runs on its own page.
 *
 * Two modes, chosen by the registry's `stage` field:
 *
 *  - "inline": the toy mounts straight into the page.
 *  - "immersive": the poster and an Enter button, and pressing it hands the
 *    whole screen over. Used for the planet, which wants the viewport and the
 *    keyboard. This replaces the old modal-behind-a-tab arrangement.
 */
export function ThingStage({ thing }: { thing: Thing }) {
  const [entered, setEntered] = useState(false);
  const [failed, setFailed] = useState(false);
  const Full = FULL[thing.slug];

  if (!Full) return null;

  if (failed) {
    return (
      <div className="rounded-xl border p-6 text-body text-muted-foreground">
        This one could not start in your browser. It needs WebGL.
      </div>
    );
  }

  if (thing.stage === "inline") {
    return (
      <WebglBoundary onError={() => setFailed(true)}>
        <Full />
      </WebglBoundary>
    );
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border">
        <Image
          src={thing.poster.src}
          alt={thing.poster.alt}
          width={thing.poster.width}
          height={thing.poster.height}
          priority
          sizes="(max-width: 768px) 100vw, 1024px"
          className="aspect-[16/10] w-full object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/35">
          <button
            type="button"
            onClick={() => setEntered(true)}
            className="rounded-full bg-white px-6 py-3 font-display text-title font-bold text-black shadow-lg transition-transform hover:scale-[1.03]"
          >
            Enter
          </button>
        </div>
      </div>

      {entered && (
        <WebglBoundary onError={() => setFailed(true)}>
          <Full onClose={() => setEntered(false)} />
        </WebglBoundary>
      )}
    </>
  );
}

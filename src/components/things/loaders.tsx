"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

/**
 * The single place a slug maps to real toy code.
 *
 * This file exists so that everything else about a thing (its registry entry,
 * its route, its tile) stays plain data. Adding a toy means one line in each
 * map below and nothing else here.
 *
 * It must be a client module: `dynamic(..., { ssr: false })` is a hard build
 * error inside a Server Component in the Next 14 App Router. Keeping the
 * boundary here means the three.js chunk and friends are never in the server
 * bundle or the initial client chunk.
 */

function Loading() {
  return (
    <div className="flex h-64 items-center justify-center text-muted-foreground">
      Loading...
    </div>
  );
}

/** The real, interactive thing. Rendered on /things/<slug>. */
export const FULL: Record<string, ComponentType<any>> = {
  chess: dynamic(() => import("./chess/chess-board"), {
    ssr: false,
    loading: Loading,
  }),
  scheme: dynamic(() => import("./scheme/repl"), {
    ssr: false,
    loading: Loading,
  }),
  planet: dynamic(() => import("@/components/planet/planet-stage"), {
    ssr: false,
    loading: () => null,
  }),
};

/**
 * The ambient, input-free miniature shown on a tile.
 *
 * Only needed for things registered as `preview: "live"`. A preview is NOT the
 * toy: no network calls, no input handling, no page-level side effects.
 */
export const LIVE: Record<string, ComponentType<any>> = {
  chess: dynamic(() => import("./chess/preview"), { ssr: false }),
  scheme: dynamic(() => import("./scheme/preview"), { ssr: false }),
  planet: dynamic(() => import("@/components/planet/planet-preview"), {
    ssr: false,
  }),
};

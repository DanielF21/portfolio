"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * A named region of the scene.
 *
 * TWO JOBS, AND IT USED TO HAVE A THIRD. It provides its dotted path to
 * everything under it, and it tags its group so the camera can find that subtree
 * by name. What it no longer does is unmount its children when they are out of
 * scope.
 *
 * WHY THAT WENT. Removing the siblings is what made every station legible on its
 * own, and it is also what made the piece unreadable to anyone who did not
 * already know the answer. Clicking "RMSNorm" produced a bar on a stick in an
 * empty frame; clicking "Scores, and the mask" produced a staircase belonging to
 * nothing. There was no way to tell from the picture where either thing sat, what
 * fed it, or what it fed. Isolation solved a rendering problem by destroying the
 * only thing the drawing was for.
 *
 * The rendering problem was real and is now solved where it belongs, in the
 * geometry: `layout.ts` spaces the stations far enough apart that a camera
 * standing off the station axis separates them, and `glossary.ts` puts every
 * in-block camera at that azimuth. See the note on `STATION_SEQUENCE` for the
 * arithmetic.
 *
 * `position` is taken here rather than by a wrapping group so that a scope and
 * its placement stay one node.
 */
const ScopeContext = createContext<string>("");

export function useScopePath(): string {
  return useContext(ScopeContext);
}

/** The key `auto-frame` and the focus marker look for when walking up from a
 *  mesh to find out which named region it belongs to. */
export const SCOPE_KEY = "scopePath";

export function Scope({
  id,
  position,
  children,
}: {
  id: string;
  position?: [number, number, number];
  children: ReactNode;
}) {
  return (
    <ScopeContext.Provider value={id}>
      <group position={position ?? [0, 0, 0]} userData={{ [SCOPE_KEY]: id }}>
        {children}
      </group>
    </ScopeContext.Provider>
  );
}

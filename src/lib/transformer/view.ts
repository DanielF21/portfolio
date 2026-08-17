/**
 * The live view state, as plain mutable numbers.
 *
 * Same architecture, and same reason, as the planet's `input.ts` and
 * `compass.ts`: the render loop writes here every frame and the DOM overlay
 * reads it from its own rAF loop. Routing per-frame camera state through React
 * would re-render the overlay 60 times a second for what is ultimately a handful
 * of CSS properties.
 *
 * zustand carries EDGES (which node is focused, is the scene ready). This file
 * carries FRAMES. Nothing that changes every frame belongs in the store.
 *
 * This file must never import `three`. It holds plain numbers only; the
 * projection math lives inside the lazy three chunk.
 */

import { DEFAULT_POSE, type Pose } from "./camera";

export const view = {
  /** Where the camera wants to be. The drag handler, the index and `auto-frame`
   *  all write here, and nothing else does. */
  desired: DEFAULT_POSE as Pose,
  /** Where the camera is. The rig writes this; everything else reads it. */
  current: DEFAULT_POSE as Pose,

  /** Canvas size in CSS pixels. Read by `auto-frame` to fit both screen axes,
   *  and it is the CANVAS, not the window: the canvas is a grid cell inside the
   *  shell, so it is narrower than the viewport by the index panel's width. */
  width: 0,
  height: 0,

  /** Bumped to ask `auto-frame` to re-measure and re-frame the current scope.
   *  A counter rather than a boolean so two requests in one frame cannot cancel
   *  each other out, and so the reset control works even when it does not
   *  change which node is focused. */
  refit: 0,

  /**
   * How far the hero block has bloomed open, 0 to 1.
   *
   * A FRAME VALUE, not an edge, which is why it lives here and not in the store.
   * `explodeTo` is where it is heading and the stack damps towards it, rewriting
   * its instance matrices only while the two differ. Opening a block moves 27
   * plates roughly 23 units each; done as a jump that reads as the stack being
   * replaced, and done as a motion it reads as the one thing it is, which is the
   * block you asked for pushing its neighbours aside to make room.
   */
  explode: 0,
  explodeTo: 0,

  /**
   * World-space bounds of whatever is focused, as [min, max], or null.
   *
   * Written by `auto-frame` when it measures, read by the focus marker so the
   * brackets sit on the thing the camera just framed. Plain numbers, because
   * this file must stay three-free.
   */
  focusBox: null as null | {
    min: [number, number, number];
    max: [number, number, number];
  },
};

/** Ask the camera to re-frame whatever is in scope. */
export function requestRefit(): void {
  view.refit += 1;
}

/** Called on mount and on unmount. These modules outlive the stage, exactly as
 *  the planet's set piece modules do, so leaving a pose behind would have the
 *  next visit start mid-flight somewhere odd. */
export function resetView(): void {
  view.desired = DEFAULT_POSE;
  view.current = DEFAULT_POSE;
  view.width = 0;
  view.height = 0;
  view.refit = 0;
  view.explode = 0;
  view.explodeTo = 0;
  view.focusBox = null;
}

/** Send the camera home without snapping it. The chase does the rest. */
export function flyHome(): void {
  view.desired = DEFAULT_POSE;
}

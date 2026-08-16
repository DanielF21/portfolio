/**
 * The live view state, as plain mutable numbers.
 *
 * Same architecture, and same reason, as the planet's `input.ts` and
 * `compass.ts`: the render loop writes here every frame and the DOM overlay
 * reads it from its own rAF loop. Routing per-frame camera and label positions
 * through React state would re-render the overlay 60 times a second for what is
 * ultimately a handful of CSS properties.
 *
 * zustand carries EDGES (which node is focused, is the scene ready). This file
 * carries FRAMES. Nothing that changes every frame belongs in the store.
 *
 * This file must never import `three`. It holds plain numbers only; the
 * projection math lives inside the lazy three chunk.
 */

import { DEFAULT_POSE, type Pose } from "./camera";

/** How many labels can be on screen at once. More than this is noise, not
 *  annotation, and the declutter pass drops the rest. */
export const LABEL_SLOTS = 14;

export interface LabelSlot {
  /** Anchor id this slot is showing, or null when unused this frame. */
  id: string | null;
  text: string;
  /** Second line: the real shape, parameter count or byte figure. */
  sub: string;
  /** Screen position in CSS pixels, relative to the canvas. Where the leader
   *  line ENDS, i.e. the anchor point on the object. */
  x: number;
  y: number;
  /** Distance from the camera, for depth sorting and distance fade. */
  depth: number;
  /** 0..1. Zero means fully hidden: off screen, behind you, or decluttered. */
  opacity: number;
  /** True when the box sits to the LEFT of its anchor because placing it to the
   *  right would run off the viewport. The widest tensors in the model reach
   *  the frame edge by design, so their labels do this constantly. */
  flip: boolean;
}

function emptyLabel(): LabelSlot {
  return { id: null, text: "", sub: "", x: 0, y: 0, depth: 0, opacity: 0, flip: false };
}

export const view = {
  /** Where the camera wants to be. Both the drag handler and the index panel
   *  write here, and nothing else does. */
  desired: DEFAULT_POSE as Pose,
  /** Where the camera is. The rig writes this; everything else reads it. */
  current: DEFAULT_POSE as Pose,

  labels: Array.from({ length: LABEL_SLOTS }, emptyLabel),

  /** Canvas size in CSS pixels, so the overlay can position without measuring
   *  the DOM itself every frame. */
  width: 0,
  height: 0,

  /** Bumped to ask `auto-frame` to re-measure and re-frame the current scope.
   *  A counter rather than a boolean so two requests in one frame cannot cancel
   *  each other out, and so the reset control works even when it does not
   *  change which node is focused. */
  refit: 0,
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
  view.labels = Array.from({ length: LABEL_SLOTS }, emptyLabel);
  view.width = 0;
  view.height = 0;
  view.refit = 0;
}

/** Send the camera home without snapping it. The chase does the rest. */
export function flyHome(): void {
  view.desired = DEFAULT_POSE;
}

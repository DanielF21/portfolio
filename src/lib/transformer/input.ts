/**
 * Drag to rotate, scroll to zoom, hover to inspect.
 *
 * Modelled on `lib/planet/input.ts` but deliberately separate, because that one
 * writes into the planet's singleton. Three of its fixes are carried over
 * rather than rediscovered, and each is load bearing:
 *
 *  - The release function is IDEMPOTENT. `reactStrictMode` double-invokes
 *    effects in dev, so attach/detach/attach must net out to one live set of
 *    handlers; a release that runs twice must not tear down the second attach.
 *    (The planet additionally refcounts because several components bind its
 *    keyboard at once. Here there is one element and one caller, so the flag is
 *    enough.)
 *  - `setPointerCapture` is wrapped in try/catch. Safari throws if the pointer
 *    is already gone.
 *  - Firefox reports `deltaMode === 1` (lines, not pixels) and its raw deltaY
 *    is ~1/33 of everyone else's, so zoom is unusably slow without the scale.
 *
 * This file must never import `three`. It is pulled in by the DOM overlay.
 */

import { clamp, DISTANCE_MAX, DISTANCE_MIN } from "./camera";
import { view } from "./view";

/** Radians of orbit per pixel dragged. */
const ORBIT_SENS = 0.0060;
/** Zoom per pixel of wheel travel, applied exponentially. */
const ZOOM_SENS = 0.0012;

export const pointer = {
  /** Position in CSS pixels relative to the canvas, or null when the pointer
   *  has left it. Read by the hover pick, which runs inside the three chunk. */
  x: 0,
  y: 0,
  inside: false,
  /** True while a drag is in progress. Hover picking is suppressed during a
   *  drag: highlighting whatever slides under the cursor while you orbit is
   *  distracting and never what you meant. */
  dragging: false,
};

export function resetPointer(): void {
  pointer.x = 0;
  pointer.y = 0;
  pointer.inside = false;
  pointer.dragging = false;
}

/**
 * Bind orbit, zoom and hover to an element.
 *
 * Writes straight into `view.desired`, never into `view.current`. The chase in
 * the rig is what the visitor actually sees, so a drag is damped for free and
 * an index flight already in progress is simply overridden rather than
 * cancelled.
 */
export function attachControls(el: HTMLElement): () => void {
  let activeId: number | null = null;
  let lastX = 0;
  let lastY = 0;

  const setPointerFromEvent = (e: PointerEvent) => {
    const rect = el.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
    pointer.inside = true;
  };

  const down = (e: PointerEvent) => {
    if (activeId !== null) return;
    activeId = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
    pointer.dragging = true;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Safari can throw if the pointer is already gone; harmless.
    }
  };

  const move = (e: PointerEvent) => {
    setPointerFromEvent(e);
    if (e.pointerId !== activeId) return;

    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    const p = view.desired;
    view.desired = {
      ...p,
      theta: p.theta - dx * ORBIT_SENS,
      // Clamped in `clampPose` during the chase, but clamped here too so the
      // desired pose cannot accumulate a phi of 400 radians while the visitor
      // keeps dragging past the pole.
      phi: clamp(p.phi - dy * ORBIT_SENS, 0.08, Math.PI - 0.08),
    };
  };

  const up = (e: PointerEvent) => {
    if (e.pointerId !== activeId) return;
    activeId = null;
    pointer.dragging = false;
    try {
      el.releasePointerCapture(e.pointerId);
    } catch {
      // Already released.
    }
  };

  const leave = () => {
    pointer.inside = false;
  };

  const wheel = (e: WheelEvent) => {
    // The page is scroll-locked while the canvas owns the viewport, but
    // without preventDefault trackpads still trigger browser zoom and
    // back-forward gestures.
    e.preventDefault();
    const px = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
    const p = view.desired;
    // Exponential, so equal scroll travel multiplies the distance equally and
    // zooming in then back out retraces the same path.
    view.desired = {
      ...p,
      distance: clamp(
        p.distance * Math.exp(px * ZOOM_SENS),
        DISTANCE_MIN,
        DISTANCE_MAX
      ),
    };
  };

  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  el.addEventListener("pointerleave", leave);
  el.addEventListener("wheel", wheel, { passive: false });

  let released = false;
  return () => {
    if (released) return;
    released = true;
    el.removeEventListener("pointerdown", down);
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", up);
    el.removeEventListener("pointercancel", up);
    el.removeEventListener("pointerleave", leave);
    el.removeEventListener("wheel", wheel);
    resetPointer();
  };
}

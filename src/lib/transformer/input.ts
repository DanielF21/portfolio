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

import { armFallback, disarm, fire } from "./activate";
import { clamp, DISTANCE_MAX, DISTANCE_MIN } from "./camera";
import { view } from "./view";

/** Radians of orbit per pixel dragged. */
const ORBIT_SENS = 0.0060;
/** Zoom per pixel of wheel travel, applied exponentially. */
const ZOOM_SENS = 0.0012;

/**
 * How far the pointer must travel before the camera starts orbiting, in CSS
 * pixels.
 *
 * Orbit used to begin on the first pointermove after pointerdown, and a real
 * click moves a few pixels between press and release: measured, a 3px wobble
 * rotated the camera by 0.018 radians. So every attempt to click something
 * nudged the view instead, which reads as "clicking does nothing except make the
 * model twitch".
 */
const DRAG_THRESHOLD = 4;

/**
 * How far the pointer must travel before the gesture stops counting as a CLICK,
 * in CSS pixels. Deliberately much larger than `DRAG_THRESHOLD`.
 *
 * ONE THRESHOLD FOR BOTH JOBS WAS THE BUG. Sharing `DRAG_THRESHOLD` meant that
 * crossing 4px did two things at once: it started the orbit, and it set the flag
 * that tells the click handler to stand down. A trackpad click drifts well past
 * four pixels, so on a trackpad every click set that flag and every click was
 * swallowed. It worked under devtools because emulated and synthetic input moves
 * the pointer exactly zero pixels between press and release, which is precisely
 * the case this threshold cannot see.
 *
 * Twelve pixels is past any click drift and well short of a deliberate drag.
 *
 * The zone between the two is not a compromise, it is the correct answer: 4 to
 * 12 pixels both rotates a little AND counts as a click, and the rotation is
 * then thrown away by the re-frame the click asks for. So an ambiguous gesture
 * resolves to the intent that is recoverable.
 */
const CLICK_SLOP = 12;

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
  /**
   * True once the gesture has travelled far enough that it is certainly not a
   * click. See `CLICK_SLOP`; this is NOT the same threshold as `dragging`.
   *
   * Survives pointerup on purpose. The browser fires `click` AFTER `pointerup`,
   * and it fires it even when the pointer travelled a long way, so without a
   * flag that outlives the release, letting go of a drag over an object
   * navigates to that object. Cleared on the next pointerdown.
   */
  dragged: false,
  /**
   * True while the cursor is over something a click would navigate to.
   *
   * A FRAME VALUE, so it lives here rather than in the store: it changes as the
   * cursor crosses geometry, which is not worth a React render. Written by the
   * hover pick inside the three chunk and read by the cursor sync.
   */
  hot: false,
};

export function resetPointer(): void {
  pointer.x = 0;
  pointer.y = 0;
  pointer.inside = false;
  pointer.dragging = false;
  pointer.dragged = false;
  pointer.hot = false;
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
  /** Where the button went down, for the drag threshold. */
  let startX = 0;
  let startY = 0;

  const setPointerFromEvent = (e: PointerEvent) => {
    const rect = el.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
    pointer.inside = true;
  };

  /**
   * End the current gesture, whatever ended it.
   *
   * ONE EXIT, CALLED FROM FIVE PLACES, because a gesture that never ends is the
   * worst failure this file has. `activeId` stuck non-null means `move` keeps
   * orbiting on every mouse move with no button held (the model follows the
   * cursor forever) AND `down` early-returns for good, so `dragged` is never
   * cleared and every click is suppressed. "Can't click, stuck in a drag" is
   * that single stuck variable seen from both sides.
   *
   * The ways it happened: a right click, whose pointerup goes to the context
   * menu rather than the page; alt-tabbing away mid-drag; and any pointercancel
   * the browser decides to send. Each is now an exit.
   */
  const endGesture = () => {
    if (activeId === null) return;
    activeId = null;
    pointer.dragging = false;
    // Anything still armed by the press is abandoned. A gesture that ends by
    // any route other than a short release is not a click.
    disarm();
  };

  /**
   * Arm the fallback BEFORE this press reaches the scene.
   *
   * Bound in the CAPTURE phase on the host, which is an ancestor of the canvas,
   * so it runs before r3f's listeners and therefore before any object arms
   * itself. Doing it in the bubble-phase `down` below would run after and wipe
   * the arming that just happened.
   *
   * The fallback is "back out to the whole model", so a press that lands on
   * nothing at all is a way out of a station rather than a dead click.
   */
  const armDefault = () => armFallback();

  const down = (e: PointerEvent) => {
    // PRIMARY BUTTON ONLY. A right or middle press used to start a drag, and
    // its release is delivered to the context menu instead of to the page, so
    // one right click left the scene orbiting forever and unclickable.
    if (e.button !== 0) return;
    if (activeId !== null) return;
    activeId = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
    startX = e.clientX;
    startY = e.clientY;
    // NOT dragging yet. See `DRAG_THRESHOLD`.
    pointer.dragging = false;
    pointer.dragged = false;

    // NO setPointerCapture. It used to capture on the host here, and capture
    // retargets the compatibility mouse events, which means `mouseup` and
    // therefore `click` go to the capture element instead of to the element
    // under the cursor. The orbit kept working because it listens on the host,
    // which IS the capture element, while the canvas stopped receiving clicks
    // at all. Dragging outside the element is handled by listening on `window`
    // instead, which needs no capture and cannot retarget anything.
  };

  const move = (e: PointerEvent) => {
    setPointerFromEvent(e);
    if (e.pointerId !== activeId) return;

    // SELF-HEAL, AND IT COMPLETES THE GESTURE RATHER THAN ABANDONING IT.
    //
    // A move with no button held while a press is open means the release either
    // was lost or is about to arrive. Treating that as "give up" threw away the
    // selection, and some input paths emit exactly such a move between
    // pointerdown and pointerup, which made pressing empty space do nothing at
    // all. Finishing on the same terms as a real release is correct in both
    // cases: a lost pointerup still activates, and a stray move activates the
    // thing the press was already on.
    if (e.buttons === 0) {
      finish(e.clientX, e.clientY);
      return;
    }

    const travel = Math.hypot(e.clientX - startX, e.clientY - startY);

    // Two thresholds, and they are separate on purpose. See `CLICK_SLOP`.
    if (travel >= CLICK_SLOP) pointer.dragged = true;

    if (!pointer.dragging) {
      if (travel < DRAG_THRESHOLD) return;
      pointer.dragging = true;
      // Start orbiting from HERE, not from where the button went down, or the
      // view jumps by the whole threshold the moment it is crossed.
      lastX = e.clientX;
      lastY = e.clientY;
      return;
    }

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

  /**
   * End a gesture and decide whether it was a selection.
   *
   * The ONLY place a selection is made. A press that travelled less than
   * `CLICK_SLOP` is a click, whatever the browser thinks and whatever it did or
   * did not deliver to the canvas. See `activate.ts` for why the browser's own
   * `click` is no longer trusted.
   *
   * Idempotent: it clears `activeId` first and `fire` clears what it fired, so
   * the real pointerup arriving after a self-heal does nothing twice.
   */
  const finish = (x: number, y: number) => {
    const travel = Math.hypot(x - startX, y - startY);
    activeId = null;
    pointer.dragging = false;
    if (travel < CLICK_SLOP) fire();
    else disarm();
  };

  const up = (e: PointerEvent) => {
    if (e.pointerId !== activeId) return;
    finish(e.clientX, e.clientY);
  };

  const leave = () => {
    pointer.inside = false;
    pointer.hot = false;
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

  // Capture phase, so it runs before the scene arms anything. See `clearArmed`.
  el.addEventListener("pointerdown", armDefault, true);
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointerleave", leave);
  el.addEventListener("wheel", wheel, { passive: false });

  // ON WINDOW, NOT ON THE ELEMENT. A drag that leaves the canvas must keep
  // orbiting and must still end when the button comes up somewhere else, and
  // the alternative way to get that is `setPointerCapture`, which is what broke
  // clicking. Listening wider costs a rejected event or two per move and
  // retargets nothing.
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", endGesture);
  // The remaining ways a gesture ends without a pointerup ever arriving.
  window.addEventListener("contextmenu", endGesture);
  window.addEventListener("blur", endGesture);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    el.removeEventListener("pointerdown", armDefault, true);
    el.removeEventListener("pointerdown", down);
    el.removeEventListener("pointerleave", leave);
    el.removeEventListener("wheel", wheel);
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", endGesture);
    window.removeEventListener("contextmenu", endGesture);
    window.removeEventListener("blur", endGesture);
    resetPointer();
    disarm();
  };
}

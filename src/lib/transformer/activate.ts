/**
 * What a press armed, and whether the release still counts as a click.
 *
 * WHY THIS EXISTS INSTEAD OF AN `onClick`. Selecting something in the scene used
 * to ride on the browser's `click` event, delivered to the canvas and dispatched
 * by react-three-fiber. Four attempts to fix "clicking a block does nothing"
 * failed against that design, and every one of them passed under automation,
 * because a synthesised click and a real one do not travel the same path:
 *
 *  - `setPointerCapture` retargets the compatibility mouse events, so `mouseup`
 *    and therefore `click` are delivered to the CAPTURE element rather than to
 *    the element under the cursor. The controls captured on the canvas host, so
 *    a real press could take `click` away from the canvas entirely while the
 *    orbit, which listens on the host, kept working perfectly. Devtools-driven
 *    and synthetic input does not reproduce that.
 *  - r3f only fires `onClick` for objects that were also hit on pointerdown, and
 *    only if the browser decided to emit a click at all.
 *  - Both are invisible from the console, which is why this took four rounds.
 *
 * So the click is no longer inferred, it is CONSTRUCTED, out of the two events
 * that are certain to arrive:
 *
 *  - r3f's `onPointerDown` on an object ARMS an action. Picking demonstrably
 *    works, since hovering already lights the cursor, and pointerdown is
 *    dispatched before any capture is set.
 *  - The controls' own pointerup FIRES it, if the pointer has not travelled far
 *    enough to be a drag. That listener is on `window`, so it arrives however the
 *    gesture ends.
 *
 * Nothing in between can swallow it.
 *
 * This file must never import `three`. It holds one function reference.
 */

import { useTransformerStore } from "./store";
import { requestRefit } from "./view";

let armed: (() => void) | null = null;

/** Called by whatever was pressed, from inside the render layer. */
export function arm(action: () => void): void {
  armed = action;
}

/** Called when a press lands on something that is not a destination, and when a
 *  gesture turns into a drag. */
export function disarm(): void {
  armed = null;
}

/**
 * Back out to the whole model.
 *
 * Armed at the START of every press on the canvas, before the scene has had a
 * chance to arm anything of its own, so it is what survives when the press lands
 * on empty space. Pressing something that IS a destination overwrites it;
 * pressing something pickable that is not a destination (the stream, the two
 * ends) disarms instead, so those are inert rather than an exit.
 *
 * Does nothing at the overview. Otherwise pressing the background while already
 * at the top would re-frame the shot out from under someone who had just
 * orbited, which is a reset nobody asked for.
 */
function backToStack(): void {
  const store = useTransformerStore.getState();
  if (store.focus === null) return;
  store.setFocus(null);
  requestRefit();
}

/** Called in the capture phase of pointerdown, before the scene arms itself. */
export function armFallback(): void {
  armed = backToStack;
}

/** Called by the release. Runs at most once per press. */
export function fire(): void {
  const action = armed;
  armed = null;
  action?.();
}

/** Dev readout only. */
export function isArmed(): boolean {
  return armed !== null;
}

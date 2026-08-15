/**
 * Mutable input singleton, read once per frame by the render loop.
 *
 * Nothing here ever touches React state. Routing 120Hz pointermove through
 * setState would re-render the r3f tree hundreds of times a second.
 *
 * `reactStrictMode` is on, so effects double-invoke in dev. Listener attachment
 * is refcounted; without that you get double-registered handlers and 2x
 * movement speed in dev only, which is maximally confusing.
 *
 * This file must never import `three`.
 */

import { CAM_ZOOM_MAX, CAM_ZOOM_MIN, CAM_ZOOM_SENS } from "./config";

export interface InputState {
  /** -1..1, positive = right. */
  moveX: number;
  /** -1..1, positive = forward (away from camera). */
  moveY: number;
  /** Accumulated pointer drag since the last frame, consumed by the loop. */
  lookDX: number;
  lookDY: number;
  /** Edge-triggered; the loop clears it after handling. */
  interact: boolean;
  /** Edge-triggered; the loop clears it after handling. */
  jump: boolean;
  /** Level-triggered: true for as long as sprint is being requested. */
  sprint: boolean;
  /** Timestamp of the last manual camera drag, for auto-recenter gating. */
  lastDragAt: number;
  /** Target camera zoom factor, already clamped; the loop damps toward it.
   *  Deliberately NOT reset by clearMovement: zoom is a viewing preference,
   *  not a held control. */
  zoom: number;
}

export const input: InputState = {
  moveX: 0,
  moveY: 0,
  lookDX: 0,
  lookDY: 0,
  interact: false,
  jump: false,
  sprint: false,
  lastDragAt: 0,
  zoom: 1,
};

/** Keyboard axes, kept separate from the touch joystick so the two can
 *  coexist without clobbering each other. */
const keys = {
  fwd: false,
  back: false,
  left: false,
  right: false,
  sprint: false,
};

/**
 * Which physical keys are down right now, for the on-screen key hints.
 *
 * This is `keys` made public, and it is deliberately a separate object rather
 * than an export of `keys` itself: the axes above are an implementation detail
 * that `recomputeMove` owns, while this is a read-only presentation snapshot.
 * The hints overlay polls it from its own rAF loop, so nothing here needs to
 * notify anyone.
 *
 * `jumpAt` is a timestamp, not a boolean, because jump is edge triggered:
 * `input.jump` is consumed by the render loop within one frame, which is far
 * too short to see. The overlay decides how long to flash the cap.
 */
export const held = {
  fwd: false,
  back: false,
  left: false,
  right: false,
  sprint: false,
  jumpAt: 0,
};

function syncHeld() {
  held.fwd = keys.fwd;
  held.back = keys.back;
  held.left = keys.left;
  held.right = keys.right;
  held.sprint = keys.sprint || stick.sprint;
}

/** Touch joystick axes, -1..1, plus its own sprint flag. */
const stick = { x: 0, y: 0, sprint: false };

/** Stick deflection past which the touch player is considered to be sprinting.
 *  This is why sprint is tracked as two booleans rather than derived from the
 *  move vector's magnitude in the render loop: a keyboard diagonal has
 *  magnitude 1.41, which would read as permanently sprinting. */
const STICK_SPRINT_THRESHOLD = 0.85;

export function setStick(x: number, y: number) {
  stick.x = x;
  stick.y = y;
  stick.sprint = Math.hypot(x, y) > STICK_SPRINT_THRESHOLD;
  recomputeMove();
}

export function pressInteract() {
  input.interact = true;
}

export function pressJump() {
  input.jump = true;
  held.jumpAt = performance.now();
}

function recomputeMove() {
  const kx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const ky = (keys.fwd ? 1 : 0) - (keys.back ? 1 : 0);
  // Keyboard wins when held, otherwise the stick drives.
  input.moveX = kx !== 0 ? kx : stick.x;
  input.moveY = ky !== 0 ? ky : stick.y;
  input.sprint = keys.sprint || stick.sprint;
  syncHeld();
}

/** Held keys must not drive the character while a modal is open. */
export function clearMovement() {
  keys.fwd = keys.back = keys.left = keys.right = false;
  keys.sprint = false;
  stick.x = stick.y = 0;
  stick.sprint = false;
  input.moveX = input.moveY = 0;
  input.lookDX = input.lookDY = 0;
  // Edge- and level-triggered alike: a modal opening mid-jump must not leave
  // either latched for whenever it closes.
  input.jump = false;
  input.sprint = false;
  held.jumpAt = 0;
  syncHeld();
}

// `event.code` is physical-position based, so this works on AZERTY and Dvorak
// where `event.key` would not.
const FWD = new Set(["KeyW", "ArrowUp"]);
const BACK = new Set(["KeyS", "ArrowDown"]);
const LEFT = new Set(["KeyA", "ArrowLeft"]);
const RIGHT = new Set(["KeyD", "ArrowRight"]);
// Space used to be an interact key. It is a jump key now: E and Enter still
// cover interact, and space is the near-universal jump binding.
const INTERACT = new Set(["KeyE", "Enter"]);
const JUMP = new Set(["Space"]);
const SPRINT = new Set(["ShiftLeft", "ShiftRight"]);
const SCROLLERS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
]);

function onKeyDown(e: KeyboardEvent) {
  if (e.repeat) return;
  const c = e.code;
  if (SCROLLERS.has(c)) e.preventDefault();
  if (FWD.has(c)) keys.fwd = true;
  else if (BACK.has(c)) keys.back = true;
  else if (LEFT.has(c)) keys.left = true;
  else if (RIGHT.has(c)) keys.right = true;
  else if (SPRINT.has(c)) keys.sprint = true;
  else if (INTERACT.has(c)) input.interact = true;
  else if (JUMP.has(c)) {
    input.jump = true;
    held.jumpAt = performance.now();
  } else return;
  recomputeMove();
}

function onKeyUp(e: KeyboardEvent) {
  const c = e.code;
  if (FWD.has(c)) keys.fwd = false;
  else if (BACK.has(c)) keys.back = false;
  else if (LEFT.has(c)) keys.left = false;
  else if (RIGHT.has(c)) keys.right = false;
  else if (SPRINT.has(c)) keys.sprint = false;
  else return;
  recomputeMove();
}

/** Releasing focus mid-walk would otherwise leave a key stuck down. */
function onBlur() {
  clearMovement();
}

let keyboardRefs = 0;

export function attachKeyboard(): () => void {
  keyboardRefs += 1;
  if (keyboardRefs === 1) {
    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    keyboardRefs -= 1;
    if (keyboardRefs === 0) {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      clearMovement();
    }
  };
}

/**
 * Drag-to-orbit. Uses Pointer Events (unified mouse/touch) with pointer
 * capture, so dragging outside the element keeps tracking.
 */
export function attachDrag(el: HTMLElement): () => void {
  let activeId: number | null = null;
  let lastX = 0;
  let lastY = 0;

  const down = (e: PointerEvent) => {
    if (activeId !== null) return;
    activeId = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Safari can throw if the pointer is already gone; harmless.
    }
  };

  const move = (e: PointerEvent) => {
    if (e.pointerId !== activeId) return;
    input.lookDX += e.clientX - lastX;
    input.lookDY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    input.lastDragAt = performance.now();
  };

  const up = (e: PointerEvent) => {
    if (e.pointerId !== activeId) return;
    activeId = null;
    try {
      el.releasePointerCapture(e.pointerId);
    } catch {
      // Already released.
    }
  };

  const wheel = (e: WheelEvent) => {
    // The page is scroll-locked while the canvas owns the viewport, but
    // without preventDefault trackpads still trigger browser zoom/history
    // gestures.
    e.preventDefault();
    // Normalize line-mode deltas (Firefox) to roughly pixel scale.
    const px = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
    // Exponential: equal scroll travel multiplies the factor equally, so
    // zooming in and back out retraces the same path. Scroll up = closer.
    input.zoom = Math.min(
      CAM_ZOOM_MAX,
      Math.max(CAM_ZOOM_MIN, input.zoom * Math.exp(px * CAM_ZOOM_SENS))
    );
  };

  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  el.addEventListener("wheel", wheel, { passive: false });

  let released = false;
  return () => {
    if (released) return;
    released = true;
    el.removeEventListener("pointerdown", down);
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", up);
    el.removeEventListener("pointercancel", up);
    el.removeEventListener("wheel", wheel);
  };
}

"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { distanceFor, screenHalfExtents } from "@/lib/transformer/camera";
import { OVERVIEW_ID, entryById, inFocus } from "@/lib/transformer/glossary";
import { useTransformerStore } from "@/lib/transformer/store";
import { view } from "@/lib/transformer/view";

import { SCOPE_KEY } from "./scope";

/**
 * Points the camera at whatever is currently in scope, by MEASURING it.
 *
 * The glossary supplies the editorial half of a shot (which side to look from,
 * how wide a lens, how much of the frame to fill) and this supplies the
 * arithmetic half (where the subject actually is, and how far back that means
 * standing). Nothing in the index carries a literal distance any more.
 *
 * WHY. Fourteen hand-tuned distances were correct for exactly one version of
 * the geometry. The moment tensor heights became proportional they were all
 * wrong at once and in both directions: the output projection went from filling
 * 11% of the frame to 67%, the MLP from 16% to 141% and overflowing. Re-tuning
 * fourteen literals by eye against geometry that is still moving is how a scene
 * quietly ends up with its geometry bent to suit its cameras. Here a mis-framed
 * shot is not something you can ship.
 *
 * MEASURED, NOT DERIVED FROM `layout.ts`. Computing bounding boxes analytically
 * from the layout constants would be a second implementation of every placement
 * in the scene, and the two would drift the first time a component applied a
 * local offset. Reading the scene graph cannot drift, because it IS the thing
 * being framed.
 *
 * TIMING. Focus changes, React commits whatever that mounted (opening a block
 * mounts the whole interior), and only then is the graph the thing we want to
 * measure. So the measurement is deferred to the first frame after the change
 * rather than run in the effect that observes it.
 */

/**
 * Which named region a mesh belongs to, or null if it sits outside all of them.
 *
 * The nearest tagged ancestor wins, so a slab inside `block.attn.qkv` reports
 * that rather than `block`, and the plates and the two ends of the model (which
 * are in no scope at all) report null.
 */
function scopeOf(o: THREE.Object3D): string | null {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) {
    const path = n.userData[SCOPE_KEY];
    if (typeof path === "string") return path;
  }
  return null;
}

/**
 * Whether this mesh is part of the subject being framed.
 *
 * THE SUBJECT IS NOW A SUBTREE, NOT "WHATEVER IS ON SCREEN". It used to be the
 * latter, and that was only correct because focusing removed everything else;
 * with the whole model drawn at all times, measuring what is visible would frame
 * the entire stack from every station. So membership is decided by scope path.
 *
 * ANCESTORS ARE EXCLUDED, descendants included. `inFocus` is the rule; the trap
 * it avoids is that the `block` group physically contains all forty-one units of
 * stations, so counting it while focused on one of them frames the lot.
 */
function measurable(o: THREE.Object3D, focus: string | null): boolean {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) {
    // `Box3.setFromObject` reads geometry regardless of `visible`, so anything
    // hidden has to be excluded by hand. `noFit` is for things that span the
    // scene rather than sit in it: the ground plane and the stream conduit.
    if (!n.visible || n.userData.noFit) return false;
  }
  if (focus === null || focus === OVERVIEW_ID) return true;
  const scope = scopeOf(o);
  return scope !== null && inFocus(focus, scope);
}

export function AutoFrame() {
  const scene = useThree((s) => s.scene);
  const focus = useTransformerStore((s) => s.focus);

  const pending = useRef(true);
  /**
   * Frames to let pass after a request before measuring.
   *
   * SUBSCRIPTION ORDER IS NOT SOMETHING TO REASON ABOUT. `useFrame` callbacks run
   * in the order they subscribed, and `Block` subscribes AFTER this one because
   * it is mounted conditionally, one commit later. So on any given frame the
   * block's world scale is the one applied on the PREVIOUS frame, and measuring
   * immediately after the bloom settles returned a block about 1% short every
   * time. Waiting a frame makes that exact instead of nearly right, and it costs
   * one frame of a flight that takes fifty.
   *
   * A frame counter rather than a check on any particular component, because the
   * next thing to animate a transform in a useFrame will hit this too and should
   * not have to know about it.
   */
  const settle = useRef(0);
  const seenRefit = useRef(view.refit);
  const seenSize = useRef<[number, number]>([0, 0]);
  const box = useMemo(() => new THREE.Box3(), []);
  const item = useMemo(() => new THREE.Box3(), []);
  const size = useMemo(() => new THREE.Vector3(), []);
  const centre = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    pending.current = true;
    settle.current = 1;
    // CLEAR THE BRACKETS AT ONCE, not when the next measurement lands. The fit
    // waits for the bloom to settle, so on the way out of a station the marker
    // was still sitting on geometry that had already gone, and it lingered into
    // the stack view for the length of the collapse. The brackets belong to a
    // measurement; the moment the focus changes there is no current one.
    view.focusBox = null;
  }, [focus]);

  useFrame(() => {
    // "Reset view" does not necessarily change focus, so it asks by counter.
    if (view.refit !== seenRefit.current) {
      seenRefit.current = view.refit;
      pending.current = true;
      settle.current = 1;
    }

    // A resize changes the aspect ratio, and the aspect ratio is half of what
    // decides the distance. Without this the fit is correct only for the size
    // the window happened to be when you last picked something, and narrowing
    // the window silently crops the subject rather than backing off from it.
    if (view.width !== seenSize.current[0] || view.height !== seenSize.current[1]) {
      seenSize.current = [view.width, view.height];
      pending.current = true;
    }

    if (!pending.current) return;
    // The overlay writes `view.width/height` from the canvas each frame; before
    // the first one there is no aspect ratio to fit against.
    if (view.width === 0 || view.height === 0) return;

    // WAIT FOR THE BLOOM. The block's interior is scaled by `view.explode`, so
    // measuring it while it is opening measures whatever fraction of itself it
    // had reached and the camera lands that fraction too close. The same is true
    // in reverse for the overview, whose subject is 28 plates travelling 23
    // units each.
    //
    // The cost is that the camera holds still until the stack has settled, which
    // is about 0.4s at `EXPLODE_LAMBDA`, and that turns out to be the better
    // sequence anyway: the block visibly opens where it stands, and only then
    // does the camera go to it. Station to station inside an already open block
    // there is nothing to wait for, since the bloom is already at 1.
    if (Math.abs(view.explode - view.explodeTo) > 0.01) return;

    // One frame for whoever writes transforms after this callback. See `settle`.
    if (settle.current > 0) {
      settle.current -= 1;
      return;
    }

    const entry = entryById(focus ?? OVERVIEW_ID);
    if (!entry) {
      pending.current = false;
      return;
    }

    // Matrices before boxes. `Box3.setFromObject` reads `matrixWorld`, and an
    // object that mounted this commit has not had one computed yet: three
    // updates the graph's world matrices at RENDER time, which is after this
    // runs. Measuring without this returns the bounding box of the scene as it
    // was one focus ago, which is subtly wrong rather than obviously wrong. It
    // cost the overview 5 units of height, so the MLP ran off the top of frame
    // while every number involved looked plausible.
    scene.updateMatrixWorld(true);

    box.makeEmpty();
    let found = false;
    scene.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh) return;
      if (!measurable(o, focus)) return;
      item.setFromObject(o);
      if (item.isEmpty()) return;
      box.union(item);
      found = true;
    });
    if (!found) return;

    pending.current = false;

    box.getSize(size);
    box.getCenter(centre);

    // Hand the measured bounds to the focus marker, so the brackets sit on
    // exactly what the camera framed rather than on a second guess at it.
    //
    // Not for the two whole-object shots. The marker exists to pick one thing
    // out of several in frame, and at the overview and at "One block" the
    // measured box IS the frame, so its corners land on the four edges of the
    // viewport and read as chrome rather than as a mark on anything.
    view.focusBox =
      focus === null || focus === OVERVIEW_ID || focus === "block"
        ? null
        : {
            min: [box.min.x, box.min.y, box.min.z],
            max: [box.max.x, box.max.y, box.max.z],
          };

    const { theta, phi, fov, fill } = entry.view;
    const aspect = view.width / view.height;
    const { halfW, halfH, halfDepth } = screenHalfExtents(
      size.x,
      size.y,
      size.z,
      theta,
      phi
    );

    view.desired = {
      target: [centre.x, centre.y, centre.z],
      distance: distanceFor(halfW, halfH, halfDepth, aspect, fov, fill),
      theta,
      phi,
      fov,
    };
  });

  return null;
}

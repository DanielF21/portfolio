"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { distanceFor, screenHalfExtents } from "@/lib/transformer/camera";
import { OVERVIEW_ID, entryById } from "@/lib/transformer/glossary";
import { useTransformerStore } from "@/lib/transformer/store";
import { view } from "@/lib/transformer/view";

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
 * TIMING. Focus changes, React unmounts the out-of-scope `Scope`s, and only
 * then is the graph the thing we want to measure. So the measurement is
 * deferred to the first frame after the change rather than run in the effect
 * that observes it.
 */

/** Objects flagged this way are never part of a subject: the ground plane, and
 *  anything else that spans the scene rather than sitting in it. */
function measurable(o: THREE.Object3D): boolean {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) {
    // `Box3.setFromObject` reads geometry regardless of `visible`, so hidden
    // things have to be excluded by hand or the plate field is measured while a
    // station is isolated and every close-up frames the whole stack.
    if (!n.visible || n.userData.noFit) return false;
  }
  return true;
}

export function AutoFrame() {
  const scene = useThree((s) => s.scene);
  const focus = useTransformerStore((s) => s.focus);

  const pending = useRef(true);
  const seenRefit = useRef(view.refit);
  const seenSize = useRef<[number, number]>([0, 0]);
  const box = useMemo(() => new THREE.Box3(), []);
  const item = useMemo(() => new THREE.Box3(), []);
  const size = useMemo(() => new THREE.Vector3(), []);
  const centre = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    pending.current = true;
  }, [focus]);

  useFrame(() => {
    // "Reset view" does not necessarily change focus, so it asks by counter.
    if (view.refit !== seenRefit.current) {
      seenRefit.current = view.refit;
      pending.current = true;
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
      if (!measurable(o)) return;
      item.setFromObject(o);
      if (item.isEmpty()) return;
      box.union(item);
      found = true;
    });
    if (!found) return;

    pending.current = false;

    box.getSize(size);
    box.getCenter(centre);

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

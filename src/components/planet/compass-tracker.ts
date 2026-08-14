import * as THREE from "three";

import { compass, COMPASS_SLOTS } from "@/lib/planet/compass";
import { RADIUS } from "@/lib/planet/config";
import type { PlanetMarker } from "@/lib/planet/types";

/**
 * Screen-space direction to the nearest unvisited markers that are not already
 * on screen, written into the three-free `compass` singleton for the DOM
 * overlay to read.
 *
 * This is a function rather than its own <Component> with its own useFrame
 * because `Player` already holds everything it needs (posDir, the camera, the
 * marker directions) and already runs once per frame. A second frame callback
 * would recompute the same state.
 */

/** Height above the surface to aim at: roughly the floating marker body, so
 *  the indicator lines up with what you actually see when it comes into view. */
const AIM_HEIGHT = 1.0;

const view = new THREE.Vector3();
const ndc = new THREE.Vector3();

/** Insertion into the fixed slot array, nearest first. Avoids allocating a
 *  candidate list and sorting it every frame. */
function insert(id: string, label: string, angle: number, distance: number) {
  const slots = compass.slots;
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (s.id !== null && s.distance <= distance) continue;
    for (let j = slots.length - 1; j > i; j--) {
      const dst = slots[j];
      const src = slots[j - 1];
      dst.id = src.id;
      dst.label = src.label;
      dst.angle = src.angle;
      dst.distance = src.distance;
    }
    s.id = id;
    s.label = label;
    s.angle = angle;
    s.distance = distance;
    return;
  }
}

export function updateCompass(
  markers: readonly PlanetMarker[],
  markerDirs: readonly THREE.Vector3[],
  posDir: THREE.Vector3,
  camera: THREE.Camera,
  visited: readonly string[]
) {
  for (let i = 0; i < COMPASS_SLOTS; i++) compass.slots[i].id = null;

  // The caller has just written camera.position/quaternion this frame, so the
  // cached world matrix is a frame stale. Refresh it before projecting or every
  // indicator lags the camera by one frame, which is visible while turning.
  camera.updateMatrixWorld();
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();

  // Aspect ratio, recovered from the projection matrix: m11 = focal/aspect and
  // m22 = focal, so m22/m11 = aspect. The behind-camera branch below needs it
  // to stay continuous with the projected branch (see there).
  const pm = camera.projectionMatrix.elements;
  const aspect = pm[0] !== 0 ? pm[5] / pm[0] : 1;

  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];
    if (visited.includes(marker.id)) continue;

    view
      .copy(markerDirs[i])
      .multiplyScalar(RADIUS + AIM_HEIGHT)
      .applyMatrix4(camera.matrixWorldInverse);

    // View space looks down -Z, so a positive z is behind the camera. Testing
    // this in view space rather than on the projected z is the whole trick:
    // the perspective divide by a negative w silently flips x and y, so a
    // marker behind you projects to the *opposite* screen edge. Reading the
    // sign before the divide is what keeps the arrow pointing the right way.
    const behind = view.z > 0;

    let angle: number;
    if (behind) {
      // No valid projection to fall back on, but view-space x/y are still a
      // correct left/right and up/down bearing.
      //
      // The `aspect` factor is what keeps this continuous with the projected
      // branch. There, angle = atan2(ndc.y, ndc.x), and since ndc.x carries an
      // extra 1/aspect from the projection matrix, ndc.y/ndc.x works out to
      // (view.y * aspect) / view.x. Without the factor, an indicator visibly
      // jumps by up to ~20 degrees at the moment a marker passes 90 degrees
      // off the camera axis.
      angle = Math.atan2(view.y * aspect, view.x);
    } else {
      ndc.copy(view).applyMatrix4(camera.projectionMatrix);
      if (Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1) {
        // On screen. The beacon beam already shows it; an arrow would be noise.
        continue;
      }
      // NDC rather than view space here, so the arrow accounts for aspect ratio
      // and points at where the marker will actually enter the frame.
      angle = Math.atan2(ndc.y, ndc.x);
    }

    // Arc length, not the straight-line chord: the chord understates a target
    // on the far side of the planet by up to 36%, and you have to walk the arc.
    const cos = THREE.MathUtils.clamp(posDir.dot(markerDirs[i]), -1, 1);
    insert(marker.id, marker.label, angle, Math.acos(cos) * RADIUS);
  }
}

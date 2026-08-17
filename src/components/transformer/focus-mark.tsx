"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { ACTIVATION } from "@/lib/transformer/theme";
import { view } from "@/lib/transformer/view";

/**
 * Corner brackets round whatever is focused.
 *
 * WHAT THIS IS FOR. Focusing used to answer "which one did I click" by deleting
 * everything else, which answered it perfectly and destroyed the drawing. Now
 * that the block stays whole, four other things already say where you are (the
 * index selection, the breadcrumb, the status bar and the card), but none of
 * them says it ON the geometry, and a station in a frame with three of its
 * neighbours needs that. This is the one that does.
 *
 * CORNERS, NOT A CAGE. A full wireframe box round a tensor is a second grid over
 * the top of a scene whose whole subject is grids, and at the MLP's 17.5 units it
 * would be the largest set of lines in the shot. Eight corners state the same
 * extent and leave the faces alone; it is also what a viewfinder does, which is
 * the register the rest of the shell is already in.
 *
 * The bounds come from `auto-frame`, so the brackets and the framing are the
 * same measurement rather than two attempts at it. Marked `noFit` so measuring
 * can never end up measuring the marker.
 */

/**
 * Arm length, PER AXIS, as a fraction of that axis' own span.
 *
 * The first version took one arm length from the shortest side of the box and
 * used it on all three, which on a 3 x 5 x 41 station drew twelve tiny crosses
 * scattered across the frame with nothing connecting them: they read as debris
 * rather than as the corners of anything. An arm proportional to the edge it
 * runs along stays a corner at every shape.
 */
const ARM_FRACTION = 0.22;
/** Never so short that a corner reads as a dot, and never past the midpoint, or
 *  opposite arms meet and the brackets close into a cage. */
const ARM_MIN = 0.1;
const ARM_LIMIT = 0.4;

/** How far outside the measured bounds the brackets sit, so they read as marks
 *  around the object rather than as edges of it. */
const INFLATE = 0.14;

/** 8 corners, 3 arms each, 2 points per arm. */
const SEGMENTS = 8 * 3;
const VERTICES = SEGMENTS * 2;

export function FocusMark() {
  const ref = useRef<THREE.LineSegments>(null);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(VERTICES * 3), 3)
    );
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  /** The box the current vertices were built for, so the array is only rewritten
   *  when the focus actually moves rather than sixty times a second. */
  const built = useRef<string>("");

  useFrame(() => {
    const line = ref.current;
    if (!line) return;

    const box = view.focusBox;
    if (!box) {
      line.visible = false;
      built.current = "";
      return;
    }
    line.visible = true;

    const key = box.min.join(",") + "|" + box.max.join(",");
    if (key === built.current) return;
    built.current = key;

    const min = [
      box.min[0] - INFLATE,
      box.min[1] - INFLATE,
      box.min[2] - INFLATE,
    ];
    const max = [
      box.max[0] + INFLATE,
      box.max[1] + INFLATE,
      box.max[2] + INFLATE,
    ];
    const span = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    const arm = span.map((s) =>
      Math.min(s * ARM_LIMIT, Math.max(ARM_MIN, s * ARM_FRACTION))
    );

    const attr = geometry.getAttribute("position") as THREE.BufferAttribute;
    const out = attr.array as Float32Array;
    let k = 0;

    // Every corner is one of the eight (min|max, min|max, min|max) choices, and
    // each grows three arms back along the axes towards the box's centre.
    for (let cx = 0; cx < 2; cx++) {
      for (let cy = 0; cy < 2; cy++) {
        for (let cz = 0; cz < 2; cz++) {
          const corner = [cx ? max[0] : min[0], cy ? max[1] : min[1], cz ? max[2] : min[2]];
          const inward = [cx ? -1 : 1, cy ? -1 : 1, cz ? -1 : 1];
          for (let axis = 0; axis < 3; axis++) {
            out[k++] = corner[0];
            out[k++] = corner[1];
            out[k++] = corner[2];
            out[k++] = corner[0] + (axis === 0 ? inward[0] * arm[0] : 0);
            out[k++] = corner[1] + (axis === 1 ? inward[1] * arm[1] : 0);
            out[k++] = corner[2] + (axis === 2 ? inward[2] * arm[2] : 0);
          }
        }
      }
    }
    attr.needsUpdate = true;
    geometry.computeBoundingSphere();
  });

  return (
    <lineSegments
      ref={ref}
      geometry={geometry}
      visible={false}
      renderOrder={18}
      userData={{ noFit: true }}
    >
      {/* Depth test off. The brackets sit outside the object they mark, so at a
          three quarter angle the far four corners are behind it and would be
          eaten; a bracket that shows only half of itself reads as a glitch
          rather than as a box. Nothing else in the scene draws over geometry,
          so this is the one exception and it is deliberate. */}
      <lineBasicMaterial
        color={ACTIVATION}
        transparent
        opacity={0.9}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  );
}

"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { TEXT } from "@/lib/transformer/theme";
import { view } from "@/lib/transformer/view";

/**
 * Dimension lines on whatever is focused.
 *
 * WHAT THIS IS FOR. Focusing used to answer "which one did I click" by deleting
 * everything else, which answered it perfectly and destroyed the drawing. Now
 * that the block stays whole, the contents list and the detail column both say
 * where you are, but neither says it ON the geometry, and a station in a frame
 * with three of its neighbours needs that. This is the one that does.
 *
 * IT WAS EIGHT VIEWFINDER CORNERS, AND A VIEWFINDER IS A CAMERA'S IDEA. The
 * whole shell around it has stopped being a HUD, and corner brackets were the
 * last piece of that register left inside the scene. A drawing marks an object
 * by DIMENSIONING it: extension lines out from the two ends, a dimension line
 * between them, a tick at each end. Same information, one convention, and it is
 * the convention the geometry is already speaking.
 *
 * TWO AXES, NOT ONE. A single run marks an extent but not an object: on a
 * station standing next to its neighbours, one line along Z says nothing about
 * which of them is meant. The two largest axes give an L that sits under and
 * beside the subject and cannot be read as belonging to anything else.
 *
 * The bounds come from `auto-frame`, so the marks and the framing are the same
 * measurement rather than two attempts at it. Marked `noFit` so measuring can
 * never end up measuring the marker.
 */

/** How far outside the measured bounds the dimension line stands off, as a
 *  fraction of the subject's largest span. A drawing leaves air between the
 *  object and its dimensions; without it the line reads as an edge of the thing
 *  rather than as a measurement of it. */
const OFFSET_FRACTION = 0.09;
const OFFSET_MIN = 0.12;

/** Half length of the end ticks, same units, and of the overshoot past the
 *  extension line. Drafting ticks are slashes, not arrowheads: two points
 *  instead of six, and they read at any size. */
const TICK_FRACTION = 0.045;
const TICK_MIN = 0.09;

/** Per dimension: 2 extension lines, 1 dimension line, 2 ticks. Two dimensions
 *  drawn, so ten segments and twenty points. */
const SEGMENTS = 2 * 5;
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

    const min = [box.min[0], box.min[1], box.min[2]];
    const max = [box.max[0], box.max[1], box.max[2]];
    const span = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    const largest = Math.max(span[0], span[1], span[2]);

    const gap = Math.max(OFFSET_MIN, largest * OFFSET_FRACTION);
    const tick = Math.max(TICK_MIN, largest * TICK_FRACTION);

    // The two axes worth dimensioning, longest first.
    const order = [0, 1, 2].sort((a, b) => span[b] - span[a]);
    const dims = [order[0], order[1]];

    const attr = geometry.getAttribute("position") as THREE.BufferAttribute;
    const out = attr.array as Float32Array;
    let k = 0;
    const seg = (a: number[], b: number[]) => {
      out[k++] = a[0];
      out[k++] = a[1];
      out[k++] = a[2];
      out[k++] = b[0];
      out[k++] = b[1];
      out[k++] = b[2];
    };

    for (const axis of dims) {
      // Stand the dimension off along whichever OTHER axis leaves it clear of
      // the subject: below it when the run is horizontal, beside it when the run
      // is vertical. The remaining axis takes the box's centre, so the mark sits
      // in the subject's own mid plane rather than on a face that may be turned
      // away from the camera.
      const off = axis === 1 ? 0 : 1;
      const third = [0, 1, 2].find((a) => a !== axis && a !== off) as number;
      const offAt = min[off] - gap;
      const thirdAt = (min[third] + max[third]) / 2;

      const at = (along: number, offset: number) => {
        const p = [0, 0, 0];
        p[axis] = along;
        p[off] = offset;
        p[third] = thirdAt;
        return p;
      };

      // Extension lines: from the subject's own corner out to the dimension
      // line, and a little past it, which is what makes the pair read as
      // construction rather than as two stray marks.
      seg(at(min[axis], min[off]), at(min[axis], offAt - tick));
      seg(at(max[axis], min[off]), at(max[axis], offAt - tick));
      // The dimension line itself.
      seg(at(min[axis], offAt), at(max[axis], offAt));
      // Ticks, at 45 degrees across each end.
      seg(at(min[axis] - tick, offAt - tick), at(min[axis] + tick, offAt + tick));
      seg(at(max[axis] - tick, offAt - tick), at(max[axis] + tick, offAt + tick));
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
      {/* Depth test off. The dimensions sit outside the object they mark, so at
          a three quarter angle parts of them pass behind it and would be eaten;
          a dimension line that stops halfway reads as a glitch rather than as a
          measurement. Nothing else in the scene draws over geometry, so this is
          the one exception and it is deliberate. */}
      {/* INK, NOT THE SIGNAL. It used to be drawn in the activation colour, and
          under the palette's new rule that colour means "this changes per
          token": thin orange lines beside a tensor read as more geometry rather
          than as a measurement of it. A drawing dimensions in the same ink it
          annotates in. */}
      <lineBasicMaterial
        color={TEXT}
        transparent
        opacity={0.8}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  );
}

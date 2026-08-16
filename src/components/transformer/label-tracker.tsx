"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";

import { LABEL_SLOTS, view } from "@/lib/transformer/view";

import { anchors } from "./anchor";

/**
 * Projects every live anchor to screen space, once per frame.
 *
 * Writes plain numbers into the `view` singleton. The DOM overlay reads them
 * from its own rAF loop and mutates styles directly, so labels never go through
 * React state; sixty renders a second of a dozen nodes for what is two CSS
 * properties each is the specific thing this architecture exists to avoid. Same
 * split as the planet's compass.
 *
 * DECLUTTER. Labels are sorted near to far and a candidate is dropped when its
 * box would overlap one already placed, so the nearest label wins a contested
 * spot. Without it a station with four parts produces four labels stacked on the
 * same twenty pixels and none of them are readable.
 */

/** Approximate label box in CSS pixels, for the overlap test. Deliberately
 *  generous: a near miss still reads as a collision. */
const LABEL_W = 168;
const LABEL_H = 34;

/**
 * Width assumed when deciding whether a label would run off the right edge.
 *
 * Much larger than `LABEL_W`, because the two are answering different
 * questions. The overlap test wants a typical box; the edge test has to cover
 * the LONGEST sub-line in the piece, and those get long: "64 dimension pairs ·
 * theta 1,000,000 · no parameters" is well over 300px. Reusing 168 here left
 * exactly those labels hanging off the edge with their most interesting half
 * cut off.
 */
const LABEL_FLIP_W = 360;

export function LabelTracker() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const projected = useMemo(() => new THREE.Vector3(), []);
  const placed = useMemo<Array<[number, number]>>(() => [], []);

  useFrame(() => {
    const slots = view.labels;
    const w = size.width;
    const h = size.height;
    view.width = w;
    view.height = h;

    // Project, keeping only what is in front of the camera and on screen.
    const candidates: Array<{
      id: string;
      text: string;
      sub?: string;
      x: number;
      y: number;
      depth: number;
    }> = [];

    for (const a of anchors) {
      a.object.getWorldPosition(projected);
      const depth = projected.distanceTo(camera.position);
      projected.project(camera);
      // z outside [-1, 1] is behind the camera or past the far plane; without
      // this check a point behind you projects to a mirrored position in front.
      if (projected.z < -1 || projected.z > 1) continue;
      const x = (projected.x * 0.5 + 0.5) * w;
      const y = (-projected.y * 0.5 + 0.5) * h;
      if (x < -LABEL_W || x > w + LABEL_W || y < -LABEL_H || y > h + LABEL_H) continue;
      candidates.push({ id: a.id, text: a.text, sub: a.sub, x, y, depth });
    }

    candidates.sort((p, q) => p.depth - q.depth);

    placed.length = 0;
    let n = 0;
    for (const c of candidates) {
      if (n >= LABEL_SLOTS) break;
      const clash = placed.some(
        ([px, py]) => Math.abs(px - c.x) < LABEL_W && Math.abs(py - c.y) < LABEL_H
      );
      if (clash) continue;
      placed.push([c.x, c.y]);

      const slot = slots[n];
      slot.id = c.id;
      slot.text = c.text;
      slot.sub = c.sub ?? "";
      slot.x = c.x;
      slot.y = c.y;
      slot.depth = c.depth;
      slot.opacity = 1;
      // The widest tensors reach the frame edge by design, so their anchors sit
      // there too and a label placed to the right would be cut off.
      slot.flip = c.x + LABEL_FLIP_W > w;
      n += 1;
    }

    for (let i = n; i < slots.length; i++) {
      slots[i].id = null;
      slots[i].opacity = 0;
    }
  });

  return null;
}

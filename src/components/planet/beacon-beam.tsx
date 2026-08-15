"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import {
  DISTRICT_BEACON_HEIGHT,
  MARKER_BEAM_HEIGHT,
  RADIUS,
} from "@/lib/planet/config";
import { usePlanetStore } from "@/lib/planet/store";

/**
 * A shaft of light rising from an unvisited marker.
 *
 * Navigation on the island planet is two-tier: tall district beacons (see
 * `scenery.tsx`) are the cross-planet signal, and these short per-marker beams
 * are in-island signposts. At R = 10.8 a tip at R + 3 clears the horizon from
 * acos(10.8/13.8) = 0.67 rad away, a little beyond the island falloff: exactly
 * the "you have arrived, here are the things" range.
 */

const BASE_RADIUS = 0.085;
const TOP_RADIUS = 0.02;

/** Beams of the same height share one geometry (there are only two heights:
 *  marker and district tier). Created lazily rather than at module scope so
 *  importing this file has no side effect on the GPU; never disposed by
 *  design. */
const cachedGeometry = new Map<number, THREE.CylinderGeometry>();

function beamGeometry(height: number): THREE.CylinderGeometry {
  const cached = cachedGeometry.get(height);
  if (cached) return cached;

  const geo = new THREE.CylinderGeometry(
    TOP_RADIUS,
    BASE_RADIUS * (height / MARKER_BEAM_HEIGHT), // taller beams get wider bases
    height,
    8,
    1,
    true // open ended: caps would show as bright discs from above
  );
  // Origin at the base rather than the centre, so the mesh can sit directly on
  // the marker's local origin and grow outward along the surface normal.
  geo.translate(0, height / 2, 0);

  // Bake a vertical fade into vertex colours. Under additive blending, black
  // is fully transparent, so this dissolves the top of the shaft into the sky
  // instead of ending it in a hard cut.
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / height; // 0 at the base, 1 at the tip
    const v = Math.max(0, 1 - t * t); // quadratic: holds near the ground, then drops
    colors[i * 3] = v;
    colors[i * 3 + 1] = v;
    colors[i * 3 + 2] = v;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  cachedGeometry.set(height, geo);
  return geo;
}

interface Props {
  /** The beam fades out once EVERY listed marker is visited. A single-entry
   *  array gives the per-marker behaviour; a district beacon lists all of its
   *  district's markers. */
  ids: readonly string[];
  color: string;
  height?: number;
}

export function BeaconBeam({ ids, color, height = MARKER_BEAM_HEIGHT }: Props) {
  const mesh = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => beamGeometry(height), [height]);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide, // open-ended cylinder seen from inside and out
        toneMapped: false,
      }),
    [color]
  );

  // Not disposed on unmount by design for the geometry (shared singleton); the
  // material is per-beam and R3F disposes it with the mesh.

  const scratch = useRef({ current: 0 });

  useFrame((state, delta) => {
    const m = mesh.current;
    if (!m) return;

    // Read without subscribing, matching MarkerMesh: no re-render coupling.
    const visitedList = usePlanetStore.getState().visited;
    // An empty id list means the beam tracks nothing to complete, so it burns
    // permanently as a landmark. This is the district-beacon case now that the
    // world ships no markers: without the guard the loop below would vacuously
    // conclude "all visited" and fade all four island beacons out.
    let visited = ids.length > 0;
    for (const id of ids) {
      if (!visitedList.includes(id)) {
        visited = false;
        break;
      }
    }
    const s = scratch.current;
    const target = visited ? 0 : 1;
    // Framerate-independent damping.
    s.current +=
      (target - s.current) * (1 - Math.exp(-3 * Math.min(delta, 1 / 30)));

    if (s.current < 0.002) {
      m.visible = false;
      return;
    }
    m.visible = true;

    const pulse = 0.82 + Math.sin(state.clock.elapsedTime * 1.6) * 0.18;
    material.opacity = 0.5 * s.current * pulse;
  });

  return (
    <mesh
      ref={mesh}
      geometry={geometry}
      material={material}
      // Below the labels (10) so a label is never dimmed by a beam drawn over it.
      renderOrder={5}
      // The beam is thin and always vertical; frustum culling against its
      // bounding box is correct here, but the box is tall, so leave it on.
      position={[0, 0.06, 0]}
    />
  );
}

/** Angular distance from which a district beacon tip clears the horizon, in
 *  radians. Exported for the navigation coverage check. */
export const BEAM_VISIBLE_ANGLE = Math.acos(
  RADIUS / (RADIUS + DISTRICT_BEACON_HEIGHT)
);

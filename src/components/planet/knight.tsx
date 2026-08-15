"use client";

import { Clone, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { ASSETS } from "@/lib/planet/asset-manifest";
import { RADIUS } from "@/lib/planet/config";
import { knightAt } from "@/lib/planet/knight";
import { resolveSceneryDir, SCENERY } from "@/lib/planet/world-layout";

import { fixGltfMaterials } from "./gltf-fixup";

/**
 * The chess knight, drawn where `lib/planet/knight.ts` says it is.
 *
 * Its own component rather than a `SCENERY` row, for the same reason the rocket
 * and the ship have theirs: the row is authored placement, and this thing moves.
 * The row still supplies the anchor, the heading and the keep-out, so the board
 * it hops around stays where the layout put it.
 *
 * The hop is composed as bend-then-lift: `bendMatrix` carries the piece to its
 * square along the surface, and the lift is applied after, along the local up at
 * that square. Lifting first would raise it along the up of the square it came
 * from, which over two squares of travel is a visible lean.
 */
export function Knight() {
  const item = useMemo(() => SCENERY.find((s) => s.id === "knight"), []);
  const group = useRef<THREE.Group>(null);

  const anchor = useMemo(
    () => (item ? resolveSceneryDir(item) : { x: 0, y: 1, z: 0 }),
    [item]
  );

  const url = item ? (ASSETS[item.asset]?.url as string) : "";
  const { scene } = useGLTF(url);
  useEffect(() => {
    if (scene) fixGltfMaterials(scene);
  }, [scene]);

  const scratch = useMemo(
    () => ({
      up: new THREE.Vector3(),
      UP: new THREE.Vector3(0, 1, 0),
      heading: new THREE.Quaternion(),
    }),
    []
  );

  useFrame((state) => {
    const g = group.current;
    if (!g || !item) return;
    const pose = knightAt(anchor, RADIUS, state.clock.elapsedTime);

    // Placed on the sphere from scratch each frame rather than nudged from a
    // parent transform, so the piece stands up straight on whichever square it
    // is on. Two squares of travel is 0.17 rad, at which a fixed orientation is
    // a visible lean.
    scratch.up.set(pose.dir.x, pose.dir.y, pose.dir.z);
    g.position
      .copy(scratch.up)
      .multiplyScalar(RADIUS - (item.sink ?? 0) + pose.lift);
    g.quaternion
      .setFromUnitVectors(scratch.UP, scratch.up)
      .multiply(scratch.heading.setFromAxisAngle(scratch.UP, item.heading));
  });

  if (!item || !url) return null;

  return (
    <group ref={group} scale={item.scale}>
      <Clone object={scene} />
    </group>
  );
}

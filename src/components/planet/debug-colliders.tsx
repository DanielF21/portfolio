"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";

import { RADIUS } from "@/lib/planet/config";

import type { Collider } from "./colliders";

/**
 * Draws every collider as a ring on the surface, behind the `?colliders` query
 * flag (same test-hook convention as `?lowpower`, see lib/device.ts).
 *
 * This exists to make a design decision answerable by looking instead of by
 * argument: whether scattered trees and boulders should block the player, or
 * only the authored landmarks should. Walk around with it on and the answer is
 * obvious in a way it is not from a list of numbers.
 *
 * One InstancedMesh, so several hundred rings cost a single draw call. Rings
 * are colour-coded by whether the prop can be jumped.
 */

const UP = new THREE.Vector3(0, 1, 0);

/** Jump apex, from JUMP_VELOCITY^2 / (2 * GRAVITY). Anything shorter than this
 *  is clearable, and gets a different colour. */
const JUMP_APEX = 1.19;

export function DebugColliders({ colliders }: { colliders: readonly Collider[] }) {
  const mesh = useMemo(() => {
    // A flat annulus, lifted just off the surface so it does not z-fight.
    const geometry = new THREE.RingGeometry(0.86, 1, 24);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshBasicMaterial({
      // NOT vertexColors: RingGeometry has no baked colour attribute, and
      // enabling it makes the shader read one that is not there and come out
      // black. InstancedMesh.setColorAt drives the tint on its own.
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });

    const im = new THREE.InstancedMesh(geometry, material, colliders.length);
    const dir = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const m = new THREE.Matrix4();
    const jumpable = new THREE.Color(0.2, 0.9, 0.4);
    const solid = new THREE.Color(1, 0.35, 0.3);

    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      dir.set(c.x, c.y, c.z);
      // The cap's radius on the surface is R * sin(angular radius), which is
      // exactly what sinR already holds.
      const ringRadius = RADIUS * c.sinR;
      quat.setFromUnitVectors(UP, dir);
      pos.copy(dir).multiplyScalar(RADIUS + 0.04);
      scl.setScalar(ringRadius);
      im.setMatrixAt(i, m.compose(pos, quat, scl));
      im.setColorAt(i, c.height < JUMP_APEX ? jumpable : solid);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.frustumCulled = false;
    im.renderOrder = 20;
    return im;
  }, [colliders]);

  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    },
    [mesh]
  );

  return <primitive object={mesh} />;
}

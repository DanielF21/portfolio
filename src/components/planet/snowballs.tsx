"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { snowSmack } from "@/lib/planet/audio";
import { RADIUS, SNOWBALL_POOL } from "@/lib/planet/config";
import {
  resetSnowballs,
  snowballs,
  SPLAT_S,
  stepSnowballs,
} from "@/lib/planet/snowballs";

/**
 * Snowballs in the air.
 *
 * One InstancedMesh for the whole pool, dead slots scaled to zero. The flight
 * itself lives in `lib/planet/snowballs.ts` and is stepped from here, which is
 * the same split as the ship: the maths is three-free and testable, and this
 * file only reads the result onto matrices.
 *
 * The landing is a scale-and-flatten rather than a particle burst: a snowball
 * that pops into a splat and squashes into the ground costs nothing beyond the
 * matrix already being written, and a particle system for one event would be a
 * lot of machinery for half a second of snow.
 */
export function Snowballs() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const lastStruck = useRef(-1e9);
  const geometry = useMemo(() => new THREE.SphereGeometry(0.11, 7, 5), []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0.86, 0.88, 0.93),
        roughness: 0.85,
        flatShading: true,
      }),
    []
  );

  const scratch = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      p: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      s: new THREE.Vector3(),
      up: new THREE.Vector3(),
      UP: new THREE.Vector3(0, 1, 0),
    }),
    []
  );

  useEffect(() => {
    // A snowball left in the air when the stage unmounts would still be there
    // on the next visit, since the pool outlives the component.
    resetSnowballs();
    return () => {
      resetSnowballs();
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((state, delta) => {
    const m = mesh.current;
    if (!m) return;
    const now = state.clock.elapsedTime;
    stepSnowballs(Math.min(delta, 0.05), RADIUS, now);

    // The simulation records that something was struck; the sound is played
    // here, so `snowballs.ts` stays free of everything that is not the flight.
    if (snowballs.struckAt > lastStruck.current) {
      lastStruck.current = snowballs.struckAt;
      snowSmack();
    }

    for (let i = 0; i < snowballs.pool.length; i++) {
      const b = snowballs.pool[i];
      if (!b.live) {
        scratch.m.makeScale(0, 0, 0);
        m.setMatrixAt(i, scratch.m);
        continue;
      }
      scratch.up.set(b.dir.x, b.dir.y, b.dir.z);
      scratch.p.copy(scratch.up).multiplyScalar(RADIUS + b.alt + 0.11);
      scratch.q.setFromUnitVectors(scratch.UP, scratch.up);
      if (b.splat >= 0) {
        // Flatten and fade out where it hit.
        const t = 1 - b.splat / SPLAT_S;
        scratch.s.set(1 + (1 - t) * 0.9, t * 0.35, 1 + (1 - t) * 0.9);
      } else {
        scratch.s.setScalar(1);
      }
      scratch.m.compose(scratch.p, scratch.q, scratch.s);
      m.setMatrixAt(i, scratch.m);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, SNOWBALL_POOL]}
      frustumCulled={false}
    />
  );
}

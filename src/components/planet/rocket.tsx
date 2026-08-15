"use client";

import { Clone, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { ASSETS } from "@/lib/planet/asset-manifest";
import { RADIUS } from "@/lib/planet/config";
import {
  rocketAltitude,
  rocketShake,
  rocketThrust,
} from "@/lib/planet/setpieces";
import { resolveSceneryDir, SCENERY } from "@/lib/planet/world-layout";

import { fixGltfMaterials } from "./gltf-fixup";
import { AssetErrorBoundary } from "./marker-asset";

/**
 * The rocket, and the only thing in the world that moves because the visitor
 * asked it to.
 *
 * Rendered here instead of by `Scenery` because it animates, but it is still
 * placed from its `SCENERY` entry: the pad it sits on, the scatter keep-out
 * around it, its collider and its interaction radius all read that one row.
 *
 * Every transform is a pure function of the clock and `setpieces.rocketLaunchAt`
 * (see lib/planet/setpieces.ts), so there is no animation state here to get
 * out of sync, and unmounting mid-flight leaves nothing behind.
 */

const UP = new THREE.Vector3(0, 1, 0);

function useRocketPlacement() {
  return useMemo(() => {
    const item = SCENERY.find((s) => s.id === "rocket")!;
    const d = resolveSceneryDir(item);
    const dir = new THREE.Vector3(d.x, d.y, d.z);
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(UP, item.heading));
    return {
      dir,
      quaternion: q,
      scale: item.scale,
      sink: item.sink ?? 0,
    };
  }, []);
}

/** Exhaust: a bright core cone with a wider, dimmer flare around it. Additive
 *  and depth-write-free, so it never punches a hole in anything behind it. */
function Plume() {
  return (
    <>
      <mesh position={[0, -1.1, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.5, 2.4, 10, 1, true]} />
        <meshBasicMaterial
          color="#ffd9a0"
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, -1.9, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.95, 4.2, 10, 1, true]} />
        <meshBasicMaterial
          color="#ff7a3c"
          transparent
          opacity={0.32}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </>
  );
}

function RocketBody() {
  const place = useRocketPlacement();
  const { scene } = useGLTF(ASSETS.rocket.url as string);

  const outer = useRef<THREE.Group>(null);
  const plume = useRef<THREE.Group>(null);

  useEffect(() => {
    fixGltfMaterials(scene);
  }, [scene]);

  useFrame((state) => {
    const g = outer.current;
    if (!g) return;
    const now = state.clock.elapsedTime;

    const { y, visible } = rocketAltitude(now);
    const shake = rocketShake(now);
    const thrust = rocketThrust(now);

    g.visible = visible;
    if (!visible) {
      if (plume.current) plume.current.visible = false;
      return;
    }

    // Climb straight up the surface normal. Sitting on the pad is just y = 0,
    // so the idle case needs no special path.
    g.position
      .copy(place.dir)
      .multiplyScalar(RADIUS - place.sink + y);

    // Held down and straining before release. Applied to POSITION only, never
    // to the quaternion, so the rocket never appears to tip off its pad.
    if (shake > 0) {
      const s = shake * 0.06;
      g.position.x += (Math.random() - 0.5) * s;
      g.position.y += (Math.random() - 0.5) * s;
      g.position.z += (Math.random() - 0.5) * s;
    }

    if (plume.current) {
      plume.current.visible = thrust > 0.02;
      // Flicker, so the flame is not a smooth cone being scaled.
      const flick = 0.85 + Math.random() * 0.3;
      plume.current.scale.set(
        thrust * flick,
        thrust * (0.6 + Math.random() * 0.7),
        thrust * flick
      );
    }
  });

  return (
    <group ref={outer} quaternion={place.quaternion} scale={place.scale}>
      <Clone object={scene} />
      <group ref={plume} visible={false}>
        <Plume />
      </group>
    </group>
  );
}

export function Rocket() {
  return (
    // A missing model costs the set piece, not the page.
    <AssetErrorBoundary fallback={null}>
      <RocketBody />
    </AssetErrorBoundary>
  );
}

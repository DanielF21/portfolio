"use client";

import { Clone, useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { ASSETS } from "@/lib/planet/asset-manifest";
import { DISTRICT_BEACON_HEIGHT, RADIUS } from "@/lib/planet/config";
import { ACCENT_BY_DISTRICT, DISTRICT_BY_ID } from "@/lib/planet/districts";
import { placeOnSphere } from "@/lib/planet/layout";
import {
  BEACON_ANCHORS,
  resolveSceneryDir,
  SCENERY,
  type SceneryItem,
} from "@/lib/planet/world-layout";
import type { DistrictId, PlanetMarker } from "@/lib/planet/types";

import { BeaconBeam } from "./beacon-beam";
import { AssetErrorBoundary } from "./marker-asset";

/**
 * Everything authored and inert: hero buildings, the pavilion, mountains,
 * plus the four district beacons. Deliberately none of it carries the
 * pad/glow/label vocabulary; that belongs to content only.
 */

const UP = new THREE.Vector3(0, 1, 0);

/** Static surface transform for one item, computed once. */
function useSurfaceTransform(item: SceneryItem) {
  return useMemo(() => {
    const d = resolveSceneryDir(item);
    const dir = new THREE.Vector3(d.x, d.y, d.z);
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
    const headingQ = new THREE.Quaternion().setFromAxisAngle(UP, item.heading);
    q.multiply(headingQ); // heading spins about the LOCAL up axis
    // Sink below the surface: a wide flat base only touches the sphere at
    // its centre, so the rim of an unsunk model hovers over the curvature.
    return {
      position: dir.multiplyScalar(RADIUS - (item.sink ?? 0)),
      quaternion: q,
    };
  }, [item]);
}

function GltfScenery({ item }: { item: SceneryItem }) {
  const def = ASSETS[item.asset];
  const { position, quaternion } = useSurfaceTransform(item);
  const { scene } = useGLTF(def.url as string);

  // glTF defaults metallicFactor to 1 when omitted; fully metallic surfaces
  // render black without an environment map. Clamp on the shared materials
  // (idempotent, so multiple Clone instances are fine).
  useEffect(() => {
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial;
        if (typeof std.metalness === "number" && std.metalness > 0.25) {
          std.metalness = 0.25;
          if (typeof std.roughness === "number" && std.roughness < 0.5) {
            std.roughness = 0.5;
          }
        }
      }
    });
  }, [scene]);

  return (
    <group position={position} quaternion={quaternion} scale={item.scale}>
      <Clone object={scene} />
    </group>
  );
}

/** A walk-around mountain: a merged cluster of cones. Flat sphere stays flat;
 *  this is a prop, not terrain. */
function Mountain({ item }: { item: SceneryItem }) {
  const { position, quaternion } = useSurfaceTransform(item);

  const geometry = useMemo(() => {
    const parts = [
      new THREE.ConeGeometry(2.6, 7.2, 7),
      new THREE.ConeGeometry(1.9, 4.8, 6).translate(1.7, -1, 0.4),
      new THREE.ConeGeometry(1.5, 3.6, 6).translate(-1.5, -1.6, -0.7),
      new THREE.ConeGeometry(1.1, 2.5, 5).translate(0.4, -2.2, 1.6),
    ];
    // Cone origins are their centres. Lift the cluster so the main base sits
    // HALF A UNIT BELOW local zero: a wide flat base only touches a sphere at
    // its centre point, so without this sink the skirts hover visibly above
    // the curved ground.
    for (const p of parts) p.translate(0, 3.1, 0);
    const merged = mergeGeometries(parts);
    for (const p of parts) p.dispose();
    return merged;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      geometry={geometry}
      position={position}
      quaternion={quaternion}
      scale={item.scale}
    >
      <meshStandardMaterial color="#5c5f6e" roughness={0.95} flatShading />
    </mesh>
  );
}

function DistrictBeacon({
  district,
  markers,
}: {
  district: DistrictId;
  markers: readonly PlanetMarker[];
}) {
  const ids = useMemo(
    () => markers.filter((m) => m.district === district).map((m) => m.id),
    [markers, district]
  );

  const { position, quaternion } = useMemo(() => {
    const anchor = BEACON_ANCHORS[district];
    const d = placeOnSphere(DISTRICT_BY_ID[district].centre, anchor.bearing, anchor.arc);
    const dir = new THREE.Vector3(d.x, d.y, d.z);
    return {
      position: dir.clone().multiplyScalar(RADIUS),
      quaternion: new THREE.Quaternion().setFromUnitVectors(UP, dir),
    };
  }, [district]);

  return (
    <group position={position} quaternion={quaternion}>
      <BeaconBeam
        ids={ids}
        color={ACCENT_BY_DISTRICT[district]}
        height={DISTRICT_BEACON_HEIGHT}
      />
    </group>
  );
}

export function Scenery({ markers }: { markers: readonly PlanetMarker[] }) {
  return (
    <>
      {SCENERY.map((item, i) =>
        item.asset === "proc:mountain" ? (
          <Mountain key={i} item={item} />
        ) : (
          // A missing scenery model simply doesn't render; nothing depends
          // on it.
          <AssetErrorBoundary key={i} fallback={null}>
            <GltfScenery item={item} />
          </AssetErrorBoundary>
        )
      )}

      {(Object.keys(BEACON_ANCHORS) as DistrictId[]).map((d) => (
        <DistrictBeacon key={d} district={d} markers={markers} />
      ))}
    </>
  );
}

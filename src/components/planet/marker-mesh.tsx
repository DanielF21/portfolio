"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import { ASSETS } from "@/lib/planet/asset-manifest";
import { RADIUS } from "@/lib/planet/config";
import { ACCENT_BY_DISTRICT } from "@/lib/planet/districts";
import { usePlanetStore } from "@/lib/planet/store";
import type { PlanetMarker } from "@/lib/planet/types";
import { BeaconBeam } from "./beacon-beam";
import { LabelSprite } from "./label-sprite";
import { MarkerBody, type FadeEntry } from "./marker-asset";

const UP = new THREE.Vector3(0, 1, 0);

/** Where a visited marker's colour lands. Desaturated and dim, so a glance at
 *  the surface tells you what is left without reading the HUD counter. */
const VISITED_COLOR = "#64748b";

interface Props {
  marker: PlanetMarker;
  index: number;
}

export function MarkerMesh({ marker, index }: Props) {
  const isProject = marker.content.kind === "project";
  // The accent is the district's, not the kind's: a visitor learns "amber
  // things are the House, violet things are the Gallery" by walking around.
  const color = ACCENT_BY_DISTRICT[marker.district];
  const asset = ASSETS[marker.assetId] ?? ASSETS.fallback;
  // Building-like bodies sit on the pad; the rest hover as pickups.
  const grounded = asset.grounded === true;

  const bodyRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  // Fade-able materials, registered by whichever body (GLTF or procedural)
  // is actually mounted. See marker-asset.tsx for the contract.
  const matsRef = useRef<FadeEntry[]>([]);

  // Static placement: computed once, no per-frame work.
  const { position, quaternion } = useMemo(() => {
    const dir = new THREE.Vector3(marker.dir.x, marker.dir.y, marker.dir.z).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
    // setFromUnitVectors handles the antiparallel (south pole) case internally,
    // so no NaN quaternion here.
    return { position: dir.multiplyScalar(RADIUS), quaternion: q };
  }, [marker.dir]);

  const bobOffset = useMemo(() => index * 1.37, [index]);
  const scratch = useRef({ target: 0, current: 0, visited: 0 });

  // Endpoint of the visited colour blend, built once. Each fade entry carries
  // its own live colour (a GLTF body has one per material).
  const deadColor = useMemo(() => new THREE.Color(VISITED_COLOR), []);

  useFrame((state, delta) => {
    const body = bodyRef.current;
    if (!body) return;

    const t = state.clock.elapsedTime;
    const step = 1 - Math.exp(-8 * Math.min(delta, 1 / 30));

    // Read the store without subscribing: no re-render coupling.
    const store = usePlanetStore.getState();
    const near = store.nearbyId === marker.id;
    const isVisited = store.visited.includes(marker.id);

    const s = scratch.current;
    s.target = near ? 1 : 0;
    // Framerate-independent damping.
    s.current += (s.target - s.current) * step;
    s.visited += ((isVisited ? 1 : 0) - s.visited) * step;

    // A visited marker stops bobbing and settles onto its pad, which reads as
    // "done" from a distance without needing the label. Grounded bodies are
    // already planted, so they neither bob nor settle.
    const rest = 1 - s.visited;
    if (!grounded) {
      body.position.y =
        0.9 - s.visited * 0.32 + Math.sin(t * 1.2 + bobOffset) * 0.07 * rest;
      body.rotation.y = t * 0.55 * rest + bobOffset;
    }

    const scale = 1 + s.current * 0.35 - s.visited * 0.2;
    body.scale.setScalar(scale);

    for (const entry of matsRef.current) {
      entry.mat.color.copy(entry.live).lerp(deadColor, s.visited);
      if (entry.emissive) {
        entry.mat.emissive.copy(entry.live).lerp(deadColor, s.visited);
        // Kept modest: pushing this much past 1 washes the hue out to white
        // and loses the district colour distinction exactly when you are
        // closest to it.
        entry.mat.emissiveIntensity =
          (0.45 + s.current * 0.75) * (1 - s.visited * 0.75);
      }
    }

    if (glowRef.current) {
      glowRef.current.scale.setScalar(1 + s.current * 0.6);
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity =
        (0.12 + s.current * 0.3) * (1 - s.visited);
    }
  });

  return (
    <group position={position} quaternion={quaternion}>
      {/* Pad, sits flush on the surface. */}
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.45, 0.55, 0.12, 20]} />
        <meshStandardMaterial color="#2b3358" roughness={0.8} metalness={0.1} />
      </mesh>

      {/* Soft glow disc under the floating body. */}
      <mesh ref={glowRef} position={[0, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.55, 24]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.12}
          depthWrite={false}
        />
      </mesh>

      {/* The body: hovering pickup by default, planted on the pad when the
          asset is grounded. Pad + glow + label carry the interactive-object
          vocabulary either way. */}
      <group ref={bodyRef} position={[0, grounded ? 0.13 : 0.9, 0]}>
        <MarkerBody
          assetId={marker.assetId}
          accent={color}
          isProject={isProject}
          matsRef={matsRef}
        />
      </group>

      <BeaconBeam ids={[marker.id]} color={color} />

      <LabelSprite
        text={marker.label}
        position={[0, asset.labelHeight, 0]}
        height={0.34}
      />
    </group>
  );
}

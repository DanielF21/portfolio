"use client";

import { Canvas } from "@react-three/fiber";
import { useEffect, useRef } from "react";

import {
  CAM_FAR,
  CAM_FOV,
  CAM_NEAR,
  DPR_HIGH,
  DPR_LOW,
} from "@/lib/planet/config";
import { attachDrag, attachKeyboard } from "@/lib/planet/input";
import type { PlanetMarker, SpawnPoint } from "@/lib/planet/types";

import { Sky } from "./sky";
import { World } from "./world";

/**
 * This module is the code-splitting boundary for three.js. It is only ever
 * reached through `dynamic(..., { ssr: false })`, so `three` never lands in the
 * server bundle or the initial client chunk.
 */

interface Props {
  markers: readonly PlanetMarker[];
  spawn: SpawnPoint;
  lowPower: boolean;
  onContextLost: () => void;
}

export default function Scene({
  markers,
  spawn,
  lowPower,
  onContextLost,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const release = attachKeyboard();
    return release;
  }, []);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    return attachDrag(el);
  }, []);

  // sceneReady is NOT set here. It flips inside <World> only after all asset
  // suspensions have resolved and a frame has rendered; a mount-time flip
  // would hide the 2D page while models are still in flight.

  return (
    <div
      ref={hostRef}
      className="absolute inset-0 touch-none select-none"
      style={{ cursor: "grab" }}
    >
      <Canvas
        dpr={lowPower ? DPR_LOW : DPR_HIGH}
        camera={{ fov: CAM_FOV, near: CAM_NEAR, far: CAM_FAR, position: [0, 0, 20] }}
        gl={{ antialias: !lowPower, powerPreference: "high-performance" }}
        frameloop="always"
        onCreated={({ gl }) => {
          const canvas = gl.domElement;
          canvas.addEventListener(
            "webglcontextlost",
            (e) => {
              // Without preventDefault the context can never be restored, but
              // we bail to the 2D fallback either way.
              e.preventDefault();
              onContextLost();
            },
            { once: true }
          );
        }}
      >
        <color attach="background" args={["#070b1c"]} />

        {/* Two lights, both effectively free. No shadow maps: on a sphere the
            player orbits, the shadow camera would have to follow a changing up
            vector for a result nobody looks at. */}
        <hemisphereLight intensity={0.55} color="#bcd8ff" groundColor="#241d3d" />
        <directionalLight position={[14, 10, 8]} intensity={1.5} />
        <ambientLight intensity={0.25} />

        {!lowPower && <Sky />}

        <World markers={markers} spawn={spawn} lowPower={lowPower} />
      </Canvas>
    </div>
  );
}

"use client";

import { useProgress } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";

import { SPHERE_DETAIL_HIGH, SPHERE_DETAIL_LOW } from "@/lib/planet/config";
import { usePlanetStore } from "@/lib/planet/store";
import type { PlanetMarker, SpawnPoint } from "@/lib/planet/types";

import { MarkerMesh } from "./marker-mesh";
import { PlanetMesh } from "./planet-mesh";
import { Player } from "./player";
import { Scatter } from "./scatter";
import { Scenery } from "./scenery";

/**
 * Everything that depends on fetched assets, behind one Suspense boundary.
 *
 * The whole world appears at once: while any marker's GLTF is still in
 * flight, nothing here is mounted, the 2D page stays visible underneath, and
 * the loading pill (driven by ProgressBridge below) reports progress.
 * `sceneReady` flips only after the suspensions have resolved AND a frame has
 * actually rendered, so the canvas never takes over ahead of its content.
 */

interface Props {
  markers: readonly PlanetMarker[];
  spawn: SpawnPoint;
  lowPower: boolean;
}

/** Bridges drei's loading-manager progress into the three-free store the DOM
 *  overlay reads. Lives outside the Suspense boundary so it renders (and
 *  updates) while the world is still pending. */
function ProgressBridge() {
  const progress = useProgress((s) => s.progress);
  const setLoadProgress = usePlanetStore((s) => s.setLoadProgress);
  useEffect(() => {
    setLoadProgress(progress);
  }, [progress, setLoadProgress]);
  return null;
}

/** Dev-only: publishes renderer stats so the perf check can read draw calls
 *  without guessing, plus a scene handle so object transforms can be
 *  inspected from the console even when rAF is throttled. */
function DevStats() {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__planetScene = scene;
    return () => {
      delete (window as unknown as Record<string, unknown>).__planetScene;
    };
  }, [scene]);

  useFrame(({ gl }) => {
    (window as unknown as Record<string, unknown>).__planetDraws = {
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
    };
  });
  return null;
}

/** Mounts only once every sibling suspension has resolved; flips sceneReady
 *  after the second rendered frame so the swap from the 2D page happens onto
 *  a fully painted scene, never a blank canvas. */
function SceneReadySignal() {
  const frames = useRef(0);

  useEffect(
    () => () => usePlanetStore.getState().setSceneReady(false),
    []
  );

  useFrame(() => {
    frames.current++;
    if (frames.current === 2) usePlanetStore.getState().setSceneReady(true);
  });

  return null;
}

export function World({ markers, spawn, lowPower }: Props) {
  const detail = lowPower ? SPHERE_DETAIL_LOW : SPHERE_DETAIL_HIGH;

  return (
    <>
      <ProgressBridge />
      <Suspense fallback={null}>
        <PlanetMesh detail={detail} />

        <Scatter markers={markers} lowPower={lowPower} />

        <Scenery markers={markers} />

        {markers.map((m, i) => (
          <MarkerMesh key={m.id} marker={m} index={i} />
        ))}

        <Player markers={markers} spawn={spawn} />

        <SceneReadySignal />
        {process.env.NODE_ENV !== "production" && <DevStats />}
      </Suspense>
    </>
  );
}

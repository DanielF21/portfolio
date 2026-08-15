"use client";

import { useProgress } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";

import {
  SCATTER_HIGH,
  SCATTER_LOW,
  SPHERE_DETAIL_HIGH,
  SPHERE_DETAIL_LOW,
} from "@/lib/planet/config";
import { assertDistrictsSeparated } from "@/lib/planet/districts";
import { usePlanetStore } from "@/lib/planet/store";
import type { PlanetMarker, SpawnPoint } from "@/lib/planet/types";

import {
  RADIUS,
  TRAMPOLINE_HEIGHT,
  TRAMPOLINE_RADIUS,
} from "@/lib/planet/config";
import { deckPoints as spanDeckPoints, SPANS } from "@/lib/planet/spans";
import { resolveSceneryDir, SCENERY } from "@/lib/planet/world-layout";

import { Bridges } from "./bridges";
import {
  angularRadius,
  makePlatform,
  sceneryColliders,
  type Platform,
} from "./colliders";
import { PirateShip } from "./pirate-ship";
import { Rocket } from "./rocket";
import { DebugColliders } from "./debug-colliders";
import { Knight } from "./knight";
import { MarkerMesh } from "./marker-mesh";
import { PlanetMesh } from "./planet-mesh";
import { Player } from "./player";
import { buildPlacement, Scatter } from "./scatter";
import { Scenery } from "./scenery";
import { Snowballs } from "./snowballs";
import { Water } from "./water";
import { Wildlife } from "./wildlife";

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

  // Placement is built HERE rather than inside <Scatter> so that the meshes
  // and the colliders come from one pass over one candidate list. Deriving
  // them separately would let the props you see and the props you cannot walk
  // through drift apart, which is the kind of bug that is invisible in code
  // review and maddening in play.
  const placement = useMemo(
    () => buildPlacement(markers, lowPower ? SCATTER_LOW : SCATTER_HIGH),
    [markers, lowPower]
  );

  const colliders = useMemo(
    () => [...sceneryColliders(), ...placement.colliders],
    [placement]
  );

  // Walkable surfaces, built from the SAME data the bridge geometry is built
  // from (lib/planet/spans.ts). That is the whole reason that module exists as
  // data rather than as numbers inline in the component: a deck you can see but
  // not stand on, or stand on but not see, is the failure mode here.
  //
  // The ship's decks are NOT here. They sail, so they cannot be baked into an
  // array built once at mount; `player.tsx` reads them live from
  // `shipDeckHeightAt` instead, off the same `SHIP` constants.
  const platforms = useMemo(() => {
    const out: Platform[] = [];
    for (const def of SPANS) {
      for (const p of spanDeckPoints(def)) {
        out.push(makePlatform(p, angularRadius(def.deckRadius), def.deckHeight, 0.5));
      }
    }
    // The trampoline's mat, from the same constants `scenery.tsx` draws it
    // with. A long ramp, because the edge of a trampoline really is a slope you
    // step up rather than a lip you climb.
    const tramp = SCENERY.find((s) => s.id === "trampoline");
    if (tramp) {
      out.push(
        makePlatform(
          resolveSceneryDir(tramp),
          angularRadius(TRAMPOLINE_RADIUS),
          TRAMPOLINE_HEIGHT,
          0.55
        )
      );
    }
    return out;
  }, []);

  const showColliders =
    process.env.NODE_ENV !== "production" &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("colliders");

  // The layout guard has to be called from somewhere, and this is the one
  // component that mounts exactly once per world. Overlapping island cores
  // would silently corrupt the shoreline gradient in biome.ts, which takes the
  // max weight and documents that cores never overlap.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") assertDistrictsSeparated();
  }, []);

  // Dev-only: publish the collider set so penetration can be checked exactly
  // from the console rather than judged by eye.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as Record<string, unknown>).__planetColliders = colliders;
    return () => {
      delete (window as unknown as Record<string, unknown>).__planetColliders;
    };
  }, [colliders]);

  return (
    <>
      <ProgressBridge />
      <Suspense fallback={null}>
        <PlanetMesh detail={detail} />

        {/* Skipped on the low-power path: it is the one piece of geometry here
            that animates every frame in the vertex shader. */}
        {!lowPower && <Water />}

        <Scatter placement={placement} />

        <Scenery markers={markers} />

        <Bridges />

        <PirateShip />

        <Rocket />

        <Knight />

        {/* Kept on the low-power path, unlike the wildlife: this one is
            something the player did, not decoration. */}
        <Snowballs />

        {/* Skipped on the low-power path: three more animated instanced
            meshes, all of them pure decoration. */}
        {!lowPower && <Wildlife />}

        {markers.map((m, i) => (
          <MarkerMesh key={m.id} marker={m} index={i} />
        ))}

        <Player
          markers={markers}
          spawn={spawn}
          colliders={colliders}
          platforms={platforms}
        />

        {showColliders && <DebugColliders colliders={colliders} />}

        <SceneReadySignal />
        {process.env.NODE_ENV !== "production" && <DevStats />}
      </Suspense>
    </>
  );
}

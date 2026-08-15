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

import { Daylight } from "./daylight";
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
  /**
   * Whether this instance owns the user's input.
   *
   * THIS IS A CORRECTNESS SWITCH, NOT A FEATURE FLAG. `attachKeyboard` binds
   * handlers to `window` and calls `preventDefault()` on the arrow keys and
   * Space (see SCROLLERS in lib/planet/input.ts). Mounting a Scene with
   * `interactive` left on inside a page tile would therefore stop the arrow
   * keys and the space bar from scrolling the whole page, silently, for as
   * long as the tile is mounted. Ambient previews MUST pass false.
   */
  interactive?: boolean;
}

export default function Scene({
  markers,
  spawn,
  lowPower,
  onContextLost,
  interactive = true,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!interactive) return;
    const release = attachKeyboard();
    return release;
  }, [interactive]);

  useEffect(() => {
    if (!interactive) return;
    const el = hostRef.current;
    if (!el) return;
    return attachDrag(el);
  }, [interactive]);

  // Make react-three-fiber re-measure until it actually has a size.
  //
  // R3F sizes its canvas from a ResizeObserver on the container and only builds
  // the renderer once it sees a non-zero size. When the Canvas mounts inside a
  // portal appended in the same commit, it can measure zero and then never see
  // a size CHANGE, because the container was correctly sized in layout the
  // whole time. The symptom is brutal to diagnose: a canvas stuck at the HTML
  // default 300x150, no render loop, no error of any kind, and a loading pill
  // sitting at 0% forever.
  //
  // A single nudge is not enough, because the Canvas may not have been created
  // yet when it fires. So poll briefly and stop the moment the canvas has taken
  // the host's width, or after a short ceiling. Every dispatch is idempotent
  // and free when the size was already correct.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let timer: ReturnType<typeof setTimeout>;
    const deadline = performance.now() + 3000;

    const nudge = () => {
      const canvas = host.querySelector("canvas");
      const sized = canvas && canvas.clientWidth >= host.clientWidth - 2;
      if (sized || performance.now() > deadline) return;
      window.dispatchEvent(new Event("resize"));
      timer = setTimeout(nudge, 120);
    };

    timer = setTimeout(nudge, 0);
    return () => clearTimeout(timer);
  }, []);

  // sceneReady is NOT set here. It flips inside <World> only after all asset
  // suspensions have resolved and a frame has rendered; a mount-time flip
  // would hide the 2D page while models are still in flight.

  return (
    <div
      ref={hostRef}
      className="absolute inset-0 touch-none select-none"
      style={{
        cursor: interactive ? "grab" : "default",
        // A non-interactive scene is decoration: it must not swallow clicks
        // meant for the link wrapping the tile.
        pointerEvents: interactive ? undefined : "none",
      }}
      aria-hidden={!interactive}
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

        {/* Three lights, all effectively free. No shadow maps: on a sphere the
            player orbits, the shadow camera would have to follow a changing up
            vector for a result nobody looks at.

            The key light orbits (see Daylight), so at any moment half the
            archipelago is on the night side. The ambient term is therefore
            doing real work rather than being a token: it is the only thing
            keeping an unlit island from reading as a void where a world should
            be. Raised from 0.25 when the map went from four islands to five. */}
        <hemisphereLight intensity={0.55} color="#bcd8ff" groundColor="#241d3d" />
        <Daylight />
        <ambientLight intensity={0.34} />

        {!lowPower && <Sky />}

        <World markers={markers} spawn={spawn} lowPower={lowPower} />
      </Canvas>
    </div>
  );
}

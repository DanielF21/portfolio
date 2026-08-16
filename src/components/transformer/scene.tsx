"use client";

import { Canvas } from "@react-three/fiber";
import { useEffect, useRef } from "react";

import { CAM_FAR, CAM_NEAR, BACKGROUND } from "@/lib/transformer/theme";
import { DEFAULT_POSE } from "@/lib/transformer/camera";
import { attachControls } from "@/lib/transformer/input";

import { CameraRig } from "./camera-rig";
import { DevHooks } from "./dev-hooks";
import { LabelTracker } from "./label-tracker";
import { ReadySignal } from "./ready-signal";
import { Stack } from "./stack";

/**
 * The <Canvas>, and the only module in the piece that may import three
 * transitively without care. Everything under `lib/transformer/` stays
 * three-free so the eagerly loaded DOM overlay cannot drag the library into the
 * shared bundle; three enters here and nowhere else.
 *
 * COLOUR CONVENTION, and it is the opposite of the planet's. Every colour in
 * this scene is authored as an sRGB hex string and goes through R3F's colour
 * management on the way in. The planet writes LINEAR values straight into
 * vertex-colour attributes, which is why a hex string there lands three times
 * too dark. Both conventions are internally consistent; mixing them is the bug.
 * Nothing here may hand-write a linear vertex colour.
 */

interface Props {
  lowPower: boolean;
  onContextLost: () => void;
}

export default function Scene({ lowPower, onContextLost }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    return attachControls(el);
  }, []);

  // Make react-three-fiber re-measure until it actually has a size.
  //
  // R3F sizes its canvas from a ResizeObserver on the container and only builds
  // the renderer once it sees a non-zero size. When the Canvas mounts inside a
  // portal appended in the same commit, it can measure zero and then never see
  // a size CHANGE, because the container was correctly sized in layout the
  // whole time. The symptom is a canvas stuck at the HTML default 300x150 with
  // no render loop and no error of any kind. Carried over verbatim from the
  // planet, which was bitten by exactly this.
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

  return (
    <div
      ref={hostRef}
      className="absolute inset-0 touch-none select-none"
      style={{ cursor: "grab" }}
    >
      <Canvas
        dpr={lowPower ? [1, 1] : [1, 2]}
        camera={{
          fov: DEFAULT_POSE.fov,
          near: CAM_NEAR,
          far: CAM_FAR,
          position: [0, 0, DEFAULT_POSE.distance],
        }}
        gl={{ antialias: !lowPower, powerPreference: "high-performance" }}
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
        <color attach="background" args={[BACKGROUND]} />

        {/* Deliberately plain lighting. This is a technical drawing, not a
            world: one key to give the slabs a readable edge, one fill so the
            unlit sides do not go to black, and nothing else. Shadows would
            only make the stack harder to read. */}
        <ambientLight intensity={0.85} />
        <directionalLight position={[6, 10, 14]} intensity={1.5} />
        <directionalLight position={[-8, -4, -10]} intensity={0.45} />

        <CameraRig />
        <Stack />
        {/* After Stack, so anchors mounted this commit are already registered
            when the tracker's first frame runs. */}
        <LabelTracker />
        <ReadySignal />
        <DevHooks />
      </Canvas>
    </div>
  );
}

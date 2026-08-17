"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import {
  CAM_FAR,
  CAM_NEAR,
  BACKGROUND,
  FOG_FAR_SCALE,
  FOG_NEAR_SCALE,
} from "@/lib/transformer/theme";
import { DEFAULT_POSE } from "@/lib/transformer/camera";
import { attachControls, pointer } from "@/lib/transformer/input";
import { view } from "@/lib/transformer/view";

import { AutoFrame } from "./auto-frame";
import { CameraRig } from "./camera-rig";
import { DevHooks } from "./dev-hooks";
import { FocusMark } from "./focus-mark";
import { Ground } from "./ground";
import { ReadySignal } from "./ready-signal";
import { Stack } from "./stack";

/**
 * A back light that rides the camera.
 *
 * Weights are drawn only a little brighter than the background now, on purpose,
 * so they read by silhouette the way the reference's module does. That only
 * works if there IS a silhouette, and a fixed back light stops producing one as
 * soon as you orbit past it. Placing the light opposite the camera each frame
 * means every slab keeps a lit edge from every angle.
 *
 * Lives in the render loop rather than in React state for the usual reason: the
 * camera moves every frame and nothing about that should re-render a component.
 */
function RimLight() {
  const ref = useRef<THREE.DirectionalLight>(null);

  useFrame(({ camera }) => {
    const light = ref.current;
    if (!light) return;
    // Directly behind the subject from where the camera stands, lifted so the
    // edge it draws runs along the top of a slab rather than round its middle.
    light.position.set(
      -camera.position.x,
      Math.abs(camera.position.y) + 6,
      -camera.position.z
    );
  });

  return <directionalLight ref={ref} intensity={1.35} color="#ffd9c2" />;
}

/**
 * Fog, ranged off the camera's own distance rather than off world units.
 *
 * See `FOG_NEAR_SCALE`. The camera stands 5 units from a projection and 114
 * from the whole stack, so a fixed far plane either erases the overview or does
 * nothing for a close-up. This gives every shot the same amount of cueing.
 *
 * Written straight onto the fog object each frame rather than through React,
 * because the distance it follows changes sixty times a second while the camera
 * is moving and none of that should re-render anything.
 */
function DepthCue() {
  const scene = useThree((s) => s.scene);
  const fog = useMemo(
    () => new THREE.Fog(BACKGROUND, 1, 2),
    []
  );

  useEffect(() => {
    scene.fog = fog;
    return () => {
      scene.fog = null;
    };
  }, [scene, fog]);

  useFrame(() => {
    const d = view.current.distance;
    fog.near = d * FOG_NEAR_SCALE;
    fog.far = d * FOG_FAR_SCALE;
  });

  return null;
}

/**
 * The cursor, which is the only thing that says any of this can be clicked.
 *
 * THE WHOLE SCENE USED TO READ AS A DRAG SURFACE. The host carried a permanent
 * inline `cursor: grab` and nothing ever changed it, so the pointer was a grab
 * hand over the index-clickable geometry, over the plates, over everything. A
 * grab hand means "this moves when you pull it", so a reader who pressed on a
 * block and got a small orbit had every reason to conclude the model is
 * draggable and not clickable, and to stop trying.
 *
 * Three states, and each is load bearing: `grabbing` while a drag is actually in
 * progress, `pointer` over anything a click would navigate to, `grab` otherwise.
 *
 * Written in the frame loop off the mutable `pointer` singleton rather than
 * through React, because `hot` changes as the cursor crosses geometry and none
 * of that should re-render anything. Guarded on change, so it is a string
 * compare per frame and no DOM write in the common case.
 */
function CursorHint() {
  const gl = useThree((s) => s.gl);

  useFrame(() => {
    const want = pointer.dragging
      ? "grabbing"
      : pointer.hot
        ? "pointer"
        : "grab";
    const el = gl.domElement;
    if (el.style.cursor !== want) el.style.cursor = want;
  });

  return null;
}

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
        <DepthCue />

        {/*
          THE OLD RIG WAS ambient 0.85 AGAINST A KEY OF 1.5, which put the
          darkest face of every box at 57% of its lit face. Boxes lit that flatly
          have no readable form: the silhouette is the only thing separating one
          from another, and 28 identical silhouettes in a row is a grey wall.
          That single ratio was the largest cause of "everything looks blocky".

          What replaces it is a portrait rig, not a room. Ambient drops to a
          fifth so faces actually differ, a hemisphere gives a vertical gradient
          instead of a constant so horizontal surfaces separate from vertical
          ones, and a rim light rides the camera to draw the edge every slab
          needs against a background it is only a little brighter than.
        */}
        <ambientLight intensity={0.18} />
        <hemisphereLight args={["#6a5347", "#0d0806", 0.5]} />
        <directionalLight position={[7, 12, 9]} intensity={2.1} />
        {/* Fill from the opposite side, weak. Enough that a face turned away
            from the key is dark rather than absent. */}
        <directionalLight position={[-9, -2, -7]} intensity={0.32} />
        <RimLight />

        <CameraRig />
        <CursorHint />
        <Ground />
        <Stack />
        {/* After Stack, so the scope groups for the current focus are already
            in the graph when it measures them. */}
        <AutoFrame />
        {/* After AutoFrame, so the brackets read the bounds it measured this
            frame rather than the previous one's. */}
        <FocusMark />
        <ReadySignal />
        <DevHooks />
      </Canvas>
    </div>
  );
}

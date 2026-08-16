"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import type { PerspectiveCamera } from "three";

import { dampPose, poseToPosition } from "@/lib/transformer/camera";
import { view } from "@/lib/transformer/view";

/**
 * The only thing that writes to the camera.
 *
 * `view.desired` is set by the drag handler and by the index panel; this chases
 * it. Because there is one chase and one writer, an index flight and a drag can
 * never fight: whoever wrote `desired` last wins, and the visitor sees a single
 * damped move either way.
 */

/** Cap on the frame delta. A tab-switch or a GC pause can hand `useFrame` a
 *  multi-second dt, which with an exponential chase would teleport the camera
 *  in one frame instead of flying it. Same guard, same reason, as the planet's
 *  MAX_DELTA. */
const MAX_DELTA = 1 / 30;

export function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);

  // Publish the canvas size for the overlay, which positions labels in CSS
  // pixels and must not measure the DOM itself every frame.
  useEffect(() => {
    view.width = size.width;
    view.height = size.height;
  }, [size.width, size.height]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, MAX_DELTA);

    view.current = dampPose(view.current, view.desired, dt);

    const [x, y, z] = poseToPosition(view.current);
    camera.position.set(x, y, z);
    camera.lookAt(
      view.current.target[0],
      view.current.target[1],
      view.current.target[2]
    );

    // updateProjectionMatrix is not free, so only on an actual change. The
    // chase is asymptotic and never exactly settles, hence the epsilon.
    if (Math.abs(camera.fov - view.current.fov) > 1e-3) {
      camera.fov = view.current.fov;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

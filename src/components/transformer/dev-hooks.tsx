"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect } from "react";

import { useTransformerStore } from "@/lib/transformer/store";
import { view } from "@/lib/transformer/view";

/**
 * Console hooks, dev only.
 *
 * The planet has the same table and it is the only practical way to inspect a
 * scene like this: a backgrounded Chrome tab throttles requestAnimationFrame,
 * so driving the camera by hand and stepping frames with screenshots is how
 * framing actually gets checked.
 *
 *   window.__transformer            per-frame readout
 *   window.__transformerDraws       draw calls and triangles
 *   window.__transformerPose({...}) nudge the camera, partial pose
 *   window.__transformerLayer(n)    move the hero block
 *   window.__transformerRender()    force one frame, return its cost
 */
export function DevHooks() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const w = window as unknown as Record<string, unknown>;

    // `snap` writes `current` as well as `desired`, which is the only way to
    // frame a shot from the console. The chase is exponential and a throttled
    // background tab only advances one frame per screenshot, so a normal
    // re-aim would take dozens of round trips to arrive.
    w.__transformerPose = (patch: Record<string, unknown>, snap = true) => {
      view.desired = { ...view.desired, ...patch } as typeof view.desired;
      if (snap) view.current = view.desired;
      return view.desired;
    };
    w.__transformerLayer = (n: number) => {
      useTransformerStore.getState().setLayer(n);
      return useTransformerStore.getState().layer;
    };

    // Render one frame synchronously and hand back the cost of it.
    //
    // `gl.info.render` only updates when a frame is drawn, and a backgrounded
    // tab does not draw: requestAnimationFrame never fires there, and awaiting
    // it hangs outright. That makes draw-call budgets unmeasurable from the
    // console without this, since the only other way to force a frame is to
    // take a screenshot, which costs a round trip per view.
    w.__transformerRender = () => {
      gl.info.reset();
      gl.render(scene, camera);
      return {
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        focus: useTransformerStore.getState().focus,
      };
    };

    return () => {
      delete w.__transformer;
      delete w.__transformerDraws;
      delete w.__transformerPose;
      delete w.__transformerLayer;
      delete w.__transformerRender;
    };
  }, [gl, scene, camera]);

  useFrame(() => {
    if (process.env.NODE_ENV === "production") return;
    const w = window as unknown as Record<string, unknown>;
    const s = useTransformerStore.getState();
    w.__transformer = {
      pose: view.current,
      desired: view.desired,
      focus: s.focus,
      layer: s.layer,
      hover: s.hover,
      size: [view.width, view.height],
    };
    w.__transformerDraws = {
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
    };
  });

  return null;
}

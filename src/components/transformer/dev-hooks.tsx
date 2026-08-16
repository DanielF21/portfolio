"use client";

import { advance, useFrame, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";

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
 *   window.__transformerFit(fill)   frame what is in scope, from its bbox
 *   window.__transformerTick(n)     advance the R3F loop n frames (runs useFrame)
 *   window.__transformerView        the live view singleton
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

    // Advance the R3F loop by `n` frames, running every useFrame callback.
    //
    // `__transformerRender` deliberately calls `gl.render` directly so it can
    // report a draw cost without side effects, which means it does NOT run
    // useFrame. That was fine when the only per-frame work was the camera
    // chase, and became a trap once `auto-frame` started measuring the scene in
    // a useFrame: a backgrounded tab never fires requestAnimationFrame, so the
    // camera would never move and every measurement would be taken of a pose
    // that had not been applied yet.
    w.__transformerTick = (n = 1) => {
      for (let i = 0; i < n; i++) advance(performance.now() + i * 16);
      return view.current;
    };

    // The live view singleton, so a test can read where the camera decided to
    // go without waiting for the useFrame that mirrors it onto __transformer.
    w.__transformerView = view;

    // Frame whatever is currently in scope, from its actual bounding box.
    //
    // This exists because geometry and camera poses are changed in separate
    // steps, and in between, every authored pose is wrong. Without a way to ask
    // "what SHOULD this shot be", a mis-framed view is ambiguous: the geometry
    // could be wrong, or the pose could be, and the tempting fix is to bend the
    // geometry until the old camera looks right. That would quietly trade the
    // one property the layout is for.
    //
    // Skips anything marked `userData.noFit` (the ground, the plate field), so
    // fitting a station frames the station and not the whole model.
    w.__transformerFit = (fill = 0.78) => {
      // See the note in `auto-frame`: world matrices are computed at render
      // time, so anything that mounted this commit measures stale without this.
      scene.updateMatrixWorld(true);

      const box = new THREE.Box3();
      const item = new THREE.Box3();
      let found = false;

      // `Box3.setFromObject` reads geometry regardless of `visible`, so the
      // plate field would still be counted while a station is isolated and
      // every fit would frame the whole 38 unit stack. Check the ancestor chain
      // rather than the object alone: `Stack` hides the plates by setting
      // `visible` on the mesh, but a group could just as easily carry it.
      const shown = (o: THREE.Object3D) => {
        for (let n: THREE.Object3D | null = o; n; n = n.parent) {
          if (!n.visible || n.userData.noFit) return false;
        }
        return true;
      };

      scene.traverse((o) => {
        if (!(o as THREE.Mesh).isMesh) return;
        if (!shown(o)) return;
        item.setFromObject(o);
        if (item.isEmpty()) return;
        box.union(item);
        found = true;
      });
      if (!found) return null;

      const size = box.getSize(new THREE.Vector3());
      const centre = box.getCenter(new THREE.Vector3());

      const fov = view.desired.fov;
      const aspect = view.width / Math.max(1, view.height);
      const halfFov = (fov * Math.PI) / 360;

      // Fit BOTH axes: the vertical needs the height, the horizontal needs the
      // width divided by aspect before it can be compared against the same
      // half-angle. Whichever demands more distance wins, or the subject
      // overflows on the other axis.
      const half = Math.max(size.y / 2, size.x / 2 / aspect, size.z / 2 / aspect);
      const distance = half / Math.tan(halfFov) / fill;

      view.desired = {
        ...view.desired,
        target: [centre.x, centre.y, centre.z],
        distance,
      };
      view.current = view.desired;
      return {
        size: size.toArray().map((n) => +n.toFixed(2)),
        centre: centre.toArray().map((n) => +n.toFixed(2)),
        distance: +distance.toFixed(2),
      };
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
      delete w.__transformerFit;
      delete w.__transformerTick;
      delete w.__transformerView;
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

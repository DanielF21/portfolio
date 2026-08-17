"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useMemo } from "react";

import { arm, disarm } from "@/lib/transformer/activate";
import { entryById } from "@/lib/transformer/glossary";
import { pointer } from "@/lib/transformer/input";
import { useTransformerStore } from "@/lib/transformer/store";
import { requestRefit } from "@/lib/transformer/view";

import { useScopePath } from "./scope";

/**
 * Hover and click, in one place.
 *
 * EVERY PART OF THE BLOCK HAS TO ANSWER THE CURSOR, because hover is now the
 * whole explanation. Focusing something no longer clears the frame of everything
 * else, so a shot of the score grid also contains the head split behind it, the
 * MLP beyond that and the stream running under all of it. That is the point, and
 * it only works if pointing at any of them says what it is.
 *
 * CLICKING GOES WHERE THE THING LIVES, and the destination is read off the scene
 * graph rather than written down. `Scope` provides its dotted path through
 * context and the index is keyed by the same paths, so a slab inside
 * `block.attn.qkv` navigates there and cannot drift from it. The alternative was
 * a hand-written table from node id to index entry, which is a second copy of the
 * tree that goes stale the first time a station moves.
 *
 * A scope with no index entry does not navigate. That is how the residual stream
 * and the two ends of the model stay hoverable without being destinations they
 * have no shot for.
 */
export function usePick(
  nodeId?: string,
  /** Force the clickable state. For the plates and taps, which sit outside every
   *  `Scope` and carry an explicit destination of their own. */
  clickable?: boolean
) {
  const scope = useScopePath();

  return useMemo(() => {
    if (!nodeId) return {};

    /** Whether a click here would go anywhere. Drives the cursor, so a reader
     *  can tell what is a destination before pressing anything. */
    const navigable =
      clickable ?? (Boolean(scope) && Boolean(entryById(scope)));

    return {
      // Picking is suppressed mid-drag: highlighting whatever slides under the
      // cursor while you orbit is distracting and never what was meant.
      onPointerOver: (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        if (pointer.dragging) return;
        pointer.hot = navigable;
        useTransformerStore.getState().setHover(nodeId);
      },
      onPointerOut: () => {
        pointer.hot = false;
        const s = useTransformerStore.getState();
        if (s.hover === nodeId) s.setHover(null);
      },
      /**
       * ARM ON PRESS. The release decides whether it was a click.
       *
       * This used to be `onClick`, and that is what four rounds of "clicking
       * does nothing" were actually about: a real press could take the browser's
       * `click` away from the canvas entirely, and no amount of tuning the
       * handler helps when the handler never runs. `activate.ts` has the full
       * account. Pointerdown is dispatched before anything can retarget it, and
       * picking demonstrably works here because hovering already lights the
       * cursor.
       */
      onPointerDown: (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        // THREE OUTCOMES, and this is the middle one. A press on empty space
        // keeps the fallback armed and backs out to the whole model; a press on
        // a destination arms that destination; a press on something pickable
        // that is NOT a destination, like the stream or the two ends, disarms,
        // so it is inert rather than an accidental way out.
        if (!scope || !entryById(scope)) {
          disarm();
          return;
        }
        arm(() => {
          useTransformerStore.getState().setFocus(scope);
          // Asked for even when the focus does not change, so pressing the thing
          // you are already looking at re-frames it rather than doing nothing.
          requestRefit();
        });
      },
    };
  }, [nodeId, scope, clickable]);
}

/**
 * An invisible box that makes something hoverable and clickable.
 *
 * For the parts built out of instanced cells, ribbons and line work rather than
 * a slab: line geometry does not raycast usefully and an instanced grid picks
 * per cell, neither of which is the answer a reader wants. One box over the
 * whole station is.
 *
 * `visible={false}` still raycasts in three, which is exactly the property being
 * used here. It carries `noFit` so the camera never frames the pick volume
 * instead of the thing inside it.
 */
export function PickBox({
  nodeId,
  size,
  position = [0, 0, 0],
}: {
  nodeId: string;
  size: [number, number, number];
  position?: [number, number, number];
}) {
  const pick = usePick(nodeId);
  return (
    <mesh visible={false} position={position} userData={{ noFit: true }} {...pick}>
      <boxGeometry args={size} />
    </mesh>
  );
}

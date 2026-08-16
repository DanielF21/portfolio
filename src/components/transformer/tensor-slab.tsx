"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";

import { pointer } from "@/lib/transformer/input";
import { useTransformerStore } from "@/lib/transformer/store";
import { WEIGHT, WEIGHT_LINE, ACTIVATION, ACTIVATION_SOFT, CACHE, CACHE_DIM } from "@/lib/transformer/theme";

import { createGridMaterial } from "./grid-material";

/**
 * The primitive everything is built from: one tensor, one box, one draw call.
 *
 * `rows` and `cols` are the TRUE logical dimensions and are passed straight to
 * the grid shader. `size` is the world extent, which callers get from
 * `layout.widthFor` so that a tensor twice as wide in the model is twice as wide
 * on screen. Those two facts together are what make the geometry evidence
 * rather than illustration, so neither may be fudged to make a shot compose.
 */

export type SlabKind = "weight" | "activation" | "cache";

const PALETTE: Record<SlabKind, { color: string; line: string; rough: number }> = {
  weight: { color: WEIGHT, line: WEIGHT_LINE, rough: 0.8 },
  activation: { color: ACTIVATION, line: ACTIVATION_SOFT, rough: 0.45 },
  cache: { color: CACHE_DIM, line: CACHE, rough: 0.6 },
};

interface Props {
  /** True logical dimensions. Rows run up the face, columns across it. */
  rows: number;
  cols: number;
  /** World extent [width, height, depth]. */
  size: [number, number, number];
  position?: [number, number, number];
  rotation?: [number, number, number];
  kind?: SlabKind;
  /** Dim a slab that is context rather than subject. */
  faded?: boolean;
  /** `model.ts` node id. Supplying it makes the slab hoverable and puts its
   *  real shape, parameter count and byte cost in the inspector. */
  nodeId?: string;
}

export function TensorSlab({
  rows,
  cols,
  size,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  kind = "weight",
  faded = false,
  nodeId,
}: Props) {
  const [w, h, d] = size;
  const paint = PALETTE[kind];

  const material = useMemo(
    () =>
      createGridMaterial({
        color: paint.color,
        // Columns run across the face (x), rows up it (y). Swapping these
        // transposes every matrix in the scene, which is exactly the kind of
        // silent error this whole file exists to avoid.
        cells: [cols, rows],
        faceSize: [w, h],
        lineColor: paint.line,
        lineOpacity: faded ? 0.35 : 0.9,
        roughness: paint.rough,
        transparent: faded,
        opacity: faded ? 0.45 : 1,
      }),
    [cols, rows, w, h, paint.color, paint.line, paint.rough, faded]
  );

  useEffect(() => () => material.dispose(), [material]);

  // Hover picking is suppressed mid-drag: highlighting whatever slides under
  // the cursor while you orbit is distracting and never what you meant.
  const hoverProps = nodeId
    ? {
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          if (pointer.dragging) return;
          useTransformerStore.getState().setHover(nodeId);
        },
        onPointerOut: () => {
          const s = useTransformerStore.getState();
          if (s.hover === nodeId) s.setHover(null);
        },
      }
    : {};

  return (
    <mesh position={position} rotation={rotation} {...hoverProps}>
      <boxGeometry args={[w, h, d]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

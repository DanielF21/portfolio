"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";

import {
  WEIGHT,
  WEIGHT_LINE,
  ACTIVATION,
  ACTIVATION_SOFT,
  CACHE,
  CACHE_DIM,
  OP_LINE,
} from "@/lib/transformer/theme";

import { createGridMaterial } from "./grid-material";
import { usePick } from "./pick";

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
  /**
   * This slab is drawn LARGER than its true proportion, at `MIN_AXIS`.
   *
   * Sets the same hatched edge the embedding wall uses for its elided axis, so
   * a floored slab announces that it is not to scale. Every other slab's area
   * is its parameter count; this is the escape hatch for the tensors too small
   * to draw, and it is only honest if it is visible.
   */
  floored?: boolean;
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
  floored = false,
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
        size: [w, h, d],
        lineColor: paint.line,
        lineOpacity: faded ? 0.35 : 0.9,
        roughness: paint.rough,
        transparent: faded,
        opacity: faded ? 0.45 : 1,
      }),
    [cols, rows, w, h, d, paint.color, paint.line, paint.rough, faded]
  );

  useEffect(() => () => material.dispose(), [material]);

  const pick = usePick(nodeId);

  return (
    <mesh position={position} rotation={rotation} {...pick}>
      <boxGeometry args={[w, h, d]} />
      <primitive object={material} attach="material" />
      {/* A floored slab is drawn bigger than its parameter count warrants, so
          it is outlined to read as a symbol rather than as a measurement. See
          the `floored` prop. */}
      {floored && <FloorMark w={w} h={h} d={d} />}
    </mesh>
  );
}

/** The "not to scale" marker: a bright wire outline round a floored slab. */
function FloorMark({ w, h, d }: { w: number; h: number; d: number }) {
  const geometry = useMemo(() => {
    const box = new THREE.BoxGeometry(w * 1.001, h * 1.001, d * 1.001);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    return edges;
  }, [w, h, d]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={OP_LINE} transparent opacity={0.85} />
    </lineSegments>
  );
}

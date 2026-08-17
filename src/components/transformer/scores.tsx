"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { headAttention, loadCapture, type LoadedCapture } from "@/lib/transformer/capture";
import { BLOCK_BASELINE, SCORES_SIZE, SEQ_TOKENS } from "@/lib/transformer/layout";
import { useTransformerStore } from "@/lib/transformer/store";
import { ACTIVATION, OP_LINE } from "@/lib/transformer/theme";

import { PickBox } from "./pick";

/**
 * Q dot K transpose, with the causal mask.
 *
 * THIS IS THE ONE PLACE REAL CELLS ARE DRAWN. Everywhere else a tensor's grid
 * is a shader on a slab, because the alternative is millions of boxes. Here the
 * cells ARE the subject: the mask is not a shading of the upper triangle, it is
 * the upper triangle NOT BEING THERE, and only real geometry can show an
 * absence. 12 tokens gives 78 cells, which is one instanced draw call.
 *
 * A token attends to itself and to every token before it, never to one after.
 * That is the entire reason generation can be autoregressive, and it is visible
 * here as a staircase: each row is one cell longer than the row above it. Add a
 * token and a new longest row appears at the bottom.
 *
 * The empty half is outlined rather than left blank, so the void reads as
 * something removed from a square rather than as a triangle that was never
 * square to begin with.
 */

const N = SEQ_TOKENS;
const CELL = SCORES_SIZE / N;

/**
 * Centre of query row `i`, counting down from row 0 at the top.
 *
 * BOTTOM ALIGNED ON THE BRANCH. The grid used to be centred on y = 0, so half
 * of it hung below the line every other station in the block stands on.
 */
function rowY(i: number): number {
  return BLOCK_BASELINE + SCORES_SIZE - (i + 0.5) * CELL;
}

/** Positions of every unmasked cell, i.e. key j <= query i. */
function visibleCells(): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j <= i; j++) out.push([i, j]);
  }
  return out;
}

const dummy = new THREE.Object3D();
const colour = new THREE.Color();

export function Scores() {
  const cells = useMemo(visibleCells, []);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const layer = useTransformerStore((s) => s.layer);
  const [capture, setCapture] = useState<LoadedCapture | null>(null);

  // Loaded lazily and only here, because this is the only view whose meaning
  // changes when it arrives. A missing capture is an ordinary state.
  useEffect(() => {
    let live = true;
    void loadCapture().then((c) => {
      if (live) setCapture(c);
    });
    return () => {
      live = false;
    };
  }, []);

  // Head 0 of whichever block is open. A capture recorded at a different
  // sequence length than the grid is drawn at cannot be indexed into safely.
  const weights =
    capture && capture.seq === N ? headAttention(capture, layer, 0) : null;

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const base = new THREE.Color(ACTIVATION);

    cells.forEach(([i, j], k) => {
      // Query rows run down the face, key columns across it. Row 0 at the top,
      // so the staircase descends the way the tokens arrive.
      dummy.position.set((j - (N - 1) / 2) * CELL, rowY(i), 0);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(k, dummy.matrix);

      // Without a capture, every unmasked cell is drawn at the same weight.
      // That is deliberately flat rather than randomised: an invented pattern
      // that looks like attention is worse than no pattern at all.
      //
      // With one, the row is rescaled by its own maximum. Post-softmax rows sum
      // to 1, so at 12 tokens the average weight is 0.08 and a linear ramp
      // renders almost every cell near black. The relative pattern within a row
      // is what is being read, and that is what a row-max scale preserves.
      let w = 0.55;
      if (weights) {
        let rowMax = 0;
        for (let c = 0; c <= i; c++) rowMax = Math.max(rowMax, weights[i * N + c]);
        w = rowMax > 0 ? weights[i * N + j] / rowMax : 0;
      }
      colour.copy(base).multiplyScalar(0.35 + w * 0.9);
      mesh.setColorAt(k, colour);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [cells, weights]);

  return (
    <group>
      {/* The lower triangle answers "Scores": those cells exist. The full square
          answers "Causal mask", because what the mask IS here is the half that
          is not drawn, and the only thing a cursor can land on there is the
          outline of where it would have been. Two boxes, so both halves of the
          picture can be asked about. */}
      <PickBox
        nodeId="block.attn.mask"
        size={[SCORES_SIZE, SCORES_SIZE, 0.08]}
        position={[0, BLOCK_BASELINE + SCORES_SIZE / 2, -0.02]}
      />
      <PickBox
        nodeId="block.attn.scores"
        size={[SCORES_SIZE * 0.72, SCORES_SIZE * 0.72, 0.12]}
        position={[
          -SCORES_SIZE * 0.13,
          BLOCK_BASELINE + SCORES_SIZE * 0.37,
          0.02,
        ]}
      />

      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, cells.length]}
        frustumCulled={false}
      >
        <boxGeometry args={[CELL * 0.82, CELL * 0.82, 0.1]} />
        <meshStandardMaterial
          roughness={0.4}
          emissive={ACTIVATION}
          emissiveIntensity={0.25}
          toneMapped={false}
        />
      </instancedMesh>

      {/* The full square the triangle was cut out of. */}
      <lineSegments position={[0, BLOCK_BASELINE + SCORES_SIZE / 2, 0]}>
        <edgesGeometry
          args={[new THREE.BoxGeometry(SCORES_SIZE, SCORES_SIZE, 0.1)]}
        />
        <lineBasicMaterial color={OP_LINE} transparent opacity={0.45} />
      </lineSegments>
    </group>
  );
}

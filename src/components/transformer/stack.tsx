"use client";

import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";

import { CONFIG } from "@/lib/transformer/config";
import { OVERVIEW_ID } from "@/lib/transformer/glossary";
import {
  BLOCK_H,
  BLOCK_PITCH,
  BLOCK_W,
  BRANCH_Y,
  PLATE_DEPTH,
  blockZ,
  stackZRange,
  tierFor,
} from "@/lib/transformer/layout";
import { formatCount } from "@/lib/transformer/format";
import { DERIVED } from "@/lib/transformer/model";
import { useTransformerStore } from "@/lib/transformer/store";
import { WEIGHT, WEIGHT_DIM } from "@/lib/transformer/theme";

import { Anchor } from "./anchor";
import { Block } from "./block";
import { Embedding } from "./embedding";
import { KvCache } from "./kv-cache";
import { Logits } from "./logits";
import { Residual } from "./residual";

/**
 * The stack of blocks, at three levels of detail.
 *
 * Exactly one block is exploded, its immediate neighbours are solid slabs, and
 * every other block is a thin plate. That is what makes 28 blocks legible
 * without pretending there are fewer of them: the repetition stays visible as
 * a receding row of plates while only one block costs real geometry.
 *
 * Plates are ONE InstancedMesh sized for every layer, with non-plate slots
 * scaled to zero rather than the instance count changing. The count varies as
 * focus moves (the hero has one solid neighbour at the ends of the stack and
 * two in the middle), and resizing an InstancedMesh means reallocating it. The
 * planet's snowball pool does the same thing for the same reason.
 */

const N = CONFIG.numHiddenLayers;

/** Reused for every matrix write, so the loop allocates nothing. */
const dummy = new THREE.Object3D();
const HIDDEN = new THREE.Vector3(0, 0, 0);

export function Stack() {
  const layer = useTransformerStore((s) => s.layer);
  // Focusing anything inside the block hides the rest of the stack as well as
  // the sibling stations. The open block spans 9.4 units and its nearest
  // neighbour sits just outside that, so any camera far enough back to frame a
  // station has several plates between it and the subject. Hiding the stations
  // alone left the camera looking at the back of block 12.
  const focus = useTransformerStore((s) => s.focus);
  const isolated = focus !== null && focus !== OVERVIEW_ID;
  const platesRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = platesRef.current;
    if (!mesh) return;

    for (let i = 0; i < N; i++) {
      const tier = tierFor(i, layer);
      // Standing ON the branch, not straddling it, so a collapsed block occupies
      // the same envelope the open one grows into. See `BLOCK_BASELINE`.
      dummy.position.set(0, BRANCH_Y + BLOCK_H / 2, blockZ(i, layer));
      dummy.rotation.set(0, 0, 0);
      // A zero scale is how a slot opts out. Scaling to zero collapses the box
      // to a point, which draws nothing and costs one skipped instance.
      if (tier === "plate") dummy.scale.set(1, 1, 1);
      else dummy.scale.copy(HIDDEN);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [layer]);

  return (
    <group>
      <Residual />

      {/* Every plate, in one draw call. */}
      <instancedMesh
        ref={platesRef}
        visible={!isolated}
        args={[undefined, undefined, N]}
        // The stack spans the frame in the default shot, so it is never fully
        // off screen and per-instance frustum culling can only cost time.
        frustumCulled={false}
      >
        <boxGeometry args={[BLOCK_W, BLOCK_H, PLATE_DEPTH]} />
        <meshStandardMaterial color={WEIGHT_DIM} roughness={0.85} metalness={0} />
      </instancedMesh>

      {/* The hero's neighbours. Two draw calls, and they exist to say "the
          thing you are looking at is one of these" without competing with it. */}
      {(isolated ? [] : Array.from({ length: N }, (_, i) => i))
        .filter((i) => tierFor(i, layer) === "solid")
        .map((i) => (
          <mesh key={i} position={[0, BRANCH_Y + BLOCK_H / 2, blockZ(i, layer)]}>
            <boxGeometry args={[BLOCK_W, BLOCK_H, BLOCK_PITCH * 0.62]} />
            <meshStandardMaterial color={WEIGHT} roughness={0.8} metalness={0} />
          </mesh>
        ))}

      {/* The two ends. Tied weights, so these are one 233M parameter tensor
          drawn twice, not two. Hidden while a station is isolated like
          everything else that would sit between the camera and the subject. */}
      {!isolated && (
        <>
          <Embedding role="in" z={stackZRange(layer)[1] + 4.5} />
          <Embedding role="out" z={stackZRange(layer)[0] - 4.5} />
          <Logits z={stackZRange(layer)[0] - 8.5} />
        </>
      )}

      {/* The cache is not part of the forward pass geometry: it is what
          survives between passes. It gets its own view rather than a place in
          the line of stations. */}
      {focus === "kv" && <KvCache />}

      <Block />

      {/* The only labels the whole-model shot gets. Everything below block
          level is noise at this distance and belongs to its own view. */}
      <Anchor
        overview
        id="stack"
        text={`${N} blocks`}
        sub={`${formatCount(DERIVED.paramsAllBlocks)} params · identical structure`}
        position={[BLOCK_W / 2, BRANCH_Y + BLOCK_H / 2, blockZ(Math.max(0, layer - 6), layer)]}
      />
      <Anchor
        overview
        id="stream"
        text="Residual stream"
        sub={`${CONFIG.hiddenSize.toLocaleString("en-US")} wide · every block reads and adds`}
        position={[0, 0, blockZ(Math.min(N - 1, layer + 8), layer)]}
      />
      <Anchor
        overview
        id="hero"
        text={`Block ${layer + 1}`}
        sub={`${formatCount(DERIVED.paramsPerBlock)} params`}
        position={[0, BRANCH_Y + BLOCK_H, 0]}
      />
    </group>
  );
}

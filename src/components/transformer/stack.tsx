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
  CONDUIT_W,
  PLATE_DEPTH,
  blockZ,
  stackZRange,
  tierFor,
} from "@/lib/transformer/layout";
import { useTransformerStore } from "@/lib/transformer/store";
import { STREAM, WEIGHT, WEIGHT_DIM } from "@/lib/transformer/theme";

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
const SHOWN = new THREE.Vector3(1, 1, 1);

export function Stack() {
  const layer = useTransformerStore((s) => s.layer);
  // Focusing anything inside the block hides the rest of the stack as well as
  // the sibling stations. The open block spans 9.4 units and its nearest
  // neighbour sits just outside that, so any camera far enough back to frame a
  // station has several plates between it and the subject. Hiding the stations
  // alone left the camera looking at the back of block 12.
  const focus = useTransformerStore((s) => s.focus);
  const isolated = focus !== null && focus !== OVERVIEW_ID;
  // A block is only opened once you have asked to look at one. See `tierFor`.
  const open = focus === "block" || (focus?.startsWith("block.") ?? false);
  const platesRef = useRef<THREE.InstancedMesh>(null);
  const tapsRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const plates = platesRef.current;
    const taps = tapsRef.current;
    if (!plates || !taps) return;

    for (let i = 0; i < N; i++) {
      const tier = tierFor(i, layer, open);
      const z = blockZ(i, layer, open);
      const plate = tier === "plate";

      // Standing ON the branch, not straddling it, so a collapsed block occupies
      // the same envelope the open one grows into. See `BLOCK_BASELINE`.
      dummy.position.set(0, BRANCH_Y + BLOCK_H / 2, z);
      dummy.rotation.set(0, 0, 0);
      // A zero scale is how a slot opts out. Scaling to zero collapses the box
      // to a point, which draws nothing and costs one skipped instance.
      dummy.scale.copy(plate ? SHOWN : HIDDEN);
      dummy.updateMatrix();
      plates.setMatrixAt(i, dummy.matrix);

      // The tap spans from the stream up to the branch the plate stands on.
      dummy.position.set(0, BRANCH_Y / 2, z);
      dummy.scale.copy(plate ? SHOWN : HIDDEN);
      dummy.updateMatrix();
      taps.setMatrixAt(i, dummy.matrix);
    }
    plates.instanceMatrix.needsUpdate = true;
    taps.instanceMatrix.needsUpdate = true;
  }, [layer, open]);

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

      {/* One tap per block, down to the stream, in a second draw call.
          THE STREAM IS NOT A RAIL RUNNING PAST THE BLOCKS. Every one of the 28
          reads it and adds back into it, and that is the single most important
          fact in the picture. While the hero was always open its own two taps
          said so; with every block collapsed at the overview the stream lost
          every visible connection and read as a separate bar lying alongside
          the stack, which is precisely the "chain of layers" misreading the
          branch geometry exists to prevent. */}
      <instancedMesh
        ref={tapsRef}
        visible={!isolated}
        args={[undefined, undefined, N]}
        frustumCulled={false}
      >
        <boxGeometry args={[CONDUIT_W * 0.5, BRANCH_Y, PLATE_DEPTH * 0.5]} />
        <meshStandardMaterial
          color={STREAM}
          emissive={STREAM}
          emissiveIntensity={0.22}
          roughness={0.5}
          metalness={0}
        />
      </instancedMesh>

      {/* The hero's neighbours. Two draw calls, and they exist to say "the
          thing you are looking at is one of these" without competing with it. */}
      {(isolated ? [] : Array.from({ length: N }, (_, i) => i))
        .filter((i) => tierFor(i, layer, open) === "solid")
        .map((i) => (
          <mesh key={i} position={[0, BRANCH_Y + BLOCK_H / 2, blockZ(i, layer, open)]}>
            <boxGeometry args={[BLOCK_W, BLOCK_H, BLOCK_PITCH * 0.62]} />
            <meshStandardMaterial color={WEIGHT} roughness={0.8} metalness={0} />
          </mesh>
        ))}

      {/* The two ends. Tied weights, so these are one 233M parameter tensor
          drawn twice, not two. Hidden while a station is isolated like
          everything else that would sit between the camera and the subject. */}
      {!isolated && (
        <>
          <Embedding role="in" z={stackZRange(layer, open)[1] + 4.5} />
          <Embedding role="out" z={stackZRange(layer, open)[0] - 4.5} />
          <Logits z={stackZRange(layer, open)[0] - 8.5} />
        </>
      )}

      {/* The cache is not part of the forward pass geometry: it is what
          survives between passes. It gets its own view rather than a place in
          the line of stations. */}
      {focus === "kv" && <KvCache />}

      {/* Only once you have asked for a block. At the overview the hero is a
          plate like the other 27; see `tierFor`. */}
      {open && <Block />}
    </group>
  );
}

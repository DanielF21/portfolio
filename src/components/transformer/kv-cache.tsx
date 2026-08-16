"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { CONFIG } from "@/lib/transformer/config";
import { formatBytes, formatInt, formatRatio } from "@/lib/transformer/format";
import { SEQ_TOKENS } from "@/lib/transformer/layout";
import { DERIVED } from "@/lib/transformer/model";
import { useTransformerStore } from "@/lib/transformer/store";
import { CACHE, CACHE_DIM, OP_LINE } from "@/lib/transformer/theme";

import { Anchor } from "./anchor";

/**
 * The KV cache, drawn as layers by tokens.
 *
 * ONE CELL IS EXACTLY ONE KIBIBYTE, and that is not a convenient rounding. A
 * cell is one layer's K and V for one token: 2 tensors, 256 wide, 2 bytes each,
 * which is 1024 bytes on the nose. So a column is 28 cells, one per layer, and
 * a column is 28 KiB, and a column is one token. The grid IS the memory
 * arithmetic, at 1:1.
 *
 * That is also where grouped query attention pays for itself. Without it K and
 * V would be 1536 wide instead of 256, every cell would be 6 KiB, and a column
 * would be 168 KiB. The cache is the reason GQA exists and this is the picture
 * of it.
 *
 * PREFILL AND DECODE are the same grid filled at two different rates. Prefill
 * computes every column at once because the whole prompt is known; decode adds
 * one column per step because each token depends on the one before it. The
 * rhythm difference is the single most important thing about serving a
 * decoder-only model and it is very hard to convey in prose.
 */

const N_LAYERS = CONFIG.numHiddenLayers;
/** Columns drawn. Beyond the prompt there is room to watch decode extend it. */
const MAX_TOKENS = SEQ_TOKENS + 8;

const CELL = 0.26;
const GRID_W = MAX_TOKENS * CELL;
const GRID_H = N_LAYERS * CELL;

const dummy = new THREE.Object3D();
const colour = new THREE.Color();

const FILLED = new THREE.Color(CACHE);
const EMPTY = new THREE.Color(CACHE_DIM);

export function KvCache() {
  const mode = useTransformerStore((s) => s.mode);
  const tokens = useTransformerStore((s) => s.tokens);
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const outline = useMemo(() => {
    const box = new THREE.BoxGeometry(GRID_W, GRID_H, 0.12);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    return edges;
  }, []);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    let k = 0;
    for (let t = 0; t < MAX_TOKENS; t++) {
      for (let l = 0; l < N_LAYERS; l++) {
        dummy.position.set(
          (t - (MAX_TOKENS - 1) / 2) * CELL,
          -(l - (N_LAYERS - 1) / 2) * CELL,
          0
        );
        dummy.rotation.set(0, 0, 0);
        // Uncached columns collapse to nothing rather than being drawn dark, so
        // the cache's SIZE is what changes as it fills, not just its colour.
        // The cache growing is the thing being shown.
        dummy.scale.setScalar(t < tokens ? 1 : 0.001);
        dummy.updateMatrix();
        mesh.setMatrixAt(k, dummy.matrix);

        // The newest column reads brighter: in decode that is the one that just
        // arrived, and it is the only difference between a step and the frame
        // before it.
        const fresh = mode === "decode" && t === tokens - 1;
        colour.copy(fresh ? FILLED : EMPTY).lerp(FILLED, fresh ? 1 : 0.45);
        mesh.setColorAt(k, colour);
        k += 1;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [tokens, mode]);

  const perToken = DERIVED.kvBytesPerToken;
  const used = perToken * tokens;

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, MAX_TOKENS * N_LAYERS]}
        frustumCulled={false}
      >
        <boxGeometry args={[CELL * 0.84, CELL * 0.84, 0.12]} />
        <meshStandardMaterial
          emissive={CACHE}
          emissiveIntensity={0.22}
          roughness={0.45}
          toneMapped={false}
        />
      </instancedMesh>

      {/* The capacity the cache is filling into. */}
      <lineSegments geometry={outline}>
        <lineBasicMaterial color={OP_LINE} transparent opacity={0.35} />
      </lineSegments>

      <Anchor
        id="kv.total"
        text={`${tokens} tokens cached`}
        sub={`${formatBytes(used)} · ${formatBytes(perToken)} per token`}
        position={[GRID_W / 2 + 0.4, GRID_H / 2 + 0.3, 0]}
      />
      <Anchor
        id="kv.cell"
        text="One cell, one layer, one token"
        sub={`K and V, ${formatInt(DERIVED.kvDim)} wide each · exactly ${formatBytes(perToken / N_LAYERS)}`}
        position={[-GRID_W / 2 - 0.4, 0, 0]}
      />
      <Anchor
        id="kv.gqa"
        text="Without GQA"
        sub={`${formatBytes(DERIVED.kvBytesPerTokenMha)} per token · ${formatRatio(
          DERIVED.kvBytesPerTokenMha / perToken
        )} this size`}
        position={[GRID_W / 2 + 0.4, -GRID_H / 2 - 0.3, 0]}
      />
    </group>
  );
}

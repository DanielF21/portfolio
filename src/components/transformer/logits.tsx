"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";

import { CONFIG } from "@/lib/transformer/config";
import { formatBytes, formatInt } from "@/lib/transformer/format";
import { BRANCH_Y, STREAM_WIDTH } from "@/lib/transformer/layout";
import { ACTIVATION, ACTIVATION_SOFT, OP_LINE } from "@/lib/transformer/theme";

import { Anchor } from "./anchor";
import { TensorSlab } from "./tensor-slab";

/**
 * The logits, and picking one.
 *
 * One score per vocabulary entry, for the last position: 151,936 numbers. Same
 * elision as the embedding wall, and for the same reason, because it is the
 * same axis.
 *
 * NO INVENTED DISTRIBUTION. It would be easy to give these bars plausible
 * varying heights and the shot would look better for it, but a made-up
 * probability distribution presented as a model's output is exactly the kind of
 * thing this piece is built not to do. The structure is drawn and one entry is
 * marked as sampled; the heights stay uniform until a real forward pass supplies
 * them.
 *
 * Worth noticing at this end of the model: the logits for ONE token are 297 KiB
 * at bf16, larger than the KV cache for ten tokens. They are also thrown away
 * immediately, which is the difference between an activation and a cache.
 */

const { vocabSize } = CONFIG;

const SHOWN = 14;
const ROW_H = 0.13;
const SEGMENT_H = SHOWN * ROW_H;
const GAP_H = 0.9;
const WIDTH = STREAM_WIDTH * 0.75;

/** Which drawn row is marked as the sampled token. Any row would do; this is a
 *  position in the drawing, not a claim about which token wins. */
const SAMPLED_ROW = 4;

export function Logits({ z }: { z: number }) {
  const breakEdges = useMemo(() => {
    const box = new THREE.BoxGeometry(WIDTH, GAP_H, 0.3);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    return edges;
  }, []);
  useEffect(() => () => breakEdges.dispose(), [breakEdges]);

  const bytesPerPosition = vocabSize * CONFIG.bytesPerParam;

  return (
    <group position={[0, BRANCH_Y, z]}>
      <TensorSlab
        nodeId="logits"
        kind="activation"
        rows={SHOWN}
        cols={1}
        size={[WIDTH, SEGMENT_H, 0.3]}
        position={[0, GAP_H / 2 + SEGMENT_H / 2, 0]}
      />
      <TensorSlab
        nodeId="logits"
        kind="activation"
        rows={SHOWN}
        cols={1}
        size={[WIDTH, SEGMENT_H, 0.3]}
        position={[0, -(GAP_H / 2 + SEGMENT_H / 2), 0]}
      />

      <lineSegments geometry={breakEdges}>
        <lineBasicMaterial color={OP_LINE} transparent opacity={0.5} />
      </lineSegments>

      {/* The one that was picked. Sampling is a choice over this whole column,
          and the column is the reason it is a choice at all. */}
      <mesh
        position={[
          0,
          GAP_H / 2 + SEGMENT_H - (SAMPLED_ROW + 0.5) * ROW_H,
          0.32,
        ]}
      >
        <boxGeometry args={[WIDTH * 1.12, ROW_H, 0.22]} />
        <meshStandardMaterial
          color={ACTIVATION_SOFT}
          emissive={ACTIVATION}
          emissiveIntensity={0.9}
          roughness={0.35}
          toneMapped={false}
        />
      </mesh>

      <Anchor
        overview
        id="logits"
        text="Logits"
        sub={`${formatInt(vocabSize)} scores · ${formatBytes(bytesPerPosition)} per position`}
        // Lifted clear of the LM head's label. Both sit at the output end of the
        // model within a few units of each other, and in-world labels do not
        // declutter themselves the way the old projected ones did: the fix is
        // to place them apart rather than to sort them at runtime.
        position={[WIDTH / 2, SEGMENT_H * 2 + GAP_H, 0]}
      />
      <Anchor
        id="sample"
        text="Sampled"
        sub="softmax over the vocabulary, then pick one"
        position={[
          WIDTH / 2,
          GAP_H / 2 + SEGMENT_H - (SAMPLED_ROW + 0.5) * ROW_H,
          0.32,
        ]}
      />
    </group>
  );
}

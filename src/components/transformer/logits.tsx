"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";

import { CONFIG } from "@/lib/transformer/config";
import { formatBytes, formatInt } from "@/lib/transformer/format";
import { STREAM_WIDTH } from "@/lib/transformer/layout";

import { WALL_Y } from "./embedding";
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

const SHOWN = 35;
const ROW_H = 0.13;
const WIDTH = STREAM_WIDTH * 0.75;
const TOTAL_H = SHOWN * ROW_H;
/** Same break mark as the wall beside it; see `embedding.tsx`. One tensor. */
const BREAK_GAP = 0.14;

/** Which drawn row is marked as the sampled token. Any row would do; this is a
 *  position in the drawing, not a claim about which token wins. */
const SAMPLED_ROW = 4;

export function Logits({ z }: { z: number }) {
  const breakMark = useMemo(() => {
    const x = WIDTH / 2;
    const pts = [
      -x, BREAK_GAP / 2, 0, x, BREAK_GAP / 2, 0,
      -x, -BREAK_GAP / 2, 0, x, -BREAK_GAP / 2, 0,
    ];
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  useEffect(() => () => breakMark.dispose(), [breakMark]);

  const bytesPerPosition = vocabSize * CONFIG.bytesPerParam;

  return (
    // Same axis as the wall beside it, and that is a real statement rather
    // than alignment for its own sake: both are elided along the SAME
    // 151,936-long vocabulary axis.
    <group position={[0, WALL_Y, z]}>
      <TensorSlab
        nodeId="logits"
        kind="activation"
        rows={SHOWN}
        cols={1}
        size={[WIDTH, TOTAL_H, 0.3]}
      />

      <lineSegments geometry={breakMark} position={[0, 0, 0.16]}>
        <lineBasicMaterial color={OP_LINE} transparent opacity={0.85} />
      </lineSegments>

      {/* The one that was picked. Sampling is a choice over this whole column,
          and the column is the reason it is a choice at all. */}
      <mesh
        position={[
          0,
          TOTAL_H / 2 - (SAMPLED_ROW + 0.5) * ROW_H,
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
        position={[WIDTH / 2, TOTAL_H / 2, 0]}
      />
      <Anchor
        id="sample"
        text="Sampled"
        sub="softmax over the vocabulary, then pick one"
        position={[
          WIDTH / 2,
          TOTAL_H / 2 - (SAMPLED_ROW + 0.5) * ROW_H,
          0.32,
        ]}
      />
    </group>
  );
}

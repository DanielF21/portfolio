"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";

import { CONFIG } from "@/lib/transformer/config";
import { formatCount, formatInt, formatPercent } from "@/lib/transformer/format";
import { BRANCH_Y, STREAM_WIDTH, WIDTHS } from "@/lib/transformer/layout";
import { DERIVED, totalParamsOf } from "@/lib/transformer/model";
import { ACTIVATION, OP_LINE } from "@/lib/transformer/theme";

import { Anchor } from "./anchor";
import { TensorSlab } from "./tensor-slab";

/**
 * The token embedding, drawn elided.
 *
 * 151,936 rows of 1,536. At the scale every other tensor in this scene uses,
 * the vocabulary axis is 297 world units against a 3 unit residual stream: two
 * orders of magnitude past anything that shares a frame with it. So this is the
 * one tensor drawn with a BREAK in it, and the break is deliberately visible.
 *
 * WHY A VISIBLE BREAK RATHER THAN A SQUASH. Silently scaling the vocabulary
 * axis down to fit would make the wall look like a tensor of a few dozen rows,
 * and the whole claim of this piece is that the geometry can be trusted. A gap
 * with the true count written across it says "this is not to scale here, and
 * here is the number" in the same glance. `layout.needsElision` decides which
 * tensors get this treatment, and only the vocabulary axis qualifies.
 *
 * The payoff is at the other end of the model. Qwen TIES its output projection
 * to this matrix, so the wall at the input and the wall at the output are the
 * same 233M parameters, counted once. `Embedding` renders both.
 */

const { vocabSize, hiddenSize } = CONFIG;

/** Rows drawn in each of the two real segments. Enough that the cell grid
 *  reads as a grid, few enough that they are obviously a sample. */
const SHOWN_ROWS = 16;
const ROW_H = 0.14;
const SEGMENT_H = SHOWN_ROWS * ROW_H;
/** The break. Wide enough to read as missing rather than as a seam. */
const GAP_H = 1.0;

const WIDTH = STREAM_WIDTH;
const TOTAL_H = SEGMENT_H * 2 + GAP_H;

interface Props {
  /** "in" is the token lookup, "out" is the tied output projection. */
  role: "in" | "out";
  z: number;
}

export function Embedding({ role, z }: Props) {
  const tied = CONFIG.tieWordEmbeddings;
  const params = totalParamsOf("embed");

  const breakEdges = useMemo(() => {
    const box = new THREE.BoxGeometry(WIDTH, GAP_H, 0.4);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    return edges;
  }, []);
  useEffect(() => () => breakEdges.dispose(), [breakEdges]);

  const text = role === "in" ? "Token embedding" : "LM head";
  const sub =
    role === "in"
      ? `${formatInt(vocabSize)} × ${formatInt(hiddenSize)} · ${formatCount(params)} params · ${formatPercent(DERIVED.embedShareOfModel)} of the model`
      : tied
        ? "the same tensor, transposed · 0 extra params"
        : `${formatInt(vocabSize)} × ${formatInt(hiddenSize)}`;

  return (
    <group position={[0, BRANCH_Y, z]}>
      {/* Upper segment: the first rows of the vocabulary. */}
      <TensorSlab
        nodeId={role === "in" ? "embed" : "lm_head"}
        rows={SHOWN_ROWS}
        cols={hiddenSize}
        size={[WIDTH, SEGMENT_H, 0.4]}
        position={[0, GAP_H / 2 + SEGMENT_H / 2, 0]}
      />

      {/* Lower segment: the last rows. */}
      <TensorSlab
        nodeId={role === "in" ? "embed" : "lm_head"}
        rows={SHOWN_ROWS}
        cols={hiddenSize}
        size={[WIDTH, SEGMENT_H, 0.4]}
        position={[0, -(GAP_H / 2 + SEGMENT_H / 2), 0]}
      />

      {/* The break itself, outlined so the gap reads as rows removed from one
          tensor rather than as two separate tensors stacked up. */}
      <lineSegments geometry={breakEdges}>
        <lineBasicMaterial color={OP_LINE} transparent opacity={0.5} />
      </lineSegments>

      {/* One row, pulled forward: the token you looked up. An embedding is a
          lookup, not a computation, and this is the whole of it. */}
      {role === "in" && (
        <mesh position={[0, -GAP_H / 2 - ROW_H * 2, 0.42]}>
          <boxGeometry args={[WIDTH, ROW_H, 0.28]} />
          <meshStandardMaterial
            color={ACTIVATION}
            emissive={ACTIVATION}
            emissiveIntensity={0.5}
            roughness={0.4}
          />
        </mesh>
      )}

      <Anchor
        overview
        id={`embed.${role}`}
        text={text}
        sub={sub}
        position={[WIDTH / 2, TOTAL_H / 2, 0]}
      />
      <Anchor
        id={`embed.${role}.break`}
        text={`${formatInt(vocabSize)} rows`}
        sub="drawn with a break: not to scale on this axis"
        position={[WIDTH / 2, 0, 0]}
      />
    </group>
  );
}

/** How wide the wall WOULD be if the vocabulary axis were drawn to the same
 *  scale as every other dimension. Kept so the break can say what it is
 *  hiding. */
export const UNELIDED_VOCAB_UNITS = WIDTHS.vocabTrue;

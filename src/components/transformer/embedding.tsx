"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";

import { CONFIG } from "@/lib/transformer/config";
import { formatCount, formatInt, formatPercent } from "@/lib/transformer/format";
import { STREAM_WIDTH, WIDTHS } from "@/lib/transformer/layout";
import { DERIVED, totalParamsOf } from "@/lib/transformer/model";
import { ACTIVATION, OP_LINE } from "@/lib/transformer/theme";

import { Anchor } from "./anchor";
import { PickBox } from "./pick";
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
const SHOWN_ROWS = 39;
const ROW_H = 0.14;

const WIDTH = STREAM_WIDTH;
const TOTAL_H = SHOWN_ROWS * ROW_H;

/**
 * Where the break mark sits, as a fraction of the height.
 *
 * ONE MATRIX, MARKED, NOT TWO PIECES WITH A GAP. The elision used to be drawn as
 * two slabs separated by a whole unit of nothing, and it read as exactly what it
 * looks like: two matrices. It is one. A gap is the wrong convention here,
 * because a gap is what you draw BETWEEN two objects.
 *
 * What a drawing uses to say "this part is shortened" is a BREAK MARK: a pair of
 * lines across an otherwise continuous part. That keeps the thing the elision
 * must not lose, which is that 151,936 rows are one tensor, and the true count
 * is on the label beside it.
 */
const BREAK_AT = 0.5;
const BREAK_GAP = 0.16;

/**
 * Which drawn row of the lower segment the stream leaves from.
 *
 * The stream must emerge from a ROW, not out of the break. Any row would do;
 * what matters is that the wall is seated so that row lands on y = 0.
 */
/**
 * The stream leaves the LAST drawn row.
 *
 * It was row 2, chosen only so the stream came out of a row rather than out of
 * the break. Using the last row seats the wall so its bottom edge sits with the
 * blocks' bottom edge instead of 1.9 units under it, which is the whole of "the
 * embedding and LM head are not centred with the transformer blocks". The stream
 * still leaves a real row; it is now the bottom one.
 */
const STREAM_ROW = SHOWN_ROWS - 1;
export const WALL_Y = (STREAM_ROW + 0.5) * ROW_H - TOTAL_H / 2;

interface Props {
  /** "in" is the token lookup at the start; "out" is the tied projection at the
   *  end. Same tensor, same geometry, opposite directions. */
  role: "in" | "out";
  z: number;
}

export function Embedding({ role, z }: Props) {
  const tied = CONFIG.tieWordEmbeddings;
  const params = totalParamsOf("embed");
  const lookup = role === "in";

  /** Two lines across the face: the drafting mark for a shortened part. */
  const breakMark = useMemo(() => {
    const y = TOTAL_H * (BREAK_AT - 0.5);
    const x = WIDTH / 2;
    const pts = [
      -x, y + BREAK_GAP / 2, 0, x, y + BREAK_GAP / 2, 0,
      -x, y - BREAK_GAP / 2, 0, x, y - BREAK_GAP / 2, 0,
    ];
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  useEffect(() => () => breakMark.dispose(), [breakMark]);

  return (
    <group position={[0, WALL_Y, z]}>
      {/* ONE TENSOR, DRAWN AT BOTH ENDS, and that is not the same mistake as
          before. Reading order beats the loop: a model runs input to output, and
          drawing it as a ring put both ends of it at the near end of the stack
          with only a norm at the far one. The tie is a fact about MEMORY, not
          about dataflow, so it belongs in the accounting rather than in the
          shape: `model.ts` gives the LM head `params: 0` and `tiedTo: "embed"`,
          the card says "the same tensor, transposed", and the total stays
          1.54B rather than the 1.78B you get by counting it twice. */}

      {/* Upper segment: the first rows of the vocabulary. */}
      <TensorSlab
        nodeId={lookup ? "embed" : "lm_head"}
        rows={SHOWN_ROWS}
        cols={hiddenSize}
        size={[WIDTH, TOTAL_H, 0.4]}
      />

      {/* The break mark. See `BREAK_AT`. */}
      <lineSegments geometry={breakMark} position={[0, 0, 0.21]}>
        <lineBasicMaterial color={OP_LINE} transparent opacity={0.85} />
      </lineSegments>

      {/* The row the stream leaves from, lit. An embedding is a LOOKUP, not a
          computation, and this is the whole of it: one row of the wall becomes
          the residual stream. Placed at -WALL_Y so it lands on y = 0, and pushed
          toward the model rather than away from it, so the highlighted row and
          the conduit leaving it are the same line. */}
      {lookup && (
        <mesh position={[0, -WALL_Y, -0.34]}>
          <boxGeometry args={[WIDTH, ROW_H, 0.28]} />
          <meshStandardMaterial
            color={ACTIVATION}
            emissive={ACTIVATION}
            emissiveIntensity={0.6}
            roughness={0.4}
          />
        </mesh>
      )}

      <Anchor
        overview
        id={lookup ? "embed" : "lm_head"}
        text={lookup ? "Token embedding" : "LM head"}
        sub={
          lookup
            ? `${formatInt(vocabSize)} × ${formatInt(hiddenSize)} · ${formatCount(params)} params · ${formatPercent(DERIVED.embedShareOfModel)} of the model`
            : tied
              ? "the same tensor, transposed · 0 extra params"
              : `${formatInt(vocabSize)} × ${formatInt(hiddenSize)}`
        }
        position={[WIDTH / 2, TOTAL_H / 2, 0]}
      />
      <Anchor
        id={`${lookup ? "embed" : "lm_head"}.break`}
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

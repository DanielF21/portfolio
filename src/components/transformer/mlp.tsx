"use client";

import { useEffect, useMemo } from "react";

import { CONFIG } from "@/lib/transformer/config";
import { formatCount, formatPercent, formatShape } from "@/lib/transformer/format";
import {
  BLOCK_BASELINE,
  MLP_DEPTH,
  SEQ_HEIGHT,
  SEQ_TOKENS,
  SLAB_DEPTH,
  WIDTHS,
  heightFor,
} from "@/lib/transformer/layout";
import { DERIVED, nodeById, totalParamsOf } from "@/lib/transformer/model";
import { WEIGHT_DIM } from "@/lib/transformer/theme";

import { Anchor } from "./anchor";
import { taperGeometry } from "./taper";
import { TensorSlab } from "./tensor-slab";

/**
 * The bulge.
 *
 * 1536 in, 8960 across, 1536 back out. At this scale that is 3 world units
 * widening to 17.5 and back, and it is 88% of a block's parameters. Nothing
 * says that as well as the shape does, which is the whole reason the extents in
 * `layout.ts` are proportional to real dimensions.
 *
 * Gate and up are drawn as two plates because they are two separate matrices of
 * identical shape reading the same input. That they are a pair, not one wide
 * matrix, is the thing about SwiGLU that gets lost in prose.
 *
 * DOWN IS PERPENDICULAR TO GATE AND UP, and that is not a composition choice.
 * Width is the output dimension and height is the input one, everywhere. Gate
 * and up are [1536 -> 8960], so they are 17.5 wide and 3.0 tall. Down is
 * [8960 -> 1536], so it is 3.0 wide and 17.5 tall. A matrix and its
 * transpose-shaped inverse come out at right angles to each other because they
 * ARE at right angles, and the three of them have identical parameter counts
 * (13,762,560 each), which the equal areas say without a caption.
 *
 * Before heights were real, `down` was drawn 17.5 wide like the other two even
 * though its output dimension is 1536, so it was 5.8x too wide and nothing in
 * the scene contradicted it.
 */

const { hiddenSize, intermediateSize } = CONFIG;

/** Names and shapes come from the model graph, so a label cannot disagree with
 *  the geometry standing next to it. */
const label = (id: string) => nodeById(id)?.label ?? id;
const shapeOf = (id: string) => {
  const node = nodeById(id);
  return node
    ? `${formatShape(node.shape)} · ${formatCount(totalParamsOf(id))} params`
    : "";
};

export function Mlp() {
  const wide = WIDTHS.intermediate;
  const narrow = WIDTHS.stream;
  /** Both weight heights, from the real input dimensions. */
  const hIn = heightFor(hiddenSize);
  const hInter = heightFor(intermediateSize);

  // Kept shallow in the sequence axis on purpose. At full height these are two
  // solid wedges as visually massive as the matrices themselves, and the MLP
  // reads as one dark block with the actual weights lost inside it. As thin
  // ribbons they do their only job, which is to carry the eye from the stream's
  // width out to the intermediate width and back.
  const lip = SEQ_HEIGHT * 0.22;
  const widen = useMemo(
    () => taperGeometry(narrow, lip, wide, lip, 0.6),
    [narrow, wide, lip]
  );
  const narrowAgain = useMemo(
    () => taperGeometry(wide, lip, narrow, lip, 0.6),
    [narrow, wide, lip]
  );

  useEffect(
    () => () => {
      widen.dispose();
      narrowAgain.dispose();
    },
    [widen, narrowAgain]
  );

  const z = {
    widen: MLP_DEPTH / 2,
    gate: MLP_DEPTH / 2 - 0.45,
    up: MLP_DEPTH / 2 - 0.95,
    act: 0,
    down: -MLP_DEPTH / 2 + 0.6,
    narrow: -MLP_DEPTH / 2,
  };

  // Bottom aligned on the branch, per BLOCK_BASELINE. `y(h)` is the centre of
  // something `h` tall standing on that line.
  const y = (h: number) => BLOCK_BASELINE + h / 2;

  return (
    <group>
      <mesh geometry={widen} position={[0, y(lip), z.widen]}>
        <meshStandardMaterial color={WEIGHT_DIM} roughness={0.85} flatShading />
      </mesh>

      {/* Gate and up: same shape, same input, different weights, both reading
          the stream at once. Separated along the flow axis rather than stacked,
          because at 3.0 tall each they no longer fit either side of the
          activation, and being side by side is the better picture anyway: they
          are parallel branches, not a sandwich. */}
      <TensorSlab
        nodeId="block.mlp.gate"
        rows={hiddenSize}
        cols={intermediateSize}
        size={[wide, hIn, SLAB_DEPTH]}
        position={[0, y(hIn), z.gate]}
      />
      <TensorSlab
        nodeId="block.mlp.up"
        rows={hiddenSize}
        cols={intermediateSize}
        size={[wide, hIn, SLAB_DEPTH]}
        position={[0, y(hIn), z.up]}
      />

      {/* The widened activation, and the widest object in the model. The only
          thing in this station that exists per token, so its height comes from
          the sequence rather than from a model dimension. */}
      <TensorSlab
        nodeId="block.mlp.swiglu"
        kind="activation"
        rows={SEQ_TOKENS}
        cols={intermediateSize}
        size={[wide, SEQ_HEIGHT, 0.3]}
        position={[0, y(SEQ_HEIGHT), z.act]}
      />

      {/* 8960 in, 1536 out: narrow and tall where gate and up are wide and
          short. Same area, because the same parameter count. */}
      <TensorSlab
        nodeId="block.mlp.down"
        rows={intermediateSize}
        cols={hiddenSize}
        size={[narrow, hInter, SLAB_DEPTH]}
        position={[0, y(hInter), z.down]}
      />

      <Anchor
        id="mlp.gate"
        text={label("block.mlp.gate")}
        sub={shapeOf("block.mlp.gate")}
        position={[wide / 2, y(hIn), z.gate]}
      />
      <Anchor
        id="mlp.up"
        text={label("block.mlp.up")}
        sub={shapeOf("block.mlp.up")}
        position={[-wide / 2, y(hIn), z.up]}
      />
      <Anchor
        id="mlp.act"
        text="Intermediate"
        // The widest thing in the model, and the reason the block bulges.
        sub={`${SEQ_TOKENS} × ${intermediateSize.toLocaleString("en-US")}`}
        position={[-wide / 2, y(SEQ_HEIGHT), z.act]}
      />
      <Anchor
        id="mlp.down"
        text={label("block.mlp.down")}
        sub={shapeOf("block.mlp.down")}
        position={[narrow / 2, BLOCK_BASELINE + hInter, z.down]}
      />
      <Anchor
        id="mlp.share"
        text="SwiGLU MLP"
        sub={`${formatCount(totalParamsOf("block.mlp"))} params · ${formatPercent(
          DERIVED.mlpShareOfModel
        )} of the model`}
        position={[-wide / 2, BLOCK_BASELINE + hIn * 1.4, z.act]}
      />

      <mesh geometry={narrowAgain} position={[0, y(lip), z.narrow]}>
        <meshStandardMaterial color={WEIGHT_DIM} roughness={0.85} flatShading />
      </mesh>
    </group>
  );
}

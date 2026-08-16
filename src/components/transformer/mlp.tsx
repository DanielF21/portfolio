"use client";

import { useEffect, useMemo } from "react";

import { CONFIG } from "@/lib/transformer/config";
import { formatCount, formatPercent, formatShape } from "@/lib/transformer/format";
import { MLP_DEPTH, SEQ_HEIGHT, SEQ_TOKENS, WIDTHS } from "@/lib/transformer/layout";
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
 * says that as well as the shape does, which is the whole reason the widths in
 * `layout.ts` are proportional to real dimensions.
 *
 * Gate and up are drawn as two plates because they are two separate matrices of
 * identical shape reading the same input. That they are a pair, not one wide
 * matrix, is the thing about SwiGLU that gets lost in prose.
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
    weights: MLP_DEPTH / 2 - 0.5,
    act: 0,
    down: -MLP_DEPTH / 2 + 0.5,
    narrow: -MLP_DEPTH / 2,
  };

  return (
    <group>
      <mesh geometry={widen} position={[0, 0, z.widen]}>
        <meshStandardMaterial color={WEIGHT_DIM} roughness={0.85} flatShading />
      </mesh>

      {/* Gate and up: same shape, same input, different weights, both reading
          the stream at once. Kept short in the sequence axis and offset either
          side of centre so the activation between them is never hidden behind
          them, whatever angle you orbit to. */}
      <TensorSlab
        nodeId="block.mlp.gate"
        rows={hiddenSize}
        cols={intermediateSize}
        size={[wide, SEQ_HEIGHT * 0.3, 0.16]}
        position={[0, SEQ_HEIGHT * 0.32, z.weights]}
      />
      <TensorSlab
        nodeId="block.mlp.up"
        rows={hiddenSize}
        cols={intermediateSize}
        size={[wide, SEQ_HEIGHT * 0.3, 0.16]}
        position={[0, -SEQ_HEIGHT * 0.32, z.weights]}
      />

      {/* The widened activation, and the widest object in the model. The only
          thing in this station that exists per token. */}
      <TensorSlab
        nodeId="block.mlp.swiglu"
        kind="activation"
        rows={SEQ_TOKENS}
        cols={intermediateSize}
        size={[wide, SEQ_HEIGHT, 0.3]}
        position={[0, 0, z.act]}
      />

      <TensorSlab
        nodeId="block.mlp.down"
        rows={intermediateSize}
        cols={hiddenSize}
        size={[wide, SEQ_HEIGHT * 0.36, 0.16]}
        position={[0, 0, z.down]}
      />

      <Anchor
        id="mlp.gate"
        text={label("block.mlp.gate")}
        sub={shapeOf("block.mlp.gate")}
        position={[wide / 2, SEQ_HEIGHT * 0.32, z.weights]}
      />
      <Anchor
        id="mlp.up"
        text={label("block.mlp.up")}
        sub={shapeOf("block.mlp.up")}
        position={[wide / 2, -SEQ_HEIGHT * 0.32, z.weights]}
      />
      <Anchor
        id="mlp.act"
        text="Intermediate"
        // The widest thing in the model, and the reason the block bulges.
        sub={`${SEQ_TOKENS} × ${intermediateSize.toLocaleString("en-US")}`}
        position={[-wide / 2, 0, z.act]}
      />
      <Anchor
        id="mlp.down"
        text={label("block.mlp.down")}
        sub={shapeOf("block.mlp.down")}
        position={[wide / 2, 0, z.down]}
      />
      <Anchor
        id="mlp.share"
        text="SwiGLU MLP"
        sub={`${formatCount(totalParamsOf("block.mlp"))} params · ${formatPercent(
          DERIVED.mlpShareOfModel
        )} of the model`}
        position={[-wide / 2, SEQ_HEIGHT * 0.6, z.act]}
      />

      <mesh geometry={narrowAgain} position={[0, 0, z.narrow]}>
        <meshStandardMaterial color={WEIGHT_DIM} roughness={0.85} flatShading />
      </mesh>
    </group>
  );
}

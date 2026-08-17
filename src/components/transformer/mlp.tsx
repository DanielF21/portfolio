"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";

import { CONFIG } from "@/lib/transformer/config";
import { formatCount, formatShape } from "@/lib/transformer/format";
import {
  BLOCK_BASELINE,
  QKV_PITCH,
  INTERMEDIATE_BREAK,
  INTERMEDIATE_DRAWN,
  INTERMEDIATE_SEGMENT,
  INTERMEDIATE_SEGMENT_COLS,
  INTERMEDIATE_TRUE,
  MLP_DEPTH,
  SEQ_HEIGHT,
  SEQ_TOKENS,
  SLAB_DEPTH,
  WIDTHS,
  heightFor,
} from "@/lib/transformer/layout";
import { nodeById, totalParamsOf } from "@/lib/transformer/model";
import { OP_LINE } from "@/lib/transformer/theme";

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


/**
 * A weight whose intermediate axis is drawn with a break.
 *
 * Two real segments at the true cell pitch, a gap, and an outline round the gap
 * so the removal is something you can see rather than something you have to be
 * told. Exactly the device `embedding.tsx` uses for the vocabulary axis, for
 * exactly the same reason: 8,960 drawn to scale is 17.5 units and swamps the
 * block it is part of.
 *
 * `axis` is which of the slab's two axes the intermediate dimension runs along.
 * Gate and up project INTO it, so it is their width; down projects OUT of it, so
 * it is their height, and the break turns through 90 degrees with the matrix.
 */
function ElidedWeight({
  nodeId,
  axis,
  other,
  otherDim,
  z,
  yBase = 0,
}: {
  nodeId: string;
  axis: "x" | "y";
  other: number;
  otherDim: number;
  z: number;
  /** Lifts the whole weight, for the second of a stacked pair. */
  yBase?: number;
}) {
  const offset = INTERMEDIATE_BREAK / 2 + INTERMEDIATE_SEGMENT / 2;

  const edges = useMemo(() => {
    const box =
      axis === "x"
        ? new THREE.BoxGeometry(INTERMEDIATE_BREAK, other, SLAB_DEPTH * 1.6)
        : new THREE.BoxGeometry(other, INTERMEDIATE_BREAK, SLAB_DEPTH * 1.6);
    const e = new THREE.EdgesGeometry(box);
    box.dispose();
    return e;
  }, [axis, other]);
  useEffect(() => () => edges.dispose(), [edges]);

  const size = (seg: number): [number, number, number] =>
    axis === "x" ? [seg, other, SLAB_DEPTH] : [other, seg, SLAB_DEPTH];
  const at = (d: number): [number, number, number] =>
    axis === "x"
      ? [d, BLOCK_BASELINE + yBase + other / 2, z]
      : [0, BLOCK_BASELINE + yBase + INTERMEDIATE_DRAWN / 2 + d, z];

  // Rows are the INPUT dim and columns the OUTPUT one, as everywhere.
  const rows = axis === "x" ? otherDim : INTERMEDIATE_SEGMENT_COLS;
  const cols = axis === "x" ? INTERMEDIATE_SEGMENT_COLS : otherDim;

  return (
    <group>
      <TensorSlab
        nodeId={nodeId}
        rows={rows}
        cols={cols}
        size={size(INTERMEDIATE_SEGMENT)}
        position={at(-offset)}
      />
      <TensorSlab
        nodeId={nodeId}
        rows={rows}
        cols={cols}
        size={size(INTERMEDIATE_SEGMENT)}
        position={at(offset)}
      />
      <lineSegments geometry={edges} position={at(0)}>
        <lineBasicMaterial color={OP_LINE} transparent opacity={0.7} />
      </lineSegments>
    </group>
  );
}

export function Mlp() {
  const wide = WIDTHS.intermediate;
  const narrow = WIDTHS.stream;
  /** Every weight here reads or writes the 1,536 wide stream, so this is the
   *  axis that is still drawn true. */
  const hIn = heightFor(hiddenSize);

  // FULL SEQUENCE HEIGHT, not a lip. At 0.22 of it the tapers were 0.44 units
  // tall against plates 3.0 tall, invisible at any distance the station is
  // actually viewed from, so the widening they exist to show never read at all.
  // The activation running through them IS [seq, ...], so the sequence height is
  // also the honest section for them.
  const lip = SEQ_HEIGHT;
  //
  // DRAWN AS LINE WORK, NOT AS SOLIDS. A taper is the activation changing shape;
  // it holds no parameters, and `theme.ts` reserves solids for things that do.
  // At full height the solid version was two dark wedges as visually massive as
  // the matrices themselves, which buried the intermediate activation running
  // between them: the exact failure the old 0.44 lip was dodging. Line work has
  // no mass, so it can be honest about the height without competing.
  const widen = useMemo(
    () => new THREE.EdgesGeometry(taperGeometry(narrow, lip, wide, lip, 0.6)),
    [narrow, wide, lip]
  );
  const narrowAgain = useMemo(
    () => new THREE.EdgesGeometry(taperGeometry(wide, lip, narrow, lip, 0.6)),
    [narrow, wide, lip]
  );

  useEffect(
    () => () => {
      widen.dispose();
      narrowAgain.dispose();
    },
    [widen, narrowAgain]
  );

  // FIVE STAGES, EVENLY SPACED, AND GATE AND UP SHARE ONE.
  //
  // They used to be strung along Z at 0.55, 1.35 and 0, which put `up` 0.05 from
  // the intermediate activation: two objects of identical width effectively
  // coincident, each hiding the other. Separating them further along Z cannot
  // fix that, because two parallel plates of the same width seen from any raking
  // angle overlap almost completely however far apart they are.
  //
  // So gate and up stack VERTICALLY at one z, the way Q, K and V share a level,
  // and for the same reason: what is being shown is that they are a PAIR of
  // matrices of identical shape reading the same input. Identical shape is
  // legible as two objects one above the other and illegible as two objects
  // behind each other. `QKV_PITCH` is reused so the gap between them cannot
  // drift from the gap used everywhere else.
  const z = {
    widen: MLP_DEPTH / 2,
    gateUp: MLP_DEPTH / 2 - 0.9,
    act: 0,
    down: -MLP_DEPTH / 2 + 0.9,
    narrow: -MLP_DEPTH / 2,
  };

  // Bottom aligned on the branch, per BLOCK_BASELINE. `y(h)` is the centre of
  // something `h` tall standing on that line.
  const y = (h: number) => BLOCK_BASELINE + h / 2;

  return (
    <group>
      <lineSegments geometry={widen} position={[0, y(lip), z.widen]}>
        <lineBasicMaterial color={OP_LINE} transparent opacity={0.75} />
      </lineSegments>

      {/* Gate and up: same shape, same input, different weights, both reading
          the stream at once. Separated along the flow axis rather than stacked,
          because at 3.0 tall each they no longer fit either side of the
          activation, and being side by side is the better picture anyway: they
          are parallel branches, not a sandwich.

          Both drawn with a break in the intermediate axis. See
          `INTERMEDIATE_DRAWN`. */}
      <ElidedWeight
        nodeId="block.mlp.gate"
        axis="x"
        other={hIn}
        otherDim={hiddenSize}
        z={z.gateUp}
      />
      <ElidedWeight
        nodeId="block.mlp.up"
        axis="x"
        other={hIn}
        otherDim={hiddenSize}
        z={z.gateUp}
        yBase={QKV_PITCH}
      />

      {/* The widened activation, and the widest object in the model. The only
          thing in this station that exists per token, so its height comes from
          the sequence rather than from a model dimension. */}
      <TensorSlab
        nodeId="block.mlp.swiglu"
        kind="activation"
        rows={SEQ_TOKENS}
        cols={INTERMEDIATE_SEGMENT_COLS * 2}
        size={[wide, SEQ_HEIGHT, 0.3]}
        position={[0, y(SEQ_HEIGHT), z.act]}
      />

      {/* 8960 in, 1536 out: narrow and tall where gate and up are wide and
          short. Same area, because the same parameter count. */}
      <ElidedWeight
        nodeId="block.mlp.down"
        axis="y"
        other={narrow}
        otherDim={hiddenSize}
        z={z.down}
      />

      {/* Four labels, placed on four different sides.
          IN-WORLD LABELS DO NOT DECLUTTER THEMSELVES the way the deleted DOM
          pool did, which is the price of them being occluded correctly and
          never drifting. The whole cost of that is having to place them apart
          by hand, and this station is where it shows: gate and up are the same
          shape at the same height, so anchoring both to the left edge stacked
          "Up projection" straight on top of "Intermediate". */}
      <Anchor
        id="mlp.gate"
        text={label("block.mlp.gate")}
        sub={shapeOf("block.mlp.gate")}
        position={[wide / 2, y(hIn), z.gateUp]}
      />
      <Anchor
        id="mlp.up"
        text={label("block.mlp.up")}
        sub={shapeOf("block.mlp.up")}
        position={[-wide / 2, QKV_PITCH + y(hIn), z.gateUp]}
      />
      <Anchor
        id="mlp.act"
        text="Intermediate"
        // The widest thing in the model, and the reason the block bulges.
        sub={`${SEQ_TOKENS} × ${intermediateSize.toLocaleString("en-US")}`}
        // Above the activation it names, not 0.9 BELOW the baseline it cites.
        // Anything under the baseline is outside the bounding box the camera
        // fits, and therefore outside the frame.
        position={[0, BLOCK_BASELINE + SEQ_HEIGHT + 0.25, z.act]}
      />
      <Anchor
        id="mlp.down"
        text={label("block.mlp.down")}
        sub={shapeOf("block.mlp.down")}
        position={[narrow / 2, BLOCK_BASELINE + INTERMEDIATE_DRAWN, z.down]}
      />

      <lineSegments geometry={narrowAgain} position={[0, y(lip), z.narrow]}>
        <lineBasicMaterial color={OP_LINE} transparent opacity={0.75} />
      </lineSegments>
    </group>
  );
}

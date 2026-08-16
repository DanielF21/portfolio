"use client";

import { CONFIG } from "@/lib/transformer/config";
import { visibleUnder } from "@/lib/transformer/glossary";
import { BLOCK_W, BRANCH_Y, STATIONS } from "@/lib/transformer/layout";
import { useTransformerStore } from "@/lib/transformer/store";

import { Attention } from "./attention";
import { Mlp } from "./mlp";
import { ResidualJunction, StreamTap } from "./residual";
import { Scope } from "./scope";
import { TensorSlab } from "./tensor-slab";

/**
 * The hero block, opened up on the branch above the stream.
 *
 * Stations run along Z in dataflow order, input nearest the camera. Everything
 * here is one layer's worth; the other 27 are the plates receding behind it.
 *
 * Note how small the norms are next to the projections. An RMSNorm is a single
 * vector of 1536 gains, so it is one row of cells against the MLP's 13.8
 * million per matrix, and it gets a thin bar because that is what it is.
 * Drawing every named operation at the same visual weight is the most common
 * way these diagrams mislead.
 *
 * The two adds are what make the residual stream a stream rather than a chain,
 * so they get their own stations instead of being implied. Attention and the
 * MLP each get their own read and their own add, which is why there are two
 * branches and not one around the whole block.
 */

const { hiddenSize } = CONFIG;

/**
 * One learned gain per channel, and nothing else.
 *
 * Drawn as a single thin bar rather than a full height plate, because it IS a
 * single row: 1536 numbers against the MLP's 13.8 million per matrix.
 */
function RmsNorm({ nodeId }: { nodeId: string }) {
  return (
    <TensorSlab
      nodeId={nodeId}
      rows={1}
      cols={hiddenSize}
      size={[BLOCK_W, 0.38, 0.12]}
    />
  );
}

export function Block() {
  const focus = useTransformerStore((s) => s.focus);
  // Taps sit in stream space rather than on the branch, so they cannot live
  // inside the station's own scope group. They are gated by the same rule by
  // hand: a tap belonging to a hidden station would otherwise float between the
  // camera and whatever is being inspected.
  const tap = (id: string) => visibleUnder(focus, id);

  return (
    <>
      {tap("block.ln1") && <StreamTap z={STATIONS.ln1} />}
      {tap("block.add1") && <ResidualJunction z={STATIONS.add1} />}
      {tap("block.ln2") && <StreamTap z={STATIONS.ln2} />}
      {tap("block.add2") && <ResidualJunction z={STATIONS.add2} />}

      <group position={[0, BRANCH_Y, 0]}>
        <Scope id="block.ln1" position={[0, 0, STATIONS.ln1]}>
          <RmsNorm nodeId="block.ln1" />
        </Scope>

        <Scope id="block.attn" position={[0, 0, STATIONS.attn]}>
          <Attention />
        </Scope>

        <Scope id="block.ln2" position={[0, 0, STATIONS.ln2]}>
          <RmsNorm nodeId="block.ln2" />
        </Scope>

        <Scope id="block.mlp" position={[0, 0, STATIONS.mlp]}>
          <Mlp />
        </Scope>
      </group>
    </>
  );
}

"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";

import { CONFIG } from "@/lib/transformer/config";
import {
  BLOCK_BASELINE,
  BRANCH_Y,
  MIN_AXIS,
  SEQ_HEIGHT,
  SEQ_TOKENS,
  SLAB_DEPTH,
  STATIONS,
  widthFor,
} from "@/lib/transformer/layout";
import { view } from "@/lib/transformer/view";

import { Attention } from "./attention";
import { Branch } from "./branch";
import { Mlp } from "./mlp";
import { RmsNorm } from "./norm";
import { ResidualJunction, StreamTap } from "./residual";
import { Scope } from "./scope";
import { TensorSlab } from "./tensor-slab";

/**
 * The hero block, opened up on the branch above the stream.
 *
 * Stations run along Z in dataflow order, input nearest the camera, spaced so
 * that the off-axis camera every in-block shot uses separates them rather than
 * stacking them. Everything here is one layer's worth; the other 27 are the
 * plates receding at either end.
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
 * The branch a station's machinery stands on.
 *
 * Every scope now starts at stream level rather than at branch level, so a
 * station's TAP is inside its own scope. That matters more than it sounds:
 * `auto-frame` measures a scope, and a norm measured without its tap is a bar
 * floating at y = 2.5 with no visible reason to be there. Measured with it, the
 * shot runs from the stream up to the gains, which is the whole operation.
 */
function OnBranch({ children }: { children: React.ReactNode }) {
  return <group position={[0, BRANCH_Y, 0]}>{children}</group>;
}

/** Never let the matrix go singular. At 1e-3 the block is a speck inside its
 *  own plate, which is where it should be at the start of the bloom. */
const MIN_BLOOM = 1e-3;

export function Block() {
  const ref = useRef<THREE.Group>(null);

  // THE WHOLE BLOCK GROWS OUT OF ITS PLATE, in one line, because every station's
  // POSITION is a child of this transform as well as its geometry. Scaling here
  // therefore collapses the 53 unit run back to the block's own origin at the
  // same time as it shrinks the parts, so at bloom 0 the entire interior is a
  // point inside the plate and at 1 it is the exploded view. That is the
  // "everything lives inside one of the blocks and expands" reading, and it
  // arrives at exactly the rate the other 27 blocks are moving because both are
  // driven by `view.explode`.
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    g.scale.setScalar(Math.max(MIN_BLOOM, view.explode));
  });

  return (
    <Scope id="block">
      {/* Scaled from the block's origin, which sits on the stream at the middle
          of the plate's footprint. */}
      <group ref={ref}>
        {/* The two runs the block computes on, UNDER the baseline so the
            stations rest on them. See `branch.tsx` for why the first attempt at
            this had to be deleted. */}
        <Branch />

        <Scope id="block.ln1" position={[0, 0, STATIONS.ln1]}>
          <StreamTap z={0} />
          <OnBranch>
            <RmsNorm nodeId="block.ln1" label="RMSNorm" />
          </OnBranch>
        </Scope>

        <Scope id="block.attn" position={[0, 0, STATIONS.attn]}>
          <OnBranch>
            <Attention />
          </OnBranch>
        </Scope>

        <Scope id="block.add1" position={[0, 0, STATIONS.add1]}>
          <ResidualJunction nodeId="block.add1" />
        </Scope>

        <Scope id="block.ln2" position={[0, 0, STATIONS.ln2]}>
          <StreamTap z={0} />
          <OnBranch>
            <RmsNorm nodeId="block.ln2" label="RMSNorm" />
          </OnBranch>
        </Scope>

        <Scope id="block.mlp" position={[0, 0, STATIONS.mlp]}>
          <OnBranch>
            <Mlp />
          </OnBranch>
        </Scope>

        <Scope id="block.add2" position={[0, 0, STATIONS.add2]}>
          <ResidualJunction nodeId="block.add2" />
        </Scope>
      </group>
    </Scope>
  );
}

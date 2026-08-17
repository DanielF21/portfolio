"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { CONFIG } from "@/lib/transformer/config";
import {
  ATTN_STATIONS,
  BLOCK_BASELINE,
  HEAD_FILL,
  SCORES_SIZE,
  SEQ_TOKENS,
  SLAB_DEPTH,
  heightFor,
  widthFor,
} from "@/lib/transformer/layout";
import { formatCount, formatShape } from "@/lib/transformer/format";
import { DERIVED, nodeById, totalParamsOf } from "@/lib/transformer/model";
import { ACTIVATION, CACHE, OP_LINE, WEIGHT_DIM } from "@/lib/transformer/theme";

import { Anchor } from "./anchor";
import { PickBox } from "./pick";
import { Rope } from "./rope";
import { Scope } from "./scope";
import { Scores } from "./scores";
import { TensorSlab } from "./tensor-slab";

/**
 * Attention, and the place grouped query attention becomes a fact you can see.
 *
 * Q projects 1536 to 1536. K and V project 1536 to 256, because there are only
 * two key/value heads to twelve query heads. At this scale that is a 3 unit
 * plate against two 0.5 unit plates, and the ratio on screen is exactly the
 * ratio in the config. It is the reason the KV cache costs 28 KiB per token
 * instead of 168, and it is a line in a paper that nobody pictures until they
 * see the three plates side by side.
 *
 * The head split below it is the same fact from the other direction: twelve
 * query heads spread across 3 units, two key/value heads bunched into 0.5, and
 * six ribbons converging on each. Every head slice sits at its TRUE centre and
 * is merely drawn narrow (`HEAD_FILL`) to leave a gap, so the group's extent
 * stays honest even though the gaps are invented.
 */

const { numAttentionHeads: nQ, numKeyValueHeads: nKV, hiddenSize } = CONFIG;
const { headDim, kvDim, groupSize } = DERIVED;

const HEAD_PITCH = widthFor(headDim);
const Q_SPAN = widthFor(nQ * headDim);
const KV_SPAN = widthFor(kvDim);

const SLICE_H = 0.42;

/**
 * The two head rows, BOTTOM ALIGNED ON THE BRANCH like everything else.
 *
 * They used to sit at +0.62 and -0.62, straddling the branch, which put the
 * entire key/value row BELOW the line the projections that feed it grow up from.
 * The six-to-one fan is unchanged: it is defined from these two constants, so
 * moving them carries it.
 */
const ROW_GAP = 1.24;
const Y_KV = BLOCK_BASELINE + SLICE_H / 2;
const Y_Q = Y_KV + ROW_GAP;

/** Every projection reads the 1,536 wide stream, so every one is this tall. */
const PLATE_H = heightFor(hiddenSize);

/**
 * Q, K and V SIDE BY SIDE ON ONE LEVEL, standing on the branch.
 *
 * They used to be stacked vertically, three plates at three heights, and the
 * comment here argued that comparing widths against a shared left edge is what a
 * reader can actually do. That was right about the comparison and wrong about
 * how to get it: bottom aligned side by side, all three share an edge AND a
 * baseline, so the 6:1 is the gap between two adjacent objects rather than
 * something the eye has to carry across 3.34 units of vertical travel.
 *
 * Equal height is still the fact it always was: height is the input dimension
 * and all three read the same 1,536 wide stream. Now that they are level, that
 * equality is visible as a flat top edge rather than as three separate readings.
 */
const QKV_GAP = 0.34;
const QKV_SPAN = Q_SPAN + 2 * KV_SPAN + 2 * QKV_GAP;

/** Centre of the `i`th plate, left to right: Q, then K, then V. */
function xOf(i: number): number {
  const left = -QKV_SPAN / 2;
  if (i === 0) return left + Q_SPAN / 2;
  if (i === 1) return left + Q_SPAN + QKV_GAP + KV_SPAN / 2;
  return left + Q_SPAN + 2 * QKV_GAP + KV_SPAN + KV_SPAN / 2;
}

/** One level for all three. */
const QKV_Y = BLOCK_BASELINE + PLATE_H / 2;

/** Labels stagger down the plate rather than sharing its top edge: K and V sit
 *  0.85 apart and their names are wider than that. Sprites are excluded from the
 *  fit, so moving them sideways instead would move them out of frame. */
const LABEL_Y = [PLATE_H, PLATE_H * 0.62, PLATE_H * 0.24];

/** Centre of head `k` in a row of `n` heads, in world units. */
function headX(k: number, n: number): number {
  return (k - (n - 1) / 2) * HEAD_PITCH;
}

/**
 * The six-to-one fan, as one merged geometry and therefore one draw call.
 *
 * A ribbon per query head, from its slice down to the key/value head it shares.
 * Twelve ribbons collapsing onto two is the whole picture of what "grouped"
 * means.
 */
function fanGeometry(): THREE.BufferGeometry {
  const w = HEAD_PITCH * 0.14;
  const yTop = Y_Q - SLICE_H / 2;
  const yBottom = Y_KV + SLICE_H / 2;
  const positions: number[] = [];

  for (let k = 0; k < nQ; k++) {
    const x0 = headX(k, nQ);
    const x1 = headX(Math.floor(k / groupSize), nKV);
    const a = [x0 - w, yTop, 0];
    const b = [x0 + w, yTop, 0];
    const c = [x1 + w, yBottom, 0];
    const d = [x1 - w, yBottom, 0];
    positions.push(...a, ...b, ...c);
    positions.push(...a, ...c, ...d);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

const dummy = new THREE.Object3D();

/** A row of head slices, one instanced draw call. */
function HeadRow({
  count,
  y,
  colour,
}: {
  count: number;
  y: number;
  colour: string;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let k = 0; k < count; k++) {
      dummy.position.set(headX(k, count), y, 0);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(k, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [count, y]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry args={[HEAD_PITCH * HEAD_FILL, SLICE_H, 0.22]} />
      <meshStandardMaterial
        color={colour}
        emissive={colour}
        emissiveIntensity={0.2}
        roughness={0.5}
      />
    </instancedMesh>
  );
}

/**
 * The eleven heads you are not looking at.
 *
 * Every head runs the same computation on its own slice, so drawing twelve
 * score grids at full detail would be eleven repetitions of one idea. They
 * recede behind the hero as thin outlines instead, which keeps "there are
 * twelve of these" true without spending the frame on it.
 */
function GhostHeads() {
  const geo = useMemo(
    () => new THREE.BoxGeometry(SCORES_SIZE, SCORES_SIZE, 0.02),
    []
  );
  const edges = useMemo(() => new THREE.EdgesGeometry(geo), [geo]);
  useEffect(
    () => () => {
      geo.dispose();
      edges.dispose();
    },
    [geo, edges]
  );

  return (
    <>
      {Array.from({ length: nQ - 1 }, (_, k) => (
        <lineSegments
          key={k}
          geometry={edges}
          position={[0, BLOCK_BASELINE + SCORES_SIZE / 2, -0.09 * (k + 1)]}
        >
          <lineBasicMaterial
            color={OP_LINE}
            transparent
            opacity={0.3 * (1 - k / nQ)}
          />
        </lineSegments>
      ))}
    </>
  );
}

/**
 * Label text for a weight, taken from the model graph rather than written out.
 *
 * Every figure a label states is derived, so a label cannot disagree with the
 * geometry beside it: both read the same config.
 */
function weightLabel(id: string): { text: string; sub: string } {
  const node = nodeById(id);
  if (!node) return { text: id, sub: "" };
  return {
    text: node.label,
    sub: `${formatShape(node.shape)} · ${formatCount(totalParamsOf(id))} params`,
  };
}

export function Attention() {
  const fan = useMemo(fanGeometry, []);
  useEffect(() => () => fan.dispose(), [fan]);

  const q = weightLabel("block.attn.q");
  const k = weightLabel("block.attn.k");
  const v = weightLabel("block.attn.v");
  const o = weightLabel("block.attn.o");

  return (
    <group>
      {/* The three projections, as a bar chart you can walk around.

          Equal heights, and that is now a FACT rather than a drawing
          convention: height is the input dimension and all three read the same
          1,536 wide stream, so all three are exactly heightFor(1536) tall. The
          only thing that differs is width, which is the output dimension, which
          is the only thing that differs in the model. K and V are a sixth of Q's
          width and therefore a sixth of its area, which is the whole of GQA in
          one picture.

          Stacked rather than side by side because comparing horizontal extents
          against a shared left edge is what a reader can actually do; three bars
          of differing WIDTH placed side by side is the same data drawn so it
          cannot be read. */}
      <Scope id="block.attn.qkv" position={[0, 0, ATTN_STATIONS.qkv]}>
        <TensorSlab
          nodeId="block.attn.q"
          rows={hiddenSize}
          cols={nQ * headDim}
          size={[Q_SPAN, PLATE_H, SLAB_DEPTH]}
          position={[xOf(0), QKV_Y, 0]}
        />
        <Anchor id="q" text={q.text} sub={q.sub} position={[xOf(0), LABEL_Y[0], 0]} />

        <TensorSlab
          nodeId="block.attn.k"
          rows={hiddenSize}
          cols={kvDim}
          size={[KV_SPAN, PLATE_H, SLAB_DEPTH]}
          position={[xOf(1), QKV_Y, 0]}
        />
        <Anchor id="k" text={k.text} sub={k.sub} position={[xOf(1), LABEL_Y[1], 0]} />

        <TensorSlab
          nodeId="block.attn.v"
          rows={hiddenSize}
          cols={kvDim}
          size={[KV_SPAN, PLATE_H, SLAB_DEPTH]}
          position={[xOf(2), QKV_Y, 0]}
        />
        <Anchor id="v" text={v.text} sub={v.sub} position={[xOf(2), LABEL_Y[2], 0]} />
      </Scope>

      {/* Position, applied as rotation, between projecting and splitting. */}
      <Scope id="block.attn.rope" position={[0, 0, ATTN_STATIONS.rope]}>
        <Rope />
      </Scope>

      {/* The split into heads, and the six-to-one sharing. */}
      <Scope id="block.attn.heads" position={[0, 0, ATTN_STATIONS.heads]}>
        {/* EACH ROW PICKS AS THE PROJECTION IT IS THE SPLIT OF. The top row was
            wired to `block.attn.context`, which is the weighted sum of V and
            happens much later, so hovering the query heads answered "Attention
            output". The two nodes whose notes already describe exactly these
            rows are `q` ("12 query heads of 128") and `k` ("Only 2 key heads, so
            1/6 the width of Q"), and V has the identical shape to K.

            Instanced slices cannot carry their own handlers, and one box per row
            is the answer a reader wants anyway. */}
        <PickBox
          nodeId="block.attn.q"
          size={[Q_SPAN, SLICE_H, 0.3]}
          position={[0, Y_Q, 0]}
        />
        <PickBox
          nodeId="block.attn.k"
          size={[KV_SPAN, SLICE_H, 0.3]}
          position={[0, Y_KV, 0]}
        />
        <HeadRow count={nQ} y={Y_Q} colour={ACTIVATION} />
        <HeadRow count={nKV} y={Y_KV} colour={CACHE} />
        <mesh geometry={fan}>
          <meshStandardMaterial
            color={WEIGHT_DIM}
            side={THREE.DoubleSide}
            roughness={0.7}
          />
        </mesh>
        {/* Both below their row, in the gap the fan leaves.
            Not off the right ends: the two rows span the full width of the shot
            by design (that span IS the 6:1 reading), so a label anchored to
            either right edge starts at the frame edge and runs out of it. And
            not above the query row either, because the fit measures geometry
            and sprites are excluded from it, so a label placed outside the
            geometry's bounding box is outside the frame. */}
        <Anchor
          id="qheads"
          text={`${nQ} query heads`}
          sub={`${headDim} each`}
          position={[0, Y_Q - SLICE_H, 0]}
        />
        {/* ABOVE its row, not below it. Below was fine while the rows straddled
            the branch; bottom aligned, the key/value row's underside IS the
            baseline, so a label under it sits outside the bounding box the
            camera fits and therefore outside the frame. Both labels now sit in
            the gap the fan leaves between the rows. */}
        <Anchor
          id="kvheads"
          text={`${nKV} key/value heads`}
          sub={`shared ${groupSize} ways`}
          position={[0, Y_KV + SLICE_H, 0]}
        />
      </Scope>

      <Scope id="block.attn.scores" position={[0, 0, ATTN_STATIONS.scores]}>
        <Scores />
        <GhostHeads />
        <Anchor
          id="scores"
          text="Scores, masked"
          sub={`${SEQ_TOKENS} × ${SEQ_TOKENS} per head`}
          position={[SCORES_SIZE / 2, BLOCK_BASELINE + SCORES_SIZE, 0]}
        />
      </Scope>

      {/* `block.attn.o`, not `block.attn.out`: the scope path is the node id,
          which is what lets the card answer for an index entry as well as for a
          mesh. The station's layout key stays `out`. */}
      <Scope id="block.attn.o" position={[0, 0, ATTN_STATIONS.out]}>
        {/* 1536 in, 1536 out, so a square: the same area as Q, which is the
            same parameter count. It used to be a 3.0 x 0.5 bar, which left 96%
            of its frame empty and understated it against the MLP. */}
        <TensorSlab
          nodeId="block.attn.o"
          rows={nQ * headDim}
          cols={hiddenSize}
          size={[Q_SPAN, PLATE_H, SLAB_DEPTH]}
          position={[0, BLOCK_BASELINE + PLATE_H / 2, 0]}
        />
        <Anchor
          id="o"
          text={o.text}
          sub={o.sub}
          position={[Q_SPAN / 2, BLOCK_BASELINE + PLATE_H / 2, 0]}
        />
      </Scope>
    </group>
  );
}

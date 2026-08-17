"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { CONFIG } from "@/lib/transformer/config";
import {
  BRANCH_Y,
  CONDUIT_H,
  CONDUIT_W,
  END_GAP,
  JUNCTION_RUN,
  SEQ_HEIGHT,
  SEQ_TOKENS,
  STREAM_WIDTH,
  stackZRange,
} from "@/lib/transformer/layout";
import { useTransformerStore } from "@/lib/transformer/store";
import { OP_LINE, STREAM } from "@/lib/transformer/theme";
import { view } from "@/lib/transformer/view";

import { Anchor } from "./anchor";
import { usePick } from "./pick";
import { TensorSlab } from "./tensor-slab";

/** How long the marked place on the stream runs. */
const COLLAR_Z = 1.1;

/**
 * The residual stream, drawn as one continuous bar through the entire model.
 *
 * This is the single most important thing in the scene and it is one box. Every
 * block reads from it and adds back into it; nothing replaces it. Drawing it as
 * an unbroken thread that the blocks hang off, rather than as arrows between
 * boxes, is the difference between "a chain of layers" and "a bus that every
 * layer edits", and the second one is what a transformer actually is.
 *
 * Drawn at `CONDUIT_W` rather than at the stream's true cross section, for the
 * reason set out at that constant. The true width is used where the stream is
 * actually operated on, which is where the MLP taper starts.
 */
/**
 * The stream runs from the final norm INTO the wall, and terminates inside it.
 *
 * It used to overshoot the stack by its own constant while `stack.tsx` placed
 * the wall by a different one, leaving 2.9 units of air between the end of the
 * bus and the thing it is supposed to flow out of. Both ends now derive from
 * `END_GAP`, so there is nothing to keep in step.
 */
function endsOf(layer: number, explode: number): [number, number] {
  const [zMin, zMax] = stackZRange(layer, explode);
  return [zMin - END_GAP, zMax + END_GAP];
}

export function Residual() {
  const layer = useTransformerStore((s) => s.layer);
  const ref = useRef<THREE.Mesh>(null);
  const pick = usePick("stream");

  // ALWAYS DRAWN, AND ALWAYS THE WHOLE LENGTH. Two earlier versions truncated
  // it: first to nothing while a station was isolated, then to the open block's
  // own run. Both were fixes for a camera sitting almost on the stack's axis,
  // where a bar running the length of that axis is seen end on and becomes a
  // column through the middle of the shot. No camera stands there any more, and
  // the stream running unbroken past every station is the one thing in the
  // picture that says the stations are all edits to the same thing.
  //
  // Its length changes as the stack blooms open, so it is scaled in the frame
  // loop rather than re-rendered: the geometry is one unit long in Z and the
  // scale carries the rest.
  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const [lo, hi] = endsOf(layer, view.explode);
    mesh.scale.z = hi - lo;
    mesh.position.z = (lo + hi) / 2;
  });

  return (
    <mesh
      ref={ref}
      // Never part of a subject's bounding box. It runs the whole length of the
      // model, so `auto-frame` measuring it means every shot that includes it
      // frames the entire conduit: "One block" backed off to 78 units for a
      // block 9 units deep, and the block became a speck. It is context that
      // spans the scene, like the ground plane, not a thing you look at.
      userData={{ noFit: true }}
      {...pick}
    >
      <boxGeometry args={[CONDUIT_W, CONDUIT_H, 1]} />
      {/* Emissive kept low. This runs the entire length of the model, so it is
          the largest single surface in the scene and anything bright enough to
          read as a glow up close becomes a wall of colour at the overview. */}
      <meshStandardMaterial
        color={STREAM}
        emissive={STREAM}
        emissiveIntensity={0.18}
        roughness={0.55}
        metalness={0}
      />
    </mesh>
  );
}

/**
 * A READ: a tee off the bus, pulling a copy up to the block's machinery.
 *
 * It used to say here that a read and an add "are drawn identically because they
 * are the same wire". That is now reversed on purpose. They are not the same
 * operation, and in a piece whose rule is that shape carries meaning they should
 * not share one: a read taps the bus and stays vertical, an add MERGES and comes
 * in leaning at the flow's angle. See `ResidualJunction`.
 */
export function StreamTap({
  z = 0,
  bright = false,
}: {
  z?: number;
  bright?: boolean;
}) {
  const height = BRANCH_Y - CONDUIT_H / 2;
  const pick = usePick("stream");
  return (
    <mesh position={[0, CONDUIT_H / 2 + height / 2, z]} {...pick}>
      <boxGeometry args={[CONDUIT_W * 0.6, height, 0.22]} />
      <meshStandardMaterial
        color={STREAM}
        emissive={STREAM}
        emissiveIntensity={bright ? 0.55 : 0.25}
        roughness={0.5}
      />
    </mesh>
  );
}

/**
 * Where the block's result rejoins the stream.
 *
 * THIS USED TO BE THE ONE STATION WITH NO BODY ON THE BRANCH. Every other
 * station stands on the branch and grows upward; the add was a widened box lying
 * on the stream with a post going up, so in a row of ten it was the only thing
 * glued to the floor. It also made two false claims: a vertical post says a read
 * (a tee off the bus) when this is a merge, and fattening the conduit by 50%
 * says the add changes the stream's shape, which is exactly what an add does not
 * do.
 *
 * So it gets the same three parts every other station has, and they are all
 * things that exist:
 *
 *  - **on the branch**, the block's output arriving: an activation slice at the
 *    stream's true width and the same sequence height every other activation in
 *    the scene uses. That is what is being added, and it is the body that puts
 *    this station on the same level as its neighbours.
 *  - **the merge**, a run of branch leaning downstream into the conduit rather
 *    than dropping onto it vertically. Two paths converging is what "+" means.
 *  - **on the stream**, a collar at the conduit's TRUE section with an outline
 *    round it. The palette reserves solids for parameters and line work for
 *    operations, and an add has none; a bright collar and an outline say
 *    something happens here and it is free.
 */
export function ResidualJunction({ nodeId }: { nodeId: string }) {
  const pick = usePick(nodeId);

  const RUN = JUNCTION_RUN;
  const drop = BRANCH_Y - CONDUIT_H / 2;
  const length = Math.hypot(drop, RUN);

  const collarEdges = useMemo(() => {
    const box = new THREE.BoxGeometry(
      CONDUIT_W * 1.5,
      CONDUIT_H * 2.2,
      COLLAR_Z
    );
    const e = new THREE.EdgesGeometry(box);
    box.dispose();
    return e;
  }, []);
  useEffect(() => () => collarEdges.dispose(), [collarEdges]);

  return (
    <group>
      {/* What is being added, standing on the branch like every other station. */}
      <TensorSlab
        nodeId="stream"
        kind="activation"
        rows={SEQ_TOKENS}
        cols={CONFIG.hiddenSize}
        size={[STREAM_WIDTH, SEQ_HEIGHT, 0.3]}
        position={[0, BRANCH_Y + SEQ_HEIGHT / 2, RUN]}
      />

      {/* The merge. Leaning downstream, because it is a join and not a tap. */}
      <mesh
        position={[0, CONDUIT_H / 2 + drop / 2, RUN / 2]}
        rotation={[Math.atan2(RUN, drop), 0, 0]}
        {...pick}
      >
        <boxGeometry args={[CONDUIT_W * 0.6, length, 0.22]} />
        <meshStandardMaterial
          color={STREAM}
          emissive={STREAM}
          emissiveIntensity={0.5}
          roughness={0.5}
        />
      </mesh>

      {/* The place on the stream. True section: an add does not change shape. */}
      <mesh {...pick}>
        <boxGeometry args={[CONDUIT_W, CONDUIT_H, COLLAR_Z]} />
        <meshStandardMaterial
          color={STREAM}
          emissive={STREAM}
          emissiveIntensity={0.55}
          roughness={0.5}
        />
      </mesh>
      <lineSegments geometry={collarEdges}>
        <lineBasicMaterial color={OP_LINE} transparent opacity={0.8} />
      </lineSegments>

      <Anchor
        id={nodeId}
        text="Residual add"
        sub="no parameters · the stream keeps what it had and gains what the block computed"
        position={[STREAM_WIDTH / 2, BRANCH_Y + SEQ_HEIGHT / 2, RUN]}
      />
    </group>
  );
}

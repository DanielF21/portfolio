"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { CONFIG } from "@/lib/transformer/config";
import { formatInt } from "@/lib/transformer/format";
import { SEQ_TOKENS } from "@/lib/transformer/layout";
import { DERIVED } from "@/lib/transformer/model";
import { ACTIVATION, OP_LINE } from "@/lib/transformer/theme";

import { Anchor } from "./anchor";

/**
 * Rotary position embedding, drawn as rotation.
 *
 * RoPE takes each ADJACENT PAIR of dimensions in a query or key vector and
 * rotates that pair by an angle. The angle is the token's position times a
 * frequency, and each pair gets its own frequency, spaced geometrically from 1
 * down to 1/theta. There are no parameters: nothing here is learned, it is a
 * fixed rotation applied on the way into attention.
 *
 * So the honest drawing is a bank of dials. A row per dimension pair, a column
 * per token position, and every needle at the angle RoPE would actually turn
 * it to. The angles below are computed from the real `rope_theta`, so the
 * pattern on screen is the pattern in the model: the top rows sweep through
 * whole turns across a dozen tokens, the bottom rows have barely moved.
 *
 * That spread is the whole idea. Fast pairs encode which token is next to
 * which; slow pairs still discriminate positions thousands of tokens apart.
 * One rotation carries both, which is why RoPE extrapolates further than a
 * learned position table.
 */

const { ropeTheta } = CONFIG;
const { headDim } = DERIVED;

/** Dimension pairs drawn. The head has `headDim / 2` of them; a sample down
 *  the range says more than 64 needles. */
const PAIRS = 8;
const COLS = SEQ_TOKENS;

const CELL = 0.42;
const NEEDLE = CELL * 0.34;

/** RoPE's frequency for pair `i`, exactly as the model computes it:
 *  1 / theta^(2i / headDim). */
function inverseFreq(pairIndex: number): number {
  return 1 / Math.pow(ropeTheta, (2 * pairIndex) / headDim);
}

/** Pair indices sampled across the head's range, so both ends are represented
 *  rather than only the fast end. */
const SAMPLED = Array.from({ length: PAIRS }, (_, i) =>
  Math.round((i * (headDim / 2 - 1)) / (PAIRS - 1))
);

const dummy = new THREE.Object3D();

export function Rope() {
  const needlesRef = useRef<THREE.InstancedMesh>(null);
  const count = PAIRS * COLS;

  const ring = useMemo(
    () => new THREE.RingGeometry(NEEDLE * 0.95, NEEDLE, 20),
    []
  );
  useEffect(() => () => ring.dispose(), [ring]);

  useLayoutEffect(() => {
    const mesh = needlesRef.current;
    if (!mesh) return;
    let k = 0;
    for (let r = 0; r < PAIRS; r++) {
      const freq = inverseFreq(SAMPLED[r]);
      for (let t = 0; t < COLS; t++) {
        // The actual RoPE angle for this pair at this position.
        const angle = t * freq;
        dummy.position.set(
          (t - (COLS - 1) / 2) * CELL,
          -(r - (PAIRS - 1) / 2) * CELL,
          0.02
        );
        dummy.rotation.set(0, 0, angle);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(k, dummy.matrix);
        k += 1;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  const facesRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = facesRef.current;
    if (!mesh) return;
    let k = 0;
    for (let r = 0; r < PAIRS; r++) {
      for (let t = 0; t < COLS; t++) {
        dummy.position.set(
          (t - (COLS - 1) / 2) * CELL,
          -(r - (PAIRS - 1) / 2) * CELL,
          0
        );
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(k, dummy.matrix);
        k += 1;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <group>
      {/* The dial faces. */}
      <instancedMesh ref={facesRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <primitive object={ring} attach="geometry" />
        <meshBasicMaterial color={OP_LINE} transparent opacity={0.35} side={THREE.DoubleSide} />
      </instancedMesh>

      {/* The needles, each at its real angle. */}
      <instancedMesh ref={needlesRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <boxGeometry args={[NEEDLE, NEEDLE * 0.16, 0.04]} />
        <meshBasicMaterial color={ACTIVATION} toneMapped={false} />
      </instancedMesh>

      <Anchor
        id="rope.fast"
        text="Fastest pair"
        sub="a full turn every few tokens"
        position={[-(COLS / 2) * CELL - 0.3, ((PAIRS - 1) / 2) * CELL, 0]}
      />
      <Anchor
        id="rope.slow"
        text="Slowest pair"
        sub={`period ${formatInt(Math.round(2 * Math.PI / inverseFreq(SAMPLED[PAIRS - 1])))} tokens`}
        position={[-(COLS / 2) * CELL - 0.3, -((PAIRS - 1) / 2) * CELL, 0]}
      />
      {/* No "RoPE" label here. The index, the breadcrumb, the card and the
          status bar all already say it, and this was the fourth copy: placed
          outside the grid's bounding box, which the camera fits, so it was
          clipped by the top of the frame as well as redundant. The two labels
          that stay are the ones the picture cannot say by itself. */}
    </group>
  );
}


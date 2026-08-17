"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { damp } from "@/lib/transformer/camera";
import { CONFIG } from "@/lib/transformer/config";
import {
  BLOCK_H,
  BLOCK_PITCH,
  BLOCK_W,
  CONDUIT_H,
  END_GAP,
  KV_ORIGIN,
  LOGITS_GAP,
  OPEN_EPSILON,
  PLATE_DEPTH,
  blockZ,
  stackZRange,
  tierFor,
} from "@/lib/transformer/layout";
import { arm } from "@/lib/transformer/activate";
import { useTransformerStore } from "@/lib/transformer/store";
import { STREAM, WEIGHT, WEIGHT_DIM } from "@/lib/transformer/theme";
import { requestRefit, view } from "@/lib/transformer/view";

import { formatCount, formatPercent } from "@/lib/transformer/format";
import { DERIVED } from "@/lib/transformer/model";

import { Anchor } from "./anchor";
import { Block } from "./block";
import { Embedding } from "./embedding";
import { KvCache } from "./kv-cache";
import { Logits } from "./logits";
import { usePick } from "./pick";
import { Residual } from "./residual";
import { Scope } from "./scope";

/**
 * The stack of blocks, at three levels of detail.
 *
 * Exactly one block is exploded, its immediate neighbours are solid slabs, and
 * every other block is a thin plate. That is what makes 28 blocks legible
 * without pretending there are fewer of them: the repetition stays visible as
 * a receding row of plates while only one block costs real geometry.
 *
 * NOTHING HERE IS HIDDEN BY FOCUS ANY MORE. The plates, the two ends and the
 * stream used to disappear the moment anything inside a block was selected,
 * because the camera then sat almost on the stack's axis and they were all
 * between it and the subject. The in-block cameras now stand well off that axis
 * and the stations are spaced for it, so the stack can stay drawn, which is the
 * only way a part of a block ever reads as a part OF something.
 *
 * OPENING IS A MOTION. `view.explode` runs 0 to 1 and the instance matrices are
 * rewritten while it moves, so asking for a block pushes the other 27 aside
 * rather than replacing the picture with a different one. Twenty-three units of
 * travel done as a jump reads as a cut; done as a motion it reads as the thing
 * it is.
 *
 * Plates and the hero's two solid neighbours are each ONE InstancedMesh sized
 * for every layer, with unused slots scaled to zero rather than the instance
 * count changing. The count varies as focus moves, and resizing an InstancedMesh
 * means reallocating it. The planet's snowball pool does the same thing for the
 * same reason.
 *
 * THERE IS NO TAP MESH ANY MORE. A collapsed block stands directly on the
 * stream, so contact says what a post used to have to say.
 */

const N = CONFIG.numHiddenLayers;

/** Reused for every matrix write, so the loop allocates nothing. */
const dummy = new THREE.Object3D();
const HIDDEN = new THREE.Vector3(0, 0, 0);
const SHOWN = new THREE.Vector3(1, 1, 1);

/**
 * e-folds per second for the bloom.
 *
 * Faster than the camera chase on purpose. The camera does not begin its flight
 * until the bloom has settled (see `auto-frame`: a block measured mid-bloom is
 * measured at the wrong size), so this number is added to the wait before
 * anything moves. At 7 the block is 95% open in 0.43s, which is short enough to
 * read as one gesture with the flight that follows it.
 */
const EXPLODE_LAMBDA = 7;

/**
 * Height of the bright lip where a block meets the stream.
 *
 * TWO JOBS THE DELETED TAPS WERE DOING, and both are real. A plate is 4.2 wide
 * and the conduit under it is 1.0, so standing the plates directly on the stream
 * hides nearly all of it: measured at the overview, only slivers show in the 0.6
 * gaps between plates. And the taps were the one bright, easily hit thing at the
 * overview, which is precisely what "clicking a block does nothing" turned out
 * to hinge on.
 *
 * A lip at the plate's FULL width does both, and says something truer than a 0.5
 * wide spike did: a block touches the bus across its whole footprint.
 */
const LIP_H = 0.16;

export function Stack() {
  const layer = useTransformerStore((s) => s.layer);
  const focus = useTransformerStore((s) => s.focus);
  // A block is only opened once you have asked to look at one. See `tierFor`.
  const open = focus === "block" || (focus?.startsWith("block.") ?? false);

  const platesRef = useRef<THREE.InstancedMesh>(null);
  const solidsRef = useRef<THREE.InstancedMesh>(null);
  const lipsRef = useRef<THREE.InstancedMesh>(null);
  const inEndRef = useRef<THREE.Group>(null);
  const outEndRef = useRef<THREE.Group>(null);

  // The interior stays mounted until the bloom has actually closed, or asking
  // for the overview would delete a 41 unit block one frame before the plates
  // start moving back in to fill the hole it left.
  const [interior, setInterior] = useState(false);
  useEffect(() => {
    view.explodeTo = open ? 1 : 0;
    if (open) setInterior(true);
  }, [open]);

  const openBlock = useTransformerStore((s) => s.openBlock);
  // The plates sit outside every `Scope`, so this carries hover only; the click
  // destination is supplied explicitly below.
  const pickBlock = usePick("block", true);
  const pickStream = usePick("stream", true);

  /**
   * Clicking any of the 28 opens one.
   *
   * The plates sit outside every `Scope`, so they cannot use `usePick`'s
   * navigate-to-your-own-scope rule and get an explicit destination instead.
   * Which block is decided in the store; see `openBlock` for why it is not the
   * one under the cursor.
   *
   * `requestRefit` runs even when the focus does not change, which is the case
   * that made this look broken: with a block already open, clicking one of the
   * plates it had pushed aside called `setFocus("block")`, hit the unchanged
   * guard, and did nothing at all. Now it re-frames.
   *
   * Armed on PRESS and fired by the release, not `onClick`. See `activate.ts`.
   */
  const clickProps = {
    onPointerDown: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      arm(() => {
        openBlock();
        requestRefit();
      });
    },
  };

  /** Rewrites every instance matrix for one value of the bloom. */
  const place = (t: number) => {
    const plates = platesRef.current;
    const solids = solidsRef.current;
    const lips = lipsRef.current;
    if (!plates || !solids || !lips) return;

    // THE HERO'S PLATE SHRINKS AS ITS CONTENTS GROW OUT OF IT. Both are driven
    // by the same number, so the interior does not appear beside the plate, it
    // replaces it. Previously the plate vanished on the first frame of the bloom
    // and the stations popped in at full size, which is what made opening a
    // block read as a cut rather than as an unfolding, and what left the block
    // sitting on top of the stack for half a second on the way back out.
    const heroScale = Math.max(0, 1 - t);

    for (let i = 0; i < N; i++) {
      const tier = tierFor(i, layer, t);
      const z = blockZ(i, layer, t);
      const hero = tier === "exploded";

      // STANDING ON THE STREAM. The plate's underside rests on the conduit's top
      // face. It used to float a whole branch height above it on a 0.5 wide
      // post, which is 5.95% of the plate's silhouette and the BRIGHT element
      // against a near-background plate: a bright stick holding a dark card,
      // which is what "why are the transformer heads on sticks" was about.
      //
      // Contact is not enclosure. This is not the "stream through the middle"
      // idea that failed twice; the plate sits above the conduit, so all 0.55 of
      // the stream's height stays visible under an unbroken row of them, and
      // `PLATE_DEPTH` under `BLOCK_PITCH` leaves a 0.6 gap between every pair to
      // see it through.
      //
      // COLLAPSE TOWARD THE BLOCK'S ORIGIN, WHICH IS ON THE STREAM. The interior
      // grows from y = 0, since `Block`'s group is scaled by the same number, so
      // a hero plate shrinking about its own centre would vanish to a point 2.8
      // units above where its contents appear and the bloom would visibly tear.
      const plateY = CONDUIT_H / 2 + BLOCK_H / 2;
      dummy.position.set(0, hero ? plateY * heroScale : plateY, z);
      dummy.rotation.set(0, 0, 0);
      // A zero scale is how a slot opts out. Scaling to zero collapses the box
      // to a point, which draws nothing and costs one skipped instance.
      dummy.scale.setScalar(hero ? heroScale : tier === "plate" ? 1 : 0);
      dummy.updateMatrix();
      plates.setMatrixAt(i, dummy.matrix);

      dummy.position.set(0, plateY, z);
      dummy.scale.copy(tier === "solid" ? SHOWN : HIDDEN);
      dummy.updateMatrix();
      solids.setMatrixAt(i, dummy.matrix);

      // Where the block meets the bus. Shrinks with the hero for the same
      // reason the plate does.
      const lipY = CONDUIT_H / 2 + LIP_H / 2;
      dummy.position.set(0, hero ? lipY * heroScale : lipY, z);
      dummy.scale.setScalar(hero ? heroScale : 1);
      dummy.updateMatrix();
      lips.setMatrixAt(i, dummy.matrix);
    }
    plates.instanceMatrix.needsUpdate = true;
    solids.instanceMatrix.needsUpdate = true;
    lips.instanceMatrix.needsUpdate = true;

    // RECOMPUTE THE BOUNDING SPHERES, or none of this is hoverable.
    //
    // `InstancedMesh.raycast` rejects against a cached bounding sphere before it
    // tests a single instance, and three computes that sphere once, lazily, from
    // whatever the matrices held at the time. These matrices are rewritten every
    // frame the stack is blooming, so the cached sphere is the one from the
    // first frame: at the overview it is the collapsed 30 unit run, and the ray
    // misses it entirely once the block has pushed everything 23 units aside.
    //
    // It cost nothing before because the plates were hidden whenever anything
    // was focused and nobody could point at them. They are always drawn now, and
    // pointing at one is how you find out it is a block.
    plates.computeBoundingSphere();
    solids.computeBoundingSphere();
    lips.computeBoundingSphere();

    // The two ends hug whichever end of the stack currently exists, so they
    // travel outward with the bloom instead of ending up inside it.
    const [zMin, zMax] = stackZRange(layer, t);
    if (inEndRef.current) inEndRef.current.position.z = zMax + END_GAP;
    if (outEndRef.current) outEndRef.current.position.z = zMin - END_GAP;
  };

  // Placed once on mount and whenever the hero changes, so a layer step is
  // instant rather than a tween through 27 wrong positions.
  useEffect(() => {
    place(view.explode);
    // `place` closes over `layer`, which is the only thing that would change it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer]);

  const settling = useRef(false);

  useFrame((_, dt) => {
    const target = view.explodeTo;
    const moving = Math.abs(view.explode - target) > 1e-4;

    if (moving) {
      // CLAMP THE STEP. `damp` is frame-rate independent, which is the right
      // property and also means one long frame swallows the whole animation:
      // after a tab has been idle or a chunk has just compiled, the first delta
      // can be hundreds of milliseconds and the bloom completes in that single
      // frame, which is exactly the "the items just spawn" it exists to fix.
      // A third of a second per step caps the damage at a visible jump instead
      // of an instant one.
      view.explode = damp(view.explode, target, EXPLODE_LAMBDA, Math.min(dt, 1 / 30));
      place(view.explode);
      settling.current = true;
      return;
    }

    if (!settling.current) return;
    settling.current = false;
    view.explode = target;
    place(target);
    if (target <= OPEN_EPSILON) setInterior(false);

    // Measure once more now that everything has stopped. `auto-frame` waits a
    // frame of its own before it measures, so this lands on geometry that is
    // both settled and fully applied.
    requestRefit();
  });

  return (
    <group>
      <Residual />

      {/* Every plate, in one draw call. Hovering any of them answers "block",
          because that is what one is: the same structure as the open one. */}
      <instancedMesh
        ref={platesRef}
        args={[undefined, undefined, N]}
        // The stack spans the frame in the default shot, so it is never fully
        // off screen and per-instance frustum culling can only cost time.
        frustumCulled={false}
        {...pickBlock}
        {...clickProps}
      >
        <boxGeometry args={[BLOCK_W, BLOCK_H, PLATE_DEPTH]} />
        <meshStandardMaterial color={WEIGHT_DIM} roughness={0.85} metalness={0} />
      </instancedMesh>

      {/* Where each block meets the stream. See `LIP_H`. */}
      <instancedMesh
        ref={lipsRef}
        args={[undefined, undefined, N]}
        frustumCulled={false}
        {...pickStream}
        {...clickProps}
      >
        <boxGeometry args={[BLOCK_W, LIP_H, PLATE_DEPTH * 1.02]} />
        <meshStandardMaterial
          color={STREAM}
          emissive={STREAM}
          emissiveIntensity={0.38}
          roughness={0.5}
          metalness={0}
        />
      </instancedMesh>

      {/* The hero's neighbours. One more draw call, and they exist to say "the
          thing you are looking at is one of these" without competing with it. */}
      <instancedMesh
        ref={solidsRef}
        args={[undefined, undefined, N]}
        frustumCulled={false}
        {...pickBlock}
        {...clickProps}
      >
        <boxGeometry args={[BLOCK_W, BLOCK_H, BLOCK_PITCH * 0.62]} />
        <meshStandardMaterial color={WEIGHT} roughness={0.8} metalness={0} />
      </instancedMesh>


      {/* The stack itself, named at the overview like both ends are. It was the
          only part of the model with no label there, which read as an oversight
          rather than as a decision. Every figure is derived. */}
      <Anchor
        overview
        id="blocks"
        text="Transformer blocks"
        sub={`${formatCount(DERIVED.paramsAllBlocks)} params · ${formatPercent(
          DERIVED.paramsAllBlocks / DERIVED.paramsTotal
        )} of the model`}
        position={[BLOCK_W / 2, CONDUIT_H / 2 + BLOCK_H, 0]}
      />

      {/* THE MODEL READS IN ONE DIRECTION: lookup, blocks, projection, logits.
          It was briefly drawn as a loop, on the grounds that the embedding and
          the LM head are physically one tied tensor, and that put both ends of
          the model at the near end of the stack with only a norm at the far one.
          Reading order wins: the tie is a fact about memory, and memory is what
          `model.ts` and the card are for. */}
      <group ref={inEndRef}>
        <Embedding role="in" z={0} />
      </group>
      <group ref={outEndRef}>
        <Embedding role="out" z={0} />
        <Logits z={-LOGITS_GAP} />
      </group>

      {/* The cache is not part of the forward pass geometry: it is what
          survives between passes. It gets its own view rather than a place in
          the line of stations, and it is the one thing focus still mounts and
          unmounts, because it has no place in the model to be seen in context
          OF. Everything else is now always drawn.

          Wrapped in a Scope so `Anchor` can read its path from context and
          `auto-frame` can find it by name. */}
      {focus === "kv" && (
        <Scope id="kv" position={[...KV_ORIGIN]}>
          <KvCache />
        </Scope>
      )}

      {/* Only once you have asked for a block. At the overview the hero is a
          plate like the other 27; see `tierFor`. */}
      {interior && <Block />}
    </group>
  );
}

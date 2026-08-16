"use client";

import { OVERVIEW_ID } from "@/lib/transformer/glossary";
import {
  BRANCH_Y,
  CONDUIT_H,
  CONDUIT_W,
  EXPLODED_DEPTH,
  stackZRange,
} from "@/lib/transformer/layout";
import { useTransformerStore } from "@/lib/transformer/store";
import { STREAM } from "@/lib/transformer/theme";

import { Anchor } from "./anchor";

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
export function Residual() {
  const layer = useTransformerStore((s) => s.layer);
  // While a station is isolated the camera sits almost on the stack's axis, and
  // a bar running the length of that axis is then seen end on: it becomes a
  // column straight through the middle of the shot. The taps stay, so the
  // station still visibly reads from and writes to something.
  const focus = useTransformerStore((s) => s.focus);
  const [zMin, zMax] = stackZRange(layer);

  if (focus !== null && focus !== OVERVIEW_ID && focus !== "block") return null;

  // Overshoot both ends: the stream arrives from the embedding and leaves for
  // the final norm, so it must not look like it starts at block 0.
  const pad = 1.6;
  const whole = focus === null || focus === OVERVIEW_ID;

  // INSIDE ONE BLOCK, ONLY THE RUN THROUGH IT. The full stream is 41 units and
  // the open block is 9, so drawing all of it at block focus put a bright bar
  // diagonally across the frame and out of both corners, competing with the
  // subject and pulling the eye off it. What the block view needs from the
  // stream is that it arrives, is read, is added to, and leaves; a local run
  // says all of that. The overview is where its full length means something.
  const length = whole ? zMax - zMin + pad * 2 : EXPLODED_DEPTH + pad * 2;
  const centre = whole ? (zMin + zMax) / 2 : 0;

  return (
    <mesh
      position={[0, 0, centre]}
      // Never part of a subject's bounding box. It runs the whole length of the
      // model, so `auto-frame` measuring it means every shot that includes it
      // frames 41 units of conduit: "One block" backed off to 78 units for a
      // block 9 units deep, and the block became a speck. It is context that
      // spans the scene, like the ground plane, not a thing you look at.
      userData={{ noFit: true }}
    >
      <boxGeometry args={[CONDUIT_W, CONDUIT_H, length]} />
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
 * A tap between the stream and the branch.
 *
 * `direction` is which way the data is going: "read" pulls a copy up to the
 * block's machinery, "add" returns the result. They are drawn identically
 * because they are the same wire; what differs is only which end of the block
 * they sit at, and the dataflow order along Z already says that.
 */
export function StreamTap({ z, bright = false }: { z: number; bright?: boolean }) {
  const height = BRANCH_Y - CONDUIT_H / 2;
  return (
    <mesh position={[0, CONDUIT_H / 2 + height / 2, z]}>
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
 * The junction where a block's output rejoins the stream.
 *
 * Drawn as a short run of stream with the branch meeting it, because that is
 * the whole operation: no weights, no mixing, just addition. It is the cheapest
 * thing in a block and arguably the most important, since it is what lets 28
 * layers compose instead of 28 layers each overwriting the last.
 */
export function ResidualJunction({ z }: { z: number }) {
  return (
    <group>
      <StreamTap z={z} bright />
      {/* A stub of stream through the junction, so the view is not just a
          floating tap: you can see what is being added to. */}
      <mesh position={[0, 0, z]}>
        <boxGeometry args={[CONDUIT_W, CONDUIT_H, 2.2]} />
        <meshStandardMaterial
          color={STREAM}
          emissive={STREAM}
          emissiveIntensity={0.3}
          roughness={0.5}
        />
      </mesh>
      <Anchor
        id={`add.${z}`}
        text="Residual add"
        sub="no parameters · the stream keeps what it had and gains what the block computed"
        position={[CONDUIT_W / 2, BRANCH_Y * 0.55, z]}
      />
    </group>
  );
}

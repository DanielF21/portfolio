"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { OVERVIEW_ID } from "@/lib/transformer/glossary";
import { useTransformerStore } from "@/lib/transformer/store";

import { useScopePath } from "./scope";

/**
 * A short name, drawn IN the world at the thing it names.
 *
 * WHAT THIS USED TO BE. An empty Object3D that registered itself so a DOM layer
 * could project it to screen space, place a `<div>` beside it and draw an SVG
 * leader line. That system worked and was still the wrong idea: it put four or
 * five two-line captions over the middle of every shot, its declutter pass meant
 * which ones survived changed as you orbited, and a label with a leader line is
 * a thing pointing at the subject rather than a thing on it. The reference this
 * piece answers has none. It has one card.
 *
 * So the details moved to the card and what stayed here is the SHORT name only.
 * A sprite is the right primitive for it: it faces the camera for free, it is
 * occluded by geometry in front of it (which a DOM label can never be), and it
 * cannot drift from what it names because it lives inside the same group.
 *
 * The `sub` line is deliberately accepted and ignored. Every call site already
 * computes a good one out of the model graph, the card shows exactly that for
 * whatever the cursor is on, and dropping the prop would mean touching
 * twenty-three call sites to delete information that is still correct.
 *
 * CONSTANT SIZE ON SCREEN. A fixed world height is illegible at the overview and
 * enormous in a close-up, and this scene's camera distance ranges over a factor
 * of more than twenty. Scaling with distance keeps a label the same number of
 * pixels everywhere, which is what a label is for.
 *
 * Technique is the planet's `label-sprite`, deliberately forked rather than
 * shared: that one bakes the planet's blue pill and a sans face, and the two
 * pieces have opposite colour conventions on purpose.
 */


const FONT_PX = 56;
const PAD_X = 14;
const PAD_Y = 16;

/** The leader: a short rule running into the thing being named, then a gap, then
 *  the text. This is what replaced a filled chip with a bright border, which was
 *  a tooltip, and a tooltip is a screen convention. A drawing annotates with a
 *  leader and unboxed text. */
const TICK = 34;
const TICK_GAP = 12;

/** Fraction of the frame's height one label occupies. Small: these are ticks on
 *  a drawing, not titles. */
const SCREEN_FRACTION = 0.032;

interface Built {
  texture: THREE.CanvasTexture;
  aspect: number;
}

function build(text: string): Built | null {
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) return null;

  // A grotesk rather than the mono this used to be. Mono micro-labels over a
  // dark field with a bright rule round them is the register this piece is
  // getting out of; a plate sets its annotations in the same face as its prose.
  // A system stack rather than the site's webfont: canvas cannot resolve a CSS
  // variable, and a label that silently falls back mid-session would resize.
  const font = `500 ${FONT_PX}px ui-sans-serif, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`;
  measure.font = font;
  const textW = measure.measureText(text).width;
  const w = Math.ceil(TICK + TICK_GAP + textW + PAD_X * 2);
  const h = Math.ceil(FONT_PX + PAD_Y * 2);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const mid = h / 2;

  // The leader. No fill and no border anywhere on this canvas: what sits behind
  // the text is the scene.
  ctx.strokeStyle = "rgba(233, 237, 242, 0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(PAD_X, mid);
  ctx.lineTo(PAD_X + TICK, mid);
  ctx.stroke();

  ctx.font = font;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  // A dark halo instead of a box. Invisible against the field, and the only
  // thing keeping a label legible where it crosses a lit face.
  ctx.shadowColor = "rgba(8, 11, 15, 0.9)";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "rgba(233, 237, 242, 0.95)";
  ctx.fillText(text, PAD_X + TICK + TICK_GAP, mid + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  return { texture, aspect: w / h };
}

export function Anchor({
  id,
  text,
  overview = false,
  position = [0, 0, 0],
}: {
  id: string;
  text: string;
  /** Accepted and ignored; the card carries the detail. See the note above. */
  sub?: string;
  overview?: boolean;
  position?: [number, number, number];
}) {
  const focus = useTransformerStore((s) => s.focus);
  const camera = useThree((s) => s.camera);
  const ref = useRef<THREE.Sprite>(null);

  const scope = useScopePath();
  const zoomed = focus !== null && focus !== OVERVIEW_ID;

  // EXACTLY THE LEVEL YOU ARE AT, AND NOTHING ELSE. A label shows only when its
  // scope IS the focus, so the projections are named at "Q, K, V projections"
  // and nowhere else.
  //
  // Two rules were tried before this. "Am I zoomed in at all" put every part
  // label in the open block on screen together: fifteen of them stacked into an
  // unreadable pile in the middle of the "One block" shot. Widening to "or one
  // level down" fixed that shot and broke "Attention", which has five
  // sub-stations carrying twelve labels between them.
  //
  // Both attempts were trying to work out how many labels a shot can hold. The
  // answer is that a group view does not need in-world labels at all: the index
  // lists what is inside it, the card names what the cursor is on, and the
  // status bar says where you are. Naming things twice was the whole problem.
  const shown = overview ? !zoomed : zoomed && scope !== "" && scope === focus;

  const built = useMemo(() => (shown ? build(text) : null), [text, shown]);
  useEffect(() => () => built?.texture.dispose(), [built]);

  const groupRef = useRef<THREE.Group>(null);
  const world = useMemo(() => new THREE.Vector3(), []);
  const toward = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const sprite = ref.current;
    const group = groupRef.current;
    if (!sprite || !group || !built) return;

    // Same pixel height at any distance: the visible world height at a point is
    // 2 * d * tan(fov/2), so asking for a fixed fraction of it means measuring
    // d to THIS label rather than to the camera target.
    group.getWorldPosition(world);
    const d = world.distanceTo(camera.position);
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 40;
    const h = 2 * d * Math.tan((fov * Math.PI) / 360) * SCREEN_FRACTION;
    sprite.scale.set(h * built.aspect, h, 1);

    // LIFT IT OFF THE SURFACE IT NAMES. Anchors are placed on the edge of the
    // thing they label, so a sprite centred exactly there is half inside it and
    // depth testing eats the buried half: "Q projection" rendered as "ection".
    // Nudging toward the camera keeps correct occlusion by everything ELSE in
    // the scene while never being clipped by its own subject.
    toward.copy(camera.position);
    group.worldToLocal(toward);
    const len = toward.length();
    if (len > 1e-4) sprite.position.copy(toward).multiplyScalar(Math.min(1, (h * 0.9) / len));
  });

  if (!built) return null;

  return (
    <group ref={groupRef} position={position}>
      <sprite ref={ref} renderOrder={20} name={id}>
        {/* depthTest stays on, so a label behind geometry is correctly hidden by
            it. That is the whole advantage over a projected DOM label, which
            floats over everything and has to be decluttered by hand. */}
        <spriteMaterial
          map={built.texture}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
    </group>
  );
}

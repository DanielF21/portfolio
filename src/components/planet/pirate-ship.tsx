"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { RADIUS, WATER_HEIGHT } from "@/lib/planet/config";
import { SHIP } from "@/lib/planet/ship";
import { liveShipFrame, shipState, SHIP_MAX_SPEED } from "@/lib/planet/ship-state";

import { bendPoint } from "./surface-bend";

/**
 * A pirate ship at anchor, with a deck you can walk on.
 *
 * PROCEDURAL RATHER THAN A DOWNLOADED MODEL, for a reason specific to this
 * one: the ship is the first object in the world whose geometry and whose
 * COLLISION SURFACE have to agree. Every other prop is decoration that the
 * player walks past, so a rough cap around it is fine. Here the deck you see
 * and the deck you stand on are the same claim, and authoring both from the
 * same numbers (see lib/planet/ship.ts) is the only way to keep them equal
 * through later tuning.
 *
 * Colours are baked into vertex colours in LINEAR space, matching the terrain
 * and the scatter. A hex `color` would land about three times darker, which is
 * the bug that made the mountains render as black holes.
 */

type Rgb = readonly [number, number, number];

const HULL: Rgb = [0.34, 0.2, 0.12];
const HULL_DARK: Rgb = [0.22, 0.13, 0.08];
const HULL_TRIM: Rgb = [0.52, 0.35, 0.19];
const DECK: Rgb = [0.56, 0.43, 0.27];
const MAST: Rgb = [0.44, 0.31, 0.18];
/** Black, as in the reference. Not literally zero: pure black would sit under
 *  the same linear-luminance floor that made the pavilion read as a hole. */
const SAIL: Rgb = [0.1, 0.1, 0.11];
const FLAG: Rgb = [0.07, 0.07, 0.08];
const BONE: Rgb = [0.85, 0.85, 0.82];
const RIG: Rgb = [0.3, 0.28, 0.26];
const PORT: Rgb = [0.07, 0.05, 0.04];

function bake(geo: THREE.BufferGeometry, rgb: Rgb) {
  const n = geo.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = rgb[0];
    colors[i * 3 + 1] = rgb[1];
    colors[i * 3 + 2] = rgb[2];
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

/**
 * Hull, deck, masts and rigging as one merged geometry: one draw call for the
 * whole ship. Built along local +X (bow at +X), +Y up, waterline at y = 0,
 * matching how `shipFrame` orients it.
 *
 * Modelled on a reference galleon: three masts, black square sails, a raised
 * quarterdeck aft, gun ports along the side, and a long bowsprit. The hull is
 * built as a stack of tapered layers rather than one box, which is what gives
 * the flare from a narrow keel out to a wide gunwale at almost no cost.
 */
function buildShip(): THREE.BufferGeometry {
  const L = SHIP.length;
  const B = SHIP.beam;
  const parts: THREE.BufferGeometry[] = [];

  // Vertical layout, and the numbers everything else is derived from. The hull
  // must reach the deck: an early pass had a 0.9-tall hull under a deck at
  // 1.05, so the planking floated clear of the boat and it read as a raft.
  const KEEL = -1.0;
  const DECK_Y = SHIP.deckHeight;
  const GUNWALE = DECK_Y + 0.32;
  const hullH = GUNWALE - KEEL;

  // ------------------------------------------------------------------ hull
  const LAYERS = 6;
  const layerH = hullH / LAYERS;
  for (let i = 0; i < LAYERS; i++) {
    const t = (i + 0.5) / LAYERS; // 0 at the keel, 1 at the rail
    const y = KEEL + layerH * (i + 0.5);
    const w = B * (0.42 + 0.58 * t);
    const len = L * (0.6 + 0.3 * t);
    parts.push(
      bake(
        new THREE.BoxGeometry(len, layerH * 1.02, w).translate(-L * 0.03, y, 0),
        i === LAYERS - 1 ? HULL_TRIM : i < 2 ? HULL_DARK : HULL
      )
    );
  }

  // Bow: a 4-sided pyramid scaled to the hull's cross-section, laid on its
  // side so it comes to a point at +X. rotateY(PI/4) is what turns the
  // cylinder's default diamond section into an axis-aligned square that can be
  // matched to the hull; without it the bow meets the hull corner-on.
  const bow = new THREE.CylinderGeometry(0, 1, 1, 4);
  bow.rotateY(Math.PI / 4);
  bow.scale(hullH * 0.62, L * 0.26, B * 0.62);
  bow.rotateZ(-Math.PI / 2);
  bow.translate(L * 0.44, KEEL + hullH * 0.58, 0);
  parts.push(bake(bow, HULL));

  // Squared-off stern transom.
  parts.push(
    bake(
      new THREE.BoxGeometry(L * 0.06, hullH * 0.78, B * 0.94).translate(
        -L * 0.46,
        KEEL + hullH * 0.62,
        0
      ),
      HULL_DARK
    )
  );

  // Rubbing strake at the waterline.
  for (const s of [-1, 1]) {
    parts.push(
      bake(
        new THREE.BoxGeometry(L * 0.7, 0.14, 0.1).translate(
          -L * 0.03,
          0.15,
          (s * B * 0.86) / 2
        ),
        HULL_TRIM
      )
    );
  }

  // Gun ports: dark squares set into the topsides, the detail that most says
  // "armed ship" for the fewest triangles.
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      parts.push(
        bake(
          new THREE.BoxGeometry(0.26, 0.26, 0.08).translate(
            -L * 0.24 + i * L * 0.12,
            DECK_Y - 0.34,
            (s * B * 0.99) / 2
          ),
          PORT
        )
      );
    }
  }

  // ------------------------------------------------------------------ decks
  parts.push(
    bake(
      new THREE.BoxGeometry(L * 0.72, 0.1, B * 0.9).translate(-L * 0.02, DECK_Y, 0),
      DECK
    )
  );

  // Raised quarterdeck aft, with a rail, and the stern castle above it.
  const QUARTER_Y = DECK_Y + 0.62;
  parts.push(
    bake(
      new THREE.BoxGeometry(L * 0.28, 0.1, B * 0.88).translate(
        -L * 0.31,
        QUARTER_Y,
        0
      ),
      DECK
    )
  );
  for (const s of [-1, 1]) {
    parts.push(
      bake(
        new THREE.BoxGeometry(L * 0.28, 0.26, 0.08).translate(
          -L * 0.31,
          QUARTER_Y + 0.18,
          (s * B * 0.86) / 2
        ),
        HULL_TRIM
      )
    );
  }
  parts.push(
    bake(
      new THREE.BoxGeometry(L * 0.14, 0.72, B * 0.8).translate(
        -L * 0.4,
        QUARTER_Y + 0.41,
        0
      ),
      HULL
    )
  );
  // Stern windows.
  for (const z of [-0.3, 0.3]) {
    parts.push(
      bake(
        new THREE.BoxGeometry(0.06, 0.3, 0.34).translate(
          -L * 0.47,
          QUARTER_Y + 0.44,
          z
        ),
        HULL_TRIM
      )
    );
  }

  // Barrels lashed on deck.
  for (const [bx, bz] of [
    [-L * 0.12, 0.6],
    [-L * 0.06, -0.62],
    [L * 0.14, 0.55],
  ]) {
    parts.push(
      bake(
        new THREE.CylinderGeometry(0.16, 0.16, 0.34, 7).translate(
          bx,
          DECK_Y + 0.22,
          bz
        ),
        HULL_TRIM
      )
    );
  }

  // ------------------------------------------------------------- bowsprit
  //
  // ATTACHED, unlike the first pass, where it was placed above the gunwale at
  // the very tip of the stem and simply hung in the air with a visible gap.
  // Its inboard end is now buried inside the forward hull and it rakes up and
  // out from there, which is where a bowsprit actually lives.
  const spritLen = L * 0.42;
  const spritRake = 0.2;
  parts.push(
    bake(
      new THREE.CylinderGeometry(0.07, 0.1, spritLen, 6)
        .rotateZ(-Math.PI / 2 + spritRake)
        .translate(
          L * 0.3 + (Math.cos(spritRake) * spritLen) / 2,
          GUNWALE - 0.15 + (Math.sin(spritRake) * spritLen) / 2,
          0
        ),
      MAST
    )
  );

  // ------------------------------------------------------------------ masts
  const mast = (
    x: number,
    height: number,
    sails: readonly { at: number; w: number; h: number }[],
    nest: boolean
  ) => {
    parts.push(
      bake(
        new THREE.CylinderGeometry(0.075, 0.11, height, 6).translate(
          x,
          DECK_Y + height / 2,
          0
        ),
        MAST
      )
    );
    for (const s of sails) {
      const y = DECK_Y + height * s.at;
      // Yard arm.
      parts.push(
        bake(
          new THREE.CylinderGeometry(0.05, 0.05, s.w * 1.12, 5)
            .rotateX(Math.PI / 2)
            .translate(x, y, 0),
          MAST
        )
      );
      // Sail: a thin box rather than a plane so it is never invisible edge-on,
      // bellied forward a touch so it reads as catching wind.
      parts.push(
        bake(
          new THREE.BoxGeometry(0.08, s.h, s.w)
            .rotateZ(-0.06)
            .translate(x + 0.12, y - s.h / 2, 0),
          SAIL
        )
      );
    }
    if (nest) {
      parts.push(
        bake(
          new THREE.CylinderGeometry(0.28, 0.22, 0.26, 8).translate(
            x,
            DECK_Y + height * 0.82,
            0
          ),
          HULL_TRIM
        )
      );
    }
    // Shrouds: a pair of thin stays from the rail up to the masthead, which is
    // what reads as rigging at this scale without modelling ratlines.
    for (const s of [-1, 1]) {
      // Runs from the rail at ±dz up to the masthead on the centreline, so the
      // vector is (0, dy, -dz) and the box sits at the MIDPOINT of that, not
      // at the rail. A box's long axis is +Y and rotateX(t) sends +Y to
      // (0, cos t, sin t), hence atan2(-dz, dy): getting that sign wrong
      // leaves the shrouds standing up as vertical poles beside the mast
      // instead of raking in to meet it.
      const top = DECK_Y + height * 0.8;
      const dz = (s * B * 0.42) / 2;
      const dy = top - DECK_Y;
      parts.push(
        bake(
          new THREE.BoxGeometry(0.04, Math.hypot(dy, dz), 0.04)
            .rotateX(Math.atan2(-dz, dy))
            .translate(x, DECK_Y + dy / 2, dz / 2),
          RIG
        )
      );
    }
  };

  mast(L * 0.24, 4.2, [
    { at: 0.42, w: B * 0.95, h: 1.9 },
    { at: 0.72, w: B * 0.74, h: 1.35 },
  ], false);
  mast(-L * 0.02, 5.4, [
    { at: 0.4, w: B * 1.14, h: 2.2 },
    { at: 0.68, w: B * 0.9, h: 1.6 },
  ], true);
  mast(-L * 0.28, 3.7, [{ at: 0.5, w: B * 0.78, h: 1.7 }], false);

  // Forestay, from the bowsprit tip back to the foremast head.
  {
    const tipX = L * 0.3 + Math.cos(spritRake) * spritLen;
    const tipY = GUNWALE - 0.15 + Math.sin(spritRake) * spritLen;
    const headX = L * 0.24;
    const headY = DECK_Y + 4.2 * 0.86;
    const dx = headX - tipX;
    const dy = headY - tipY;
    // rotateZ(t) sends the box's +Y axis to (-sin t, cos t), so aiming it
    // along (dx, dy) needs atan2(-dx, dy). With the sign flipped the stay is
    // mirrored about the mast and shoots off past the bow into open space,
    // which is exactly what it did.
    parts.push(
      bake(
        new THREE.BoxGeometry(0.035, Math.hypot(dx, dy), 0.035)
          .rotateZ(Math.atan2(-dx, dy))
          .translate((tipX + headX) / 2, (tipY + headY) / 2, 0),
        RIG
      )
    );
  }

  // ------------------------------------------------------------------ helm
  // The wheel, on the quarterdeck. Its position comes from SHIP.helmOffset, so
  // the thing you see and the thing the interaction prompt is anchored to are
  // the same number rather than two that happen to agree.
  {
    const hx = SHIP.helmOffset;
    const hy = QUARTER_Y + 0.05;
    // Binnacle.
    parts.push(
      bake(
        new THREE.CylinderGeometry(0.11, 0.14, 0.5, 7).translate(hx, hy + 0.25, 0),
        MAST
      )
    );
    // Hub, lying on its side so the wheel faces along the hull.
    parts.push(
      bake(
        new THREE.CylinderGeometry(0.1, 0.1, 0.09, 10)
          .rotateZ(Math.PI / 2)
          .translate(hx, hy + 0.62, 0),
        MAST
      )
    );
    // Rim.
    parts.push(
      bake(
        new THREE.TorusGeometry(0.34, 0.045, 6, 14)
          .rotateY(Math.PI / 2)
          .translate(hx, hy + 0.62, 0),
        HULL_TRIM
      )
    );
    // Eight spokes, each overshooting the rim to make the handles.
    for (let i = 0; i < 8; i++) {
      parts.push(
        bake(
          new THREE.CylinderGeometry(0.028, 0.028, 0.86, 4)
            .rotateX(Math.PI / 2)
            .rotateX((i / 8) * Math.PI * 2)
            .translate(hx, hy + 0.62, 0),
          HULL_TRIM
        )
      );
    }
  }

  // ------------------------------------------------------------------ flags
  const flag = (x: number, y: number) => {
    parts.push(
      bake(new THREE.BoxGeometry(0.04, 0.4, 0.78).translate(x, y, 0.4), FLAG)
    );
    // Skull, as one bright block. At this size a shape reads as a smudge; a
    // single pale mark on black reads as the jolly roger.
    parts.push(
      bake(new THREE.BoxGeometry(0.06, 0.13, 0.14).translate(x, y + 0.04, 0.3), BONE)
    );
  };
  flag(L * 0.24, DECK_Y + 4.2 + 0.3);
  flag(-L * 0.02, DECK_Y + 5.4 + 0.3);

  // Everything must be non-indexed before merging: box and cylinder are
  // indexed, and mergeGeometries refuses to mix indexed with non-indexed.
  const flat = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  const merged = mergeGeometries(flat);
  for (const p of parts) p.dispose();
  for (const p of flat) if (!parts.includes(p)) p.dispose();
  if (!merged) throw new Error("[planet] pirate ship merge failed");
  return merged;
}

/**
 * Foam: a bow wave and a trailing wake, sitting on the water rather than on the
 * hull.
 *
 * THIS IS THE ONLY THING ON SCREEN THAT SAYS THE SHIP IS MOVING. The camera is
 * carried by the ship while you have the wheel, so the hull, the deck and the
 * helmsman are all motionless relative to the frame; without a mark on the
 * water, full throttle looks identical to standing still and only the turn
 * appears to work.
 *
 * Built ON THE SPHERE, vertex by vertex. The wake runs 9 units astern, where a
 * flat quad would have left the surface by 2.5 units and be visibly flying.
 */
function buildWake(): THREE.BufferGeometry {
  const L = SHIP.length / 2;
  const y = WATER_HEIGHT + 0.02;
  const v: number[] = [];
  const c: number[] = [];
  const p = new THREE.Vector3();

  // Alpha per vertex, the same trick `water.tsx` uses for the shoreline: a
  // wake with a hard trailing edge reads as a painted triangle, and no amount
  // of tuning the material's opacity fixes the shape of it.
  const push = (dx: number, dz: number, a: number) => {
    bendPoint(dx, dz, y, RADIUS, p);
    v.push(p.x, p.y, p.z);
    c.push(1, 1, 1, a);
  };
  const quad = (
    ax: number, az: number, aa: number,
    bx: number, bz: number, ba: number,
    cx: number, cz: number, ca: number,
    dx: number, dz: number, da: number
  ) => {
    push(ax, az, aa); push(bx, bz, ba); push(cx, cz, ca);
    push(ax, az, aa); push(cx, cz, ca); push(dx, dz, da);
  };

  // Trailing wake: a widening wedge astern, in six segments so it follows the
  // curve rather than cutting the chord, and fades out as it widens.
  const SEGS = 6;
  const LEN = 9;
  const fade = (t: number) => (1 - t) * (1 - t);
  for (let i = 0; i < SEGS; i++) {
    const t0 = i / SEGS;
    const t1 = (i + 1) / SEGS;
    const x0 = -L - t0 * LEN;
    const x1 = -L - t1 * LEN;
    const w0 = 0.85 + t0 * 1.35;
    const w1 = 0.85 + t1 * 1.35;
    quad(x0, -w0, fade(t0), x1, -w1, fade(t1), x1, w1, fade(t1), x0, w0, fade(t0));
  }
  // Bow wave: two short wedges peeling off the stem, brightest at the stem.
  for (const s of [-1, 1]) {
    quad(
      L + 0.5, s * 0.05, 0.9,
      L - 1.6, s * 1.5, 0,
      L - 2.4, s * 1.15, 0,
      L - 0.2, s * 0.3, 0.9
    );
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(c, 4));
  g.computeVertexNormals();
  return g;
}

export function PirateShip() {
  /** Outer group: the ship's pose on the sphere, rebuilt every frame from
   *  `shipState`, because the ship can now be steered. */
  const hull = useRef<THREE.Group>(null);
  /** Inner group: the roll and pitch of riding the swell. Kept separate so the
   *  motion can never leak into the pose the deck platforms are derived from. */
  const sway = useRef<THREE.Group>(null);

  const wakeMat = useRef<THREE.MeshBasicMaterial>(null);

  const geometry = useMemo(() => buildShip(), []);
  const wake = useMemo(() => buildWake(), []);
  const basis = useMemo(() => new THREE.Matrix4(), []);
  const bx = useMemo(() => new THREE.Vector3(), []);
  const by = useMemo(() => new THREE.Vector3(), []);
  const bz = useMemo(() => new THREE.Vector3(), []);

  useEffect(
    () => () => {
      geometry.dispose();
      wake.dispose();
    },
    [geometry, wake]
  );

  useFrame((state) => {
    const h = hull.current;
    if (!h) return;

    // Pose from the live state. The same `liveShipFrame` that world.tsx uses
    // to place the walkable caps and that player.tsx uses to pin the helmsman,
    // so all three cannot disagree about where the ship is.
    const f = liveShipFrame();
    bx.set(f.x.x, f.x.y, f.x.z);
    by.set(f.y.x, f.y.y, f.y.z);
    bz.set(f.z.x, f.z.y, f.z.z);
    basis.makeBasis(bx, by, bz);
    h.quaternion.setFromRotationMatrix(basis);
    h.position.copy(by).multiplyScalar(RADIUS);

    if (sway.current) {
      const t = state.clock.elapsedTime;
      // Riding the swell. Larger under way than at anchor, and it heels into
      // a turn, which is most of what sells the ship as moving rather than
      // sliding. Small enough that the flat deck caps stay a fair
      // approximation of where the planking is.
      const way = Math.min(1, shipState.speed / 3);
      sway.current.rotation.z =
        Math.sin(t * 0.55) * (0.035 + way * 0.02) - way * 0.05;
      sway.current.rotation.x = Math.sin(t * 0.41 + 1.3) * (0.022 + way * 0.015);
      sway.current.position.y = Math.sin(t * 0.62) * 0.06;
    }

    if (wakeMat.current) {
      // Fades in over the first third of the speed range, so a ship barely
      // under way does not trail a full wake, and vanishes completely at rest
      // rather than leaving a scar on the water at anchor.
      const w = Math.min(1, shipState.speed / (SHIP_MAX_SPEED * 0.35));
      wakeMat.current.opacity = w * 0.55;
      wakeMat.current.visible = w > 0.01;
    }
  });

  return (
    <group ref={hull}>
      {/* Outside `sway`: the foam belongs to the water, so it must not roll
          with the hull. */}
      <mesh geometry={wake} renderOrder={2}>
        <meshBasicMaterial
          ref={wakeMat}
          color="#dbeaf2"
          vertexColors
          transparent
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <group ref={sway}>
        <mesh geometry={geometry}>
          <meshStandardMaterial vertexColors roughness={0.78} flatShading />
        </mesh>
      </group>
    </group>
  );
}

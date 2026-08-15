"use client";

import { Clone, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { ASSETS } from "@/lib/planet/asset-manifest";
import {
  MAX_DELTA,
  RADIUS,
  TRAMPOLINE_HEIGHT,
  TRAMPOLINE_RADIUS,
} from "@/lib/planet/config";
import { dayPhase, darknessAt, sunDirection } from "@/lib/planet/daylight";
import { mill, stepMill } from "@/lib/planet/mill";
import { TARGETS, wobble } from "@/lib/planet/targets";
import { telescopeAim } from "@/lib/planet/telescope";
import { DISTRICT_BY_ID } from "@/lib/planet/districts";
import {
  resolveSceneryDir,
  SCENERY,
  type SceneryItem,
} from "@/lib/planet/world-layout";
import type { PlanetMarker } from "@/lib/planet/types";

import { fixGltfMaterials } from "./gltf-fixup";
import { AssetErrorBoundary } from "./marker-asset";
import { bendMatrix } from "./surface-bend";

/**
 * Everything authored and inert: hero buildings, the pavilion, mountains.
 * Deliberately none of it carries the pad/glow/label vocabulary; that belongs
 * to content only.
 *
 * The tall coloured light shafts that used to rise from each island are gone.
 * They were the last of the marker vocabulary: a navigation aid built for a
 * world with fourteen things to collect, which on a world with none of them
 * read as five glowing cylinders with nothing to point at. Navigation is now
 * by landmark, which is what the volcano, the mill, the sea stacks and the
 * ship are for.
 */

const UP = new THREE.Vector3(0, 1, 0);

// Kick off the scenery fetches the moment the lazy chunk executes, in parallel
// with the rest of the scene setup.
//
// Deliberately driven off SCENERY rather than off all of ASSETS. The manifest
// still carries a dozen marker-body models from when this world was a portfolio
// map; preloading the whole manifest pulled ~298KB of the ~740KB payload for
// models that never render.
const preloaded = new Set<string>();
for (const item of SCENERY) {
  if (preloaded.has(item.asset)) continue;
  preloaded.add(item.asset);
  // "proc:mountain" has no manifest entry; the optional chain covers it.
  const url = ASSETS[item.asset]?.url;
  if (url) useGLTF.preload(url);
}

/** Static surface transform for one item, computed once. */
function useSurfaceTransform(item: SceneryItem) {
  return useMemo(() => {
    const d = resolveSceneryDir(item);
    const dir = new THREE.Vector3(d.x, d.y, d.z);
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
    const headingQ = new THREE.Quaternion().setFromAxisAngle(UP, item.heading);
    q.multiply(headingQ); // heading spins about the LOCAL up axis
    // Sink below the surface: a wide flat base only touches the sphere at
    // its centre, so the rim of an unsunk model hovers over the curvature.
    return {
      position: dir.multiplyScalar(RADIUS - (item.sink ?? 0)),
      quaternion: q,
    };
  }, [item]);
}

function GltfScenery({ item }: { item: SceneryItem }) {
  const def = ASSETS[item.asset];
  const { position, quaternion } = useSurfaceTransform(item);
  const { scene } = useGLTF(def.url as string);

  // Repair the shared materials on load. Idempotent, so the several Clone
  // instances of a repeated model (lanterns, snow trees) are fine.
  useEffect(() => {
    fixGltfMaterials(scene);
  }, [scene]);

  // Only the props a snowball can hit pay for a frame callback, which is why
  // this is decided once here rather than by every item asking every frame.
  const hittable = useMemo(
    () => (item.id ? TARGETS.some((t) => t.id === item.id) : false),
    [item.id]
  );

  return hittable ? (
    <Hittable item={item} position={position} quaternion={quaternion}>
      <Clone object={scene} />
    </Hittable>
  ) : (
    <group position={position} quaternion={quaternion} scale={item.scale}>
      <Clone object={scene} />
    </group>
  );
}

/**
 * A prop that rocks when a snowball lands on it.
 *
 * The rock is a rotation about the base, not about the centre, so the thing
 * pivots on the ground the way a struck object does instead of swinging in the
 * air like a pendulum hung from its middle. That is the whole difference
 * between reading as "hit" and reading as "floating".
 */
function Hittable({
  item,
  position,
  quaternion,
  children,
}: {
  item: SceneryItem;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  children: React.ReactNode;
}) {
  const inner = useRef<THREE.Group>(null);

  useFrame((state) => {
    const g = inner.current;
    if (!g) return;
    const w = wobble(item.id!, state.clock.elapsedTime);
    // Two axes so it does not always fall the same way, and small: 0.09 rad is
    // five degrees, which at this scale is a definite nod and not a topple.
    g.rotation.z = w * 0.09;
    g.rotation.x = w * 0.05;
  });

  return (
    <group position={position} quaternion={quaternion} scale={item.scale}>
      <group ref={inner}>{children}</group>
    </group>
  );
}

/** Default rock, if a mountain does not name its own tint. */
const ROCK: readonly [number, number, number] = [0.46, 0.45, 0.43];

/** A walk-around mountain: a merged cluster of cones. Flat sphere stays flat;
 *  this is a prop, not terrain.
 *
 *  Colour is BAKED INTO VERTEX COLOURS in linear space, deliberately, rather
 *  than set as a hex `color` on the material. The whole rest of the world
 *  (planet faces in planet-mesh.tsx, every scatter instance) writes linear
 *  values straight from `biomeColor`, whereas a hex string goes through the
 *  sRGB decode: the old `color="#5c5f6e"` landed at a linear albedo of ~0.11
 *  against terrain sitting at ~0.35, so the mountains rendered as near-black
 *  silhouettes and read as holes in the world. Matching how everything else
 *  is coloured keeps that from silently happening again.
 */
function Mountain({ item }: { item: SceneryItem }) {
  const { position, quaternion } = useSurfaceTransform(item);
  const tint = item.tint ?? ROCK;

  const geometry = useMemo(() => {
    const parts = [
      new THREE.ConeGeometry(2.6, 7.2, 7),
      new THREE.ConeGeometry(1.9, 4.8, 6).translate(1.7, -1, 0.4),
      new THREE.ConeGeometry(1.5, 3.6, 6).translate(-1.5, -1.6, -0.7),
      new THREE.ConeGeometry(1.1, 2.5, 5).translate(0.4, -2.2, 1.6),
    ];
    // Cone origins are their centres. Lift the cluster so the main base sits
    // HALF A UNIT BELOW local zero: a wide flat base only touches a sphere at
    // its centre point, so without this sink the skirts hover visibly above
    // the curved ground.
    for (const p of parts) p.translate(0, 3.1, 0);
    const merged = mergeGeometries(parts);
    for (const p of parts) p.dispose();
    if (!merged) throw new Error("[planet] mountain merge failed");

    // Lighter toward the peak (weathering and, on the tall ones, snow line)
    // plus a per-vertex hash so a 7-sided cone does not read as flat card.
    const pos = merged.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    let maxY = 0;
    for (let i = 0; i < pos.count; i++) maxY = Math.max(maxY, pos.getY(i));
    for (let i = 0; i < pos.count; i++) {
      const t = Math.max(0, pos.getY(i) / (maxY || 1));
      const lift = 1 + t * t * 0.55;
      const h = Math.sin(pos.getX(i) * 12.9 + pos.getZ(i) * 78.2) * 43758.5453;
      const jitter = 1 + (h - Math.floor(h) - 0.5) * 0.12;
      colors[i * 3] = tint[0] * lift * jitter;
      colors[i * 3 + 1] = tint[1] * lift * jitter;
      colors[i * 3 + 2] = tint[2] * lift * jitter;
    }
    merged.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return merged;
  }, [tint]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      geometry={geometry}
      position={position}
      quaternion={quaternion}
      scale={item.scale}
    >
      <meshStandardMaterial vertexColors roughness={0.95} flatShading />
    </mesh>
  );
}

/**
 * The mill house: a windmill with a cottage built against it, and a small
 * fenced wheat plot beside them.
 *
 * ALL OF IT PROCEDURAL, INCLUDING THE SAILS. The `windmill` GLB this replaces
 * turned out to be nothing but the sail cross: measured in the live scene it is
 * 0.47 x 3.11 x 3.11 with the hub at y 1.55 and the blade tips reaching all the
 * way to y 0, so on its own it read as a giant X planted in the sand with no
 * mill behind it and nothing holding it up. There is no way to attach a
 * building to it from the outside, because a SCENERY row can only place a model
 * at a point, and the sails need to sit clear of the roof and off the tower's
 * axis. Drawing the sails here puts them in the same local frame as the tower
 * they turn on, so they cannot come apart.
 *
 * EVERY PART IS PLACED WITH `bendMatrix`, not with `translate`. The plot runs
 * out past 4 units from the anchor, where the tangent plane the parts are built
 * in has left the sphere by two thirds of a unit; built flat, the far fence
 * posts hang in the air and the field reads as a decal rather than as ground.
 *
 * One merged geometry for the whole structure plus one InstancedMesh for the
 * wheat, so the farm is two draw calls.
 */
function MillHouse({ item }: { item: SceneryItem }) {
  const { position, quaternion } = useSurfaceTransform(item);

  const { building, sails, wheat, wheatMatrices, hub } = useMemo(() => {
    // The planet's radius in this item's own units. Everything inside the
    // group is scaled by `item.scale`, so the curvature has to be too.
    const R = RADIUS / item.scale;

    const parts: THREE.BufferGeometry[] = [];
    const bake = (g: THREE.BufferGeometry, rgb: readonly [number, number, number]) => {
      const n = g.attributes.position.count;
      const c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        c[i * 3] = rgb[0];
        c[i * 3 + 1] = rgb[1];
        c[i * 3 + 2] = rgb[2];
      }
      g.setAttribute("color", new THREE.BufferAttribute(c, 3));
      return g;
    };

    /** Build at the origin, then carry the part out to `dx, dz` along the
     *  surface. The part arrives standing up straight where it lands. */
    const at = (
      g: THREE.BufferGeometry,
      dx: number,
      dz: number,
      rgb: readonly [number, number, number]
    ) => {
      parts.push(bake(g.applyMatrix4(bendMatrix(dx, dz, R)), rgb));
    };

    const WALL: [number, number, number] = [0.72, 0.63, 0.48];
    const BEAM: [number, number, number] = [0.32, 0.21, 0.13];
    const ROOF: [number, number, number] = [0.42, 0.22, 0.16];
    const DOOR: [number, number, number] = [0.3, 0.19, 0.11];
    const SOIL: [number, number, number] = [0.3, 0.22, 0.15];
    const STONE: [number, number, number] = [0.6, 0.57, 0.52];

    // ------------------------------------------------------------- the tower
    //
    // SIZED AGAINST THE PLAYER, who is 0.84 units tall. The first pass was
    // built at nearly twice this and the mill covered a third of the island:
    // on a 10-unit island a building has to be small to read as a building.
    const TOWER_H = 2.6;
    at(
      new THREE.CylinderGeometry(0.5, 0.62, TOWER_H, 10).translate(0, TOWER_H / 2, 0),
      0,
      0,
      STONE
    );
    // Cap. A cone rather than a dome: fewer triangles and it matches the
    // faceted look of everything else.
    at(
      new THREE.CylinderGeometry(0.09, 0.58, 0.5, 10).translate(0, TOWER_H + 0.22, 0),
      0,
      0,
      ROOF
    );
    // A band of stone at the base, so the tower meets the ground on something.
    at(new THREE.CylinderGeometry(0.68, 0.72, 0.16, 10).translate(0, 0.08, 0), 0, 0, STONE);

    // ------------------------------------------------------------- the sails
    //
    // Mounted on the -x face just under the cap, clear of the cottage, which is
    // what lets the blades sweep down past head height without going through
    // the roof. The tower tapers to 0.51 at this height, so a hub at 0.72
    // stands the sails outside it, and the axle bridges the gap: without that
    // the sails hang in the air beside the mill, which is exactly what the GLB
    // they replace did.
    // THE SAILS ARE THEIR OWN MESH, because they turn. Built about the origin
    // in the yz plane so a rotation about x is a rotation about the axle, and
    // carried out to the hub by the group they hang in rather than baked into
    // the vertices: a spinning object cannot have its pivot buried in its
    // geometry.
    const HUB_X = -0.72;
    const HUB_Y = 2.4;
    const BLADE = 1.3;
    at(
      new THREE.CylinderGeometry(0.1, 0.1, 0.62, 8)
        .rotateZ(Math.PI / 2)
        .translate(HUB_X + 0.24, HUB_Y, 0),
      0,
      0,
      BEAM
    );

    const sailParts: THREE.BufferGeometry[] = [];
    const sail = (g: THREE.BufferGeometry, rgb: readonly [number, number, number]) => {
      sailParts.push(bake(g, rgb));
    };
    for (let i = 0; i < 4; i++) {
      // The saltire, not the cross: an X reads as a windmill from any angle,
      // a + disappears edge-on.
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      sail(
        new THREE.BoxGeometry(0.08, BLADE, 0.1).translate(0, BLADE / 2, 0).rotateX(-a),
        BEAM
      );
      // Canvas on one side of each spar, with two ribs across it. A panel
      // rather than a row of slats: slats alone read as loose sticks in the air
      // from any distance, and the whole point of a windmill is being legible
      // from across the island.
      sail(
        new THREE.BoxGeometry(0.04, BLADE * 0.62, 0.34)
          .translate(0, BLADE * 0.62, 0.22)
          .rotateX(-a),
        WALL
      );
      for (let s = 0; s < 2; s++) {
        sail(
          new THREE.BoxGeometry(0.06, 0.07, 0.42)
            .translate(0, BLADE * (0.45 + s * 0.34), 0.19)
            .rotateX(-a),
          BEAM
        );
      }
    }

    // ----------------------------------------------------------- the cottage
    //
    // Overlaps the tower in x, so the two are one solid and cannot read as
    // separate objects standing near each other.
    const CX = 1.45; // cottage centre along +x
    const LEN = 2.2;
    const DEPTH = 1.7;
    const WALL_H = 1.25;
    at(new THREE.BoxGeometry(LEN, WALL_H, DEPTH).translate(0, WALL_H / 2, 0), CX, 0, WALL);
    // Half-timbering, which is what makes a plain box read as a cottage.
    for (const z of [-DEPTH / 2 - 0.02, DEPTH / 2 + 0.02]) {
      at(new THREE.BoxGeometry(LEN, 0.09, 0.05).translate(0, 0.85, z), CX, 0, BEAM);
      for (const x of [-LEN / 2 + 0.08, 0, LEN / 2 - 0.08]) {
        at(new THREE.BoxGeometry(0.09, WALL_H, 0.05).translate(x, WALL_H / 2, z), CX, 0, BEAM);
      }
    }
    // Pitched roof: a 4-sided cone squashed into a ridge running along +x.
    //
    // The 4-gon cone is rotated so its FACES point down the axes, not its
    // corners: the shape's inradius is what has to clear the walls, and that is
    // cos(45) of its radius. Sized from the walls plus an eave rather than by
    // eye, or the roof comes out narrower than the house it sits on.
    const roof = new THREE.CylinderGeometry(0, 1, 1, 4);
    roof.rotateY(Math.PI / 4);
    const EAVE = 0.22;
    roof.scale((LEN / 2 + EAVE) / 0.7071, 0.75, (DEPTH / 2 + EAVE) / 0.7071);
    roof.translate(0, WALL_H + 0.3, 0);
    at(roof, CX, 0, ROOF);
    // Door, on the side the plot is on, so the two read as one holding. Taller
    // than the player, which is the only proportion here anyone will notice.
    at(
      new THREE.BoxGeometry(0.42, 0.95, 0.08).translate(0.25, 0.475, -DEPTH / 2 - 0.02),
      CX,
      0,
      DOOR
    );

    // -------------------------------------------------------------- the plot
    //
    // Fence posts and two rails per run. Small: this feeds the household, it
    // is not agriculture.
    const FX = 1.3; // plot centre
    const FZ = -2.1;
    const HALF_X = 0.95;
    const HALF_Z = 0.65;
    const POSTS = 5;
    for (let i = 0; i <= POSTS; i++) {
      const t = -HALF_X + (i / POSTS) * HALF_X * 2;
      for (const s of [-1, 1]) {
        at(
          new THREE.BoxGeometry(0.07, 0.42, 0.07).translate(0, 0.21, 0),
          FX + t,
          FZ + s * HALF_Z,
          BEAM
        );
      }
    }
    for (const s of [-1, 1]) {
      for (const y of [0.16, 0.34]) {
        at(
          new THREE.BoxGeometry(HALF_X * 2, 0.04, 0.04).translate(0, y, 0),
          FX,
          FZ + s * HALF_Z,
          BEAM
        );
      }
      at(new THREE.BoxGeometry(0.07, 0.42, 0.07).translate(0, 0.21, 0), FX + s * HALF_X, FZ, BEAM);
      for (const y of [0.16, 0.34]) {
        at(
          new THREE.BoxGeometry(0.04, 0.04, HALF_Z * 2).translate(0, y, 0),
          FX + s * HALF_X,
          FZ,
          BEAM
        );
      }
    }
    // Tilled soil under the crop, in strips: one slab that wide would be the
    // same flat-plane problem the fence just avoided.
    const SOIL_STRIPS = 5;
    for (let i = 0; i < SOIL_STRIPS; i++) {
      const z = FZ - HALF_Z + ((i + 0.5) / SOIL_STRIPS) * HALF_Z * 2;
      at(
        new THREE.BoxGeometry(HALF_X * 2, 0.07, (HALF_Z * 2) / SOIL_STRIPS).translate(0, 0.03, 0),
        FX,
        z,
        SOIL
      );
    }

    const flat = parts.map((p) => (p.index ? p.toNonIndexed() : p));
    const building = mergeGeometries(flat);
    for (const p of parts) p.dispose();
    for (const p of flat) if (!parts.includes(p)) p.dispose();
    if (!building) throw new Error("[planet] mill house merge failed");

    const sailFlat = sailParts.map((p) => (p.index ? p.toNonIndexed() : p));
    const sails = mergeGeometries(sailFlat);
    for (const p of sailParts) p.dispose();
    for (const p of sailFlat) if (!sailParts.includes(p)) p.dispose();
    if (!sails) throw new Error("[planet] mill sails merge failed");

    // Wheat: one tapered stalk instanced in rows inside the fence, each carried
    // out to its own spot so the crop follows the ground the fence stands on.
    const wheat = new THREE.CylinderGeometry(0.01, 0.026, 0.34, 4);
    wheat.translate(0, 0.17, 0);

    const wheatMatrices: THREE.Matrix4[] = [];
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const axis = new THREE.Vector3(0, 0, 1);
    const local = new THREE.Matrix4();
    let n = 0;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 11; col++) {
        const x = FX - HALF_X * 0.84 + (col / 10) * HALF_X * 1.68;
        const z = FZ - HALF_Z * 0.7 + (row / 4) * HALF_Z * 1.4;
        // Same deterministic hash the scatter uses, so the field is identical
        // between sessions.
        const h = Math.sin(n * 127.1 + 311.7) * 43758.5453;
        const jitter = h - Math.floor(h);
        n++;
        p.set((jitter - 0.5) * 0.06, 0.06, (jitter - 0.5) * 0.05);
        q.setFromAxisAngle(axis, (jitter - 0.5) * 0.25);
        s.setScalar(0.85 + jitter * 0.4);
        local.compose(p, q, s);
        wheatMatrices.push(bendMatrix(x, z, R).multiply(local));
      }
    }

    return { building, sails, wheat, wheatMatrices, hub: [HUB_X, HUB_Y, 0] as const };
  }, [item.scale]);

  const wheatRef = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = wheatRef.current;
    if (!m) return;
    for (let i = 0; i < wheatMatrices.length; i++) m.setMatrixAt(i, wheatMatrices[i]);
    m.instanceMatrix.needsUpdate = true;
  }, [wheatMatrices]);

  useEffect(
    () => () => {
      building.dispose();
      sails.dispose();
      wheat.dispose();
    },
    [building, sails, wheat]
  );

  const sailGroup = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    stepMill(Math.min(delta, MAX_DELTA));
    if (sailGroup.current) sailGroup.current.rotation.x = mill.angle;
  });

  return (
    <group position={position} quaternion={quaternion} scale={item.scale}>
      <mesh geometry={building}>
        <meshStandardMaterial vertexColors roughness={0.9} flatShading />
      </mesh>
      {/* The sails, on the axle. Rotation about x, because that is the axis the
          blades were built perpendicular to. */}
      <group ref={sailGroup} position={[hub[0], hub[1], hub[2]]}>
        <mesh geometry={sails}>
          <meshStandardMaterial vertexColors roughness={0.9} flatShading />
        </mesh>
      </group>
      <instancedMesh
        ref={wheatRef}
        args={[wheat, undefined, wheatMatrices.length]}
        frustumCulled={false}
      >
        <meshStandardMaterial color="#c8a33f" roughness={0.85} flatShading />
      </instancedMesh>
    </group>
  );
}

/**
 * The telescope: a tripod, a yoke, and a tube that tracks the sky.
 *
 * The tube AIMS ITSELF, whether or not anyone is using it, at whichever
 * constellation is highest over this island. That is what makes it read as an
 * instrument rather than as a prop of one: walk past at two different hours and
 * it is pointing somewhere else, because the sky really has moved.
 *
 * Aiming happens in the local tangent frame: the world-space target is brought
 * into the item's own frame by the inverse of its surface transform, and the
 * tube then looks along it. Doing it the other way round, by writing a world
 * quaternion onto a child of a rotated group, would fight the parent transform.
 */
function Telescope({ item }: { item: SceneryItem }) {
  const { position, quaternion } = useSurfaceTransform(item);
  const tube = useRef<THREE.Group>(null);

  const dir = useMemo(() => resolveSceneryDir(item), [item]);
  const scratch = useMemo(
    () => ({
      aim: new THREE.Vector3(),
      inv: new THREE.Quaternion(),
      want: new THREE.Quaternion(),
      look: new THREE.Matrix4(),
      up: new THREE.Vector3(0, 1, 0),
      origin: new THREE.Vector3(),
    }),
    []
  );

  const geometry = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const bake = (g: THREE.BufferGeometry, rgb: readonly [number, number, number]) => {
      const n = g.attributes.position.count;
      const c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        c[i * 3] = rgb[0];
        c[i * 3 + 1] = rgb[1];
        c[i * 3 + 2] = rgb[2];
      }
      g.setAttribute("color", new THREE.BufferAttribute(c, 3));
      parts.push(g);
      return g;
    };
    const WOOD: [number, number, number] = [0.3, 0.2, 0.13];
    const BRASS: [number, number, number] = [0.55, 0.42, 0.16];

    // Three splayed legs meeting under the yoke.
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = new THREE.CylinderGeometry(0.035, 0.05, 1.05, 5).translate(0, 0.52, 0);
      leg.rotateX(0.28);
      leg.rotateY(a);
      leg.translate(0, 0, 0);
      bake(leg, WOOD);
    }
    bake(new THREE.CylinderGeometry(0.09, 0.09, 0.16, 8).translate(0, 1.02, 0), BRASS);

    const merged = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
    for (const g of parts) g.dispose();
    if (!merged) throw new Error("[planet] telescope merge failed");
    return merged;
  }, []);

  const tubeGeometry = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const bake = (g: THREE.BufferGeometry, rgb: readonly [number, number, number]) => {
      const n = g.attributes.position.count;
      const c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        c[i * 3] = rgb[0];
        c[i * 3 + 1] = rgb[1];
        c[i * 3 + 2] = rgb[2];
      }
      g.setAttribute("color", new THREE.BufferAttribute(c, 3));
      parts.push(g);
      return g;
    };
    const BRASS: [number, number, number] = [0.58, 0.45, 0.18];
    const DARK: [number, number, number] = [0.22, 0.19, 0.16];

    // Built along +Z, because that is the axis a lookAt aims.
    bake(
      new THREE.CylinderGeometry(0.11, 0.14, 1.0, 10)
        .rotateX(Math.PI / 2)
        .translate(0, 0, 0.18),
      BRASS
    );
    bake(
      new THREE.CylinderGeometry(0.08, 0.08, 0.3, 10)
        .rotateX(Math.PI / 2)
        .translate(0, 0, -0.38),
      DARK
    );
    bake(new THREE.TorusGeometry(0.14, 0.02, 5, 12).translate(0, 0, 0.55), DARK);

    const merged = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
    for (const g of parts) g.dispose();
    if (!merged) throw new Error("[planet] telescope tube merge failed");
    return merged;
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
      tubeGeometry.dispose();
    },
    [geometry, tubeGeometry]
  );

  useFrame((state) => {
    const t = tube.current;
    if (!t) return;
    const phase = dayPhase(state.clock.elapsedTime);
    const aim = telescopeAim(dir, phase);
    // World target into the item's local frame, then look along it.
    scratch.aim
      .set(aim.x, aim.y, aim.z)
      .applyQuaternion(scratch.inv.copy(quaternion).invert());
    // Arguments in THIS order, not the camera's. `Matrix4.lookAt(eye, target)`
    // builds +Z along (eye - target), which is the camera convention where the
    // lens faces -Z. The tube is a normal object built along +Z, so the eye and
    // the target swap over: get it the other way round and the telescope aims
    // its eyepiece at the sky.
    scratch.look.lookAt(scratch.aim, scratch.origin, scratch.up);
    scratch.want.setFromRotationMatrix(scratch.look);
    // Eased, so it swings round to a new target rather than snapping when the
    // best constellation changes.
    t.quaternion.slerp(scratch.want, 0.04);
  });

  return (
    <group position={position} quaternion={quaternion} scale={item.scale}>
      <mesh geometry={geometry}>
        <meshStandardMaterial vertexColors roughness={0.7} flatShading />
      </mesh>
      <group ref={tube} position={[0, 1.1, 0]}>
        <mesh geometry={tubeGeometry}>
          <meshStandardMaterial vertexColors roughness={0.45} metalness={0.35} flatShading />
        </mesh>
      </group>
    </group>
  );
}

/**
 * The trampoline: a ring of legs, a padded rim, and a mat.
 *
 * Built from the same TRAMPOLINE_* constants `world.tsx` builds the Platform
 * from, so the mat you can see and the mat you can stand on are one claim. The
 * mat is drawn slightly proud of the platform height, because a mat exactly
 * level with your feet reads as a painted circle.
 */
function Trampoline({ item }: { item: SceneryItem }) {
  const { position, quaternion } = useSurfaceTransform(item);

  const geometry = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const bake = (g: THREE.BufferGeometry, rgb: readonly [number, number, number]) => {
      const n = g.attributes.position.count;
      const c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        c[i * 3] = rgb[0];
        c[i * 3 + 1] = rgb[1];
        c[i * 3 + 2] = rgb[2];
      }
      g.setAttribute("color", new THREE.BufferAttribute(c, 3));
      return parts.push(g), g;
    };

    const R = TRAMPOLINE_RADIUS;
    const H = TRAMPOLINE_HEIGHT;
    const FRAME: [number, number, number] = [0.16, 0.18, 0.2];
    const PAD: [number, number, number] = [0.32, 0.5, 0.34];
    const MAT: [number, number, number] = [0.1, 0.13, 0.16];

    // Mat, a shallow dish rather than a disc: it has somebody's weight in it.
    const mat = new THREE.CircleGeometry(R * 0.86, 20).rotateX(-Math.PI / 2);
    const p = mat.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const d = Math.hypot(p.getX(i), p.getZ(i)) / (R * 0.86);
      p.setY(i, H - 0.09 * (1 - d * d));
    }
    mat.computeVertexNormals();
    bake(mat, MAT);

    // Padded rim over the frame.
    bake(new THREE.TorusGeometry(R * 0.9, 0.13, 6, 20).rotateX(Math.PI / 2).translate(0, H, 0), PAD);

    // Legs, splayed out so it does not read as a table.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const x = Math.cos(a) * R * 0.86;
      const z = Math.sin(a) * R * 0.86;
      bake(
        new THREE.CylinderGeometry(0.05, 0.06, H, 5)
          .translate(0, H / 2, 0)
          .rotateZ(Math.sin(a) * 0)
          .translate(x, 0, z),
        FRAME
      );
      // Foot, splayed outward.
      bake(
        new THREE.BoxGeometry(0.26, 0.07, 0.14).rotateY(-a).translate(x * 1.06, 0.035, z * 1.06),
        FRAME
      );
    }

    const flat = parts.map((g) => (g.index ? g.toNonIndexed() : g));
    const merged = mergeGeometries(flat);
    for (const g of parts) g.dispose();
    for (const g of flat) if (!parts.includes(g)) g.dispose();
    if (!merged) throw new Error("[planet] trampoline merge failed");
    return merged;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} position={position} quaternion={quaternion} scale={item.scale}>
      <meshStandardMaterial vertexColors roughness={0.8} flatShading />
    </mesh>
  );
}

/**
 * A heap of snowballs, stacked the way you would if you were about to build
 * something out of them and then wandered off.
 *
 * Procedural for the same reason the mountain is: it is four spheres, and a
 * downloaded model would cost a fetch, a licence row and a normalisation pass
 * to deliver less control than eight lines of code.
 */
function SnowPile({ item }: { item: SceneryItem }) {
  const { position, quaternion } = useSurfaceTransform(item);

  const geometry = useMemo(() => {
    // Four at the base, two balanced on top. Radii vary so it reads as
    // rolled-by-hand rather than as a manufactured pyramid.
    //
    // SIZED TO THE HAND, not to the pile. These are snowballs somebody rolled
    // to throw, so the test is whether one of them looks like something a
    // 0.84-unit character could pick up: at radius 0.15 a ball is about a fifth
    // of the player's height, and the whole stack tops out at 0.44, mid-shin.
    // Two earlier passes got this wrong in the same direction, first at 1.76
    // (taller than the snowman beside it) and then at 0.72.
    const balls: [number, number, number, number][] = [
      [0.16, -0.14, 0.14, 0.08],
      [0.15, 0.15, 0.13, -0.09],
      [0.14, 0.01, 0.12, -0.17],
      [0.13, -0.02, 0.12, 0.19],
      [0.14, 0.0, 0.31, 0.01],
      [0.12, 0.13, 0.29, 0.13],
    ];
    const parts = balls.map(([r, x, y, z]) =>
      new THREE.SphereGeometry(r, 9, 7).translate(x, y, z)
    );
    const merged = mergeGeometries(parts.map((p) => p.toNonIndexed()));
    for (const p of parts) p.dispose();
    if (!merged) throw new Error("[planet] snow pile merge failed");

    // Linear vertex colours, matching the terrain and every scatter prop. A
    // hex `color` here would land about three times darker.
    const pos = merged.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      // Slight shading by height so the stack is not one flat white blob.
      const t = Math.min(1, Math.max(0, pos.getY(i) / 0.44));
      const v = 0.78 + t * 0.16;
      colors[i * 3] = v;
      colors[i * 3 + 1] = v * 1.01;
      colors[i * 3 + 2] = v * 1.04;
    }
    merged.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return merged;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      geometry={geometry}
      position={position}
      quaternion={quaternion}
      scale={item.scale}
    >
      <meshStandardMaterial vertexColors roughness={0.85} flatShading />
    </mesh>
  );
}

/**
 * Lantern glows that come on when night reaches them.
 *
 * Per-lantern rather than global: with an orbiting sun, "is it night" is a
 * question about a place, not about the scene, so each lantern asks it of its
 * own patch of ground. Walking along the shore path at dusk you see them come
 * on ahead of you as the terminator passes.
 *
 * Additive sprites rather than point lights. Six point lights would recompile
 * every material in the scene and cost real shading time for what is, visually,
 * a soft blob. These cost one draw call each and cannot slow anything down.
 */
function LanternGlows() {
  const group = useRef<THREE.Group>(null);
  const halo = useMemo(() => makeGlowTexture(), []);

  const lanterns = useMemo(
    () =>
      SCENERY.filter((item) => item.asset === "lantern").map((item) => {
        const d = resolveSceneryDir(item);
        const dir = new THREE.Vector3(d.x, d.y, d.z);
        return {
          dir,
          // Just above the lamp housing: the model is 1.556 tall at scale 1.
          position: dir.clone().multiplyScalar(RADIUS + 1.4 * item.scale),
        };
      }),
    []
  );

  useEffect(() => () => halo.dispose(), [halo]);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const sun = sunDirection(dayPhase(state.clock.elapsedTime));
    for (let i = 0; i < g.children.length; i++) {
      const sprite = g.children[i] as THREE.Sprite;
      const l = lanterns[i];
      if (!l) continue;
      const dot = l.dir.x * sun.x + l.dir.y * sun.y + l.dir.z * sun.z;
      const dark = darknessAt(dot);
      sprite.visible = dark > 0.01;
      if (sprite.visible) {
        (sprite.material as THREE.SpriteMaterial).opacity = dark * 0.85;
        // A slow flicker, so a lit lantern reads as a flame rather than a bulb.
        const flicker =
          1 + Math.sin(state.clock.elapsedTime * 3.1 + i * 2.3) * 0.07;
        sprite.scale.setScalar(2.1 * dark * flicker);
      }
    }
  });

  return (
    <group ref={group}>
      {lanterns.map((l, i) => (
        <sprite key={i} position={l.position} visible={false}>
          <spriteMaterial
            map={halo}
            color="#ffd08a"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      ))}
    </group>
  );
}

/** Radial falloff, so an additive sprite reads as a glow rather than a card. */
function makeGlowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.3, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export function Scenery({ markers }: { markers: readonly PlanetMarker[] }) {
  return (
    <>
      {SCENERY.filter((item) => !item.dynamic).map((item, i) =>
        item.asset === "proc:mountain" ? (
          <Mountain key={i} item={item} />
        ) : item.asset === "proc:snowpile" ? (
          <SnowPile key={i} item={item} />
        ) : item.asset === "proc:millhouse" ? (
          <MillHouse key={i} item={item} />
        ) : item.asset === "proc:trampoline" ? (
          <Trampoline key={i} item={item} />
        ) : item.asset === "proc:telescope" ? (
          <Telescope key={i} item={item} />
        ) : (
          // A missing scenery model simply doesn't render; nothing depends
          // on it.
          <AssetErrorBoundary key={i} fallback={null}>
            <GltfScenery item={item} />
          </AssetErrorBoundary>
        )
      )}

      <LanternGlows />
    </>
  );
}

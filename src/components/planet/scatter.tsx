"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { biomeColor } from "@/lib/planet/biome";
import {
  RADIUS,
  SCATTER_CLEARANCE_ANGLE,
  SCATTER_HIGH,
  SCATTER_LOW,
} from "@/lib/planet/config";
import { dominantDistrict } from "@/lib/planet/districts";
import { KITS, type KitLayer, type PropShapeId } from "@/lib/planet/kits";
import { fibonacciSphere } from "@/lib/planet/layout";
import { resolveSceneryDir, SCENERY, SPAWN } from "@/lib/planet/world-layout";
import type { PlanetMarker } from "@/lib/planet/types";

/**
 * District-driven prop scatter.
 *
 * Every shape id used anywhere becomes exactly one InstancedMesh: the
 * draw-call cost is the number of distinct shapes (~14), not the instance
 * count (~2100). Placement is deterministic (sine hash, no Math.random),
 * built once in a useMemo, with zero per-frame work.
 *
 * Shapes are merged single-material geometries with baked vertex colours.
 * Instance colours multiply the baked colours, so tint-receiving parts
 * (canopies, petals) are baked white and identity parts (trunks) are baked
 * in their own colour.
 */

const UP = new THREE.Vector3(0, 1, 0);
const WHITE: readonly [number, number, number] = [1, 1, 1];

function hash(n: number, seed: number): number {
  const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ---------------------------------------------------------------- shapes

/** Bakes a uniform colour attribute onto a geometry. */
function bake(geo: THREE.BufferGeometry, rgb: readonly [number, number, number]) {
  const count = geo.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = rgb[0];
    colors[i * 3 + 1] = rgb[1];
    colors[i * 3 + 2] = rgb[2];
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // Polyhedron-based primitives are non-indexed while cylinders/cones/boxes
  // are indexed; mergeGeometries refuses to mix them. Flat shading needs no
  // index anyway, so normalise every part to non-indexed.
  const flat = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  const merged = mergeGeometries(flat);
  for (const p of parts) p.dispose();
  for (const p of flat) if (!parts.includes(p)) p.dispose();
  if (!merged) throw new Error("[planet] scatter shape merge failed");
  return merged;
}

const TRUNK: readonly [number, number, number] = [0.42, 0.31, 0.22];
const STEM: readonly [number, number, number] = [0.28, 0.42, 0.28];

interface ShapeDef {
  build: () => THREE.BufferGeometry;
  rough: number;
  metal: number;
}

const SHAPES: Record<PropShapeId, ShapeDef> = {
  rock: {
    rough: 0.95,
    metal: 0.02,
    build: () => bake(new THREE.IcosahedronGeometry(0.55, 0).scale(1, 0.62, 1), WHITE),
  },
  boulder: {
    rough: 0.95,
    metal: 0.02,
    build: () => bake(new THREE.IcosahedronGeometry(0.8, 1).scale(1, 0.72, 1), WHITE),
  },
  treeCone: {
    rough: 0.85,
    metal: 0.02,
    build: () =>
      merge([
        bake(new THREE.CylinderGeometry(0.09, 0.13, 0.55, 6).translate(0, 0.27, 0), TRUNK),
        bake(new THREE.ConeGeometry(0.5, 1.15, 7).translate(0, 1.05, 0), WHITE),
        bake(new THREE.ConeGeometry(0.36, 0.85, 7).translate(0, 1.55, 0), WHITE),
      ]),
  },
  treeRound: {
    rough: 0.85,
    metal: 0.02,
    build: () =>
      merge([
        bake(new THREE.CylinderGeometry(0.09, 0.13, 0.6, 6).translate(0, 0.3, 0), TRUNK),
        bake(new THREE.IcosahedronGeometry(0.55, 0).scale(1, 0.92, 1).translate(0, 1.05, 0), WHITE),
      ]),
  },
  grassTuft: {
    rough: 0.9,
    metal: 0,
    build: () =>
      merge([
        bake(new THREE.ConeGeometry(0.06, 0.4, 4).translate(0, 0.2, 0), WHITE),
        bake(new THREE.ConeGeometry(0.05, 0.32, 4).rotateZ(0.35).translate(0.09, 0.15, 0.02), WHITE),
        bake(new THREE.ConeGeometry(0.05, 0.3, 4).rotateZ(-0.3).rotateY(1.9).translate(-0.07, 0.14, -0.05), WHITE),
      ]),
  },
  flower: {
    rough: 0.7,
    metal: 0,
    build: () =>
      merge([
        bake(new THREE.CylinderGeometry(0.025, 0.03, 0.4, 5).translate(0, 0.2, 0), STEM),
        bake(new THREE.IcosahedronGeometry(0.11, 0).translate(0, 0.45, 0), WHITE),
      ]),
  },
  stump: {
    rough: 0.9,
    metal: 0,
    build: () => bake(new THREE.CylinderGeometry(0.2, 0.25, 0.35, 7).translate(0, 0.17, 0), WHITE),
  },
  crate: {
    rough: 0.8,
    metal: 0.05,
    build: () => bake(new THREE.BoxGeometry(0.62, 0.62, 0.62).translate(0, 0.31, 0), WHITE),
  },
  pipe: {
    rough: 0.5,
    metal: 0.5,
    build: () =>
      merge([
        bake(new THREE.CylinderGeometry(0.14, 0.14, 1.1, 8).rotateZ(Math.PI / 2).translate(0, 0.14, 0), WHITE),
        bake(new THREE.CylinderGeometry(0.14, 0.14, 0.5, 8).translate(0.55, 0.25, 0), WHITE),
      ]),
  },
  vent: {
    rough: 0.65,
    metal: 0.35,
    build: () =>
      merge([
        bake(new THREE.BoxGeometry(0.6, 0.45, 0.6).translate(0, 0.22, 0), WHITE),
        bake(new THREE.BoxGeometry(0.4, 0.28, 0.4).translate(0, 0.58, 0), [0.75, 0.78, 0.85]),
      ]),
  },
  crystal: {
    rough: 0.25,
    metal: 0.15,
    build: () =>
      merge([
        bake(new THREE.OctahedronGeometry(0.28, 0).scale(1, 2.2, 1).translate(0, 0.5, 0), WHITE),
        bake(new THREE.OctahedronGeometry(0.16, 0).scale(1, 1.9, 1).rotateZ(0.5).translate(0.24, 0.25, 0.06), WHITE),
      ]),
  },
  glowPlant: {
    rough: 0.4,
    metal: 0,
    build: () =>
      merge([
        bake(new THREE.CylinderGeometry(0.03, 0.04, 0.5, 5).rotateZ(0.15).translate(0, 0.25, 0), STEM),
        bake(new THREE.SphereGeometry(0.13, 8, 6).translate(0.07, 0.55, 0), WHITE),
      ]),
  },
  snowPine: {
    rough: 0.85,
    metal: 0,
    build: () =>
      merge([
        bake(new THREE.CylinderGeometry(0.08, 0.12, 0.4, 6).translate(0, 0.2, 0), TRUNK),
        bake(new THREE.ConeGeometry(0.5, 1.0, 7).translate(0, 0.85, 0), WHITE),
        bake(new THREE.ConeGeometry(0.34, 0.8, 7).translate(0, 1.4, 0), WHITE),
      ]),
  },
  iceShard: {
    rough: 0.3,
    metal: 0.1,
    build: () => bake(new THREE.OctahedronGeometry(0.3, 0).scale(1, 2.8, 1).translate(0, 0.55, 0), WHITE),
  },
};

// ---------------------------------------------------------------- placement

interface ShapeInstances {
  matrices: THREE.Matrix4[];
  colors: THREE.Color[];
}

function pickLayer(layers: readonly KitLayer[], r: number): KitLayer {
  let total = 0;
  for (const l of layers) total += l.weight;
  let x = r * total;
  for (const l of layers) {
    x -= l.weight;
    if (x <= 0) return l;
  }
  return layers[layers.length - 1];
}

function buildPlacement(
  markers: readonly PlanetMarker[],
  count: number
): Map<PropShapeId, ShapeInstances> {
  const out = new Map<PropShapeId, ShapeInstances>();

  // Keep-out zones: every marker, every authored scenery footprint, plus the
  // spawn point and the first few steps of the spawn-to-House sightline so
  // the opening view is a clear meadow, not the back of a tree.
  const cosMarker = Math.cos(SCATTER_CLEARANCE_ANGLE);
  const blockers = SCENERY.map((item) => ({
    dir: resolveSceneryDir(item),
    cos: Math.cos(item.clearAngle),
  }));
  blockers.push({ dir: { ...SPAWN }, cos: Math.cos(0.18) });
  blockers.push({
    // Midpoint of spawn -> house-centre (0, 0.0995, 0.995), normalized.
    dir: (() => {
      const v = {
        x: SPAWN.x / 2,
        y: (SPAWN.y + 0.0995) / 2,
        z: (SPAWN.z + 0.995) / 2,
      };
      const l = Math.hypot(v.x, v.y, v.z);
      return { x: v.x / l, y: v.y / l, z: v.z / l };
    })(),
    cos: Math.cos(0.16),
  });

  const dirs = fibonacciSphere(Math.round(count * 1.7), 0.31);

  const dir = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const spin = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();

  let placed = 0;
  for (let i = 0; i < dirs.length && placed < count; i++) {
    const d = dirs[i];
    dir
      .set(
        d.x + (hash(i, 1) - 0.5) * 0.1,
        d.y + (hash(i, 2) - 0.5) * 0.1,
        d.z + (hash(i, 3) - 0.5) * 0.1
      )
      .normalize();

    // District selection with a soft edge: candidates deep in the falloff
    // band keep their island kit but thin out. Ocean candidates are thinned
    // hard: the open water carries only rare rock islets.
    const dom = dominantDistrict(dir);
    if (dom.id === "wilds") {
      if (hash(i, 9) > 0.05) continue;
    } else if (dom.w < 1 && hash(i, 4) > 0.3 + 0.7 * dom.w) {
      continue;
    }
    const layers = KITS[dom.id];

    let blocked = false;
    for (const m of markers) {
      if (dir.x * m.dir.x + dir.y * m.dir.y + dir.z * m.dir.z > cosMarker) {
        blocked = true;
        break;
      }
    }
    if (!blocked) {
      for (const b of blockers) {
        if (dir.x * b.dir.x + dir.y * b.dir.y + dir.z * b.dir.z > b.cos) {
          blocked = true;
          break;
        }
      }
    }
    if (blocked) continue;

    const layer = pickLayer(layers, hash(i, 5));
    const s = layer.scale[0] + hash(i, 6) * (layer.scale[1] - layer.scale[0]);

    quat.setFromUnitVectors(UP, dir);
    spin.setFromAxisAngle(dir, hash(i, 7) * Math.PI * 2);
    quat.premultiply(spin);
    pos.copy(dir).multiplyScalar(RADIUS - layer.sink * s);
    scl.setScalar(s);

    let bucket = out.get(layer.shape);
    if (!bucket) {
      bucket = { matrices: [], colors: [] };
      out.set(layer.shape, bucket);
    }
    bucket.matrices.push(new THREE.Matrix4().compose(pos, quat, scl));

    if (layer.tint === "ground") {
      const [r, g, b] = biomeColor(dir);
      // Props sit a little darker than the ground they stand on, so they
      // read as objects rather than as patches of terrain.
      bucket.colors.push(new THREE.Color(r * 0.82, g * 0.82, b * 0.86));
    } else {
      const fixed = layer.tint[Math.floor(hash(i, 8) * layer.tint.length) % layer.tint.length];
      bucket.colors.push(new THREE.Color(fixed[0], fixed[1], fixed[2]));
    }
    placed++;
  }

  return out;
}

// ---------------------------------------------------------------- component

interface Props {
  markers: readonly PlanetMarker[];
  lowPower: boolean;
}

export function Scatter({ markers, lowPower }: Props) {
  const meshes = useMemo(() => {
    const count = lowPower ? SCATTER_LOW : SCATTER_HIGH;
    const placement = buildPlacement(markers, count);

    const built: THREE.InstancedMesh[] = [];
    placement.forEach((inst, shapeId) => {
      const def = SHAPES[shapeId];
      const geometry = def.build();
      const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: def.rough,
        metalness: def.metal,
        flatShading: true,
      });
      const mesh = new THREE.InstancedMesh(geometry, material, inst.matrices.length);
      for (let i = 0; i < inst.matrices.length; i++) {
        mesh.setMatrixAt(i, inst.matrices[i]);
        mesh.setColorAt(i, inst.colors[i]);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      // Instances cover the whole sphere, so the mesh is never fully off
      // screen and per-object frustum culling can only cost time.
      mesh.frustumCulled = false;
      built.push(mesh);
    });
    return built;
  }, [markers, lowPower]);

  useEffect(
    () => () => {
      for (const mesh of meshes) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        mesh.dispose();
      }
    },
    [meshes]
  );

  return (
    <>
      {meshes.map((mesh, i) => (
        <primitive key={i} object={mesh} />
      ))}
    </>
  );
}

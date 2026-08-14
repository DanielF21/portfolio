"use client";

import { useEffect, useMemo } from "react";
import { AdditiveBlending, BackSide, BufferAttribute, IcosahedronGeometry } from "three";

import { biomeColor } from "@/lib/planet/biome";
import { RADIUS } from "@/lib/planet/config";

interface Props {
  detail: number;
}

/**
 * Icosahedron rather than SphereGeometry: SphereGeometry has a triangle fan at
 * each pole (dense pinching, ugly under flat shading) and non-uniform triangle
 * area. Icosahedron triangles are uniform.
 *
 * Trade-off: icosahedron UVs are seamed and unusable, so this can never take a
 * wrapped texture. Flat-shaded standard material with baked vertex colours
 * instead, which costs no extra draw call and no texture memory.
 */

/**
 * Colour every triangle from its own centroid and write that one colour to all
 * three of its vertices.
 *
 * Per-vertex colours would smear a gradient across each face and destroy the
 * faceted look that `flatShading` exists to produce. Per-face keeps the facets
 * crisp. This is only possible because PolyhedronGeometry is non-indexed, which
 * is the same property that makes flat shading work in the first place: each
 * triangle owns its three vertices outright.
 */
function buildBiomeGeometry(detail: number): IcosahedronGeometry {
  const geo = new IcosahedronGeometry(RADIUS, detail);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i += 3) {
    // Centroid of the triangle, normalised back onto the unit sphere.
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const s = 1 / (Math.hypot(cx, cy, cz) || 1);
    const nx = cx * s;
    const ny = cy * s;
    const nz = cz * s;

    const [r, g, b] = biomeColor({ x: nx, y: ny, z: nz });

    // Slight per-face brightness jitter, hashed off the centroid so it is
    // stable between runs. Without it, adjacent faces inside one biome read as
    // a single flat sheet and the low-poly geometry stops being legible.
    const h = Math.sin(nx * 12.9898 + ny * 78.233 + nz * 37.719) * 43758.5453;
    const shade = 1 + (h - Math.floor(h) - 0.5) * 0.14;

    for (let v = 0; v < 3; v++) {
      const o = (i + v) * 3;
      colors[o] = r * shade;
      colors[o + 1] = g * shade;
      colors[o + 2] = b * shade;
    }
  }

  geo.setAttribute("color", new BufferAttribute(colors, 3));
  return geo;
}

export function PlanetMesh({ detail }: Props) {
  const geometry = useMemo(() => buildBiomeGeometry(detail), [detail]);

  // Built imperatively, so R3F does not own it and will not dispose it.
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group>
      <mesh geometry={geometry} receiveShadow={false}>
        <meshStandardMaterial
          vertexColors
          roughness={0.92}
          metalness={0.02}
          flatShading
        />
      </mesh>

      {/* Atmosphere shell. Additive rather than alpha blending: over a near
          black sky, an alpha-blended shell just greys the horizon, whereas
          additive actually reads as a glow. */}
      <mesh scale={1.05}>
        <icosahedronGeometry args={[RADIUS, Math.max(2, detail - 4)]} />
        <meshBasicMaterial
          color="#1d4ed8"
          transparent
          opacity={0.14}
          side={BackSide}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

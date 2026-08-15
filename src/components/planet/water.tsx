"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { RADIUS, WATER_EDGE_WEIGHT, WATER_HEIGHT } from "@/lib/planet/config";
import { maxDistrictWeight } from "@/lib/planet/districts";

/**
 * The ocean surface: a translucent shell just above the sphere, with waves.
 *
 * WHY A SHELL AND NOT A REPAINT. `biome.ts` already colours the open ocean, so
 * this does not need to provide the blue. What it provides is the two things a
 * painted sphere cannot: motion, and a specular highlight that tracks the sun.
 * A completely still ocean is what made the old water world read as a map of
 * an ocean rather than an ocean.
 *
 * WHY VERTEX ALPHA. Land and sea are at the same radius (no terrain
 * displacement), so a shell at RADIUS + 0.18 would flood every island. Instead
 * its alpha is baked per vertex from the island weight: fully transparent over
 * dry land, opaque over open water, ramping across the beach band. The place
 * where the ramp happens IS the coastline, and it lines up with the sand that
 * biome.ts paints because both read the same weight field.
 *
 * All of that is baked once at build time. The only per-frame work is writing
 * one float uniform.
 */

/** Lower than the planet's own subdivision: the waves are long, so what
 *  matters is having a vertex every unit or so, not matching the terrain. */
const DETAIL = 14;

/** Alpha ramp, in island-weight units. Fully water below the first, fully dry
 *  above the second, straddling WATER_EDGE_WEIGHT. */
const WET = WATER_EDGE_WEIGHT - 0.1;
const DRY = WATER_EDGE_WEIGHT + 0.1;

/** Foam is a narrow white band right at the waterline. Narrow is the whole
 *  point: widened out it stops reading as surf and starts reading as haze. */
const FOAM_WIDTH = 0.04;

/** The shell TINTS the ocean rather than repainting it. `biome.ts` already
 *  paints deep water and a shallows ring, so pushing these toward full
 *  saturation doubles up on colour that is already there and flattens the
 *  shoreline gradient the sphere is drawing underneath. */
const DEEP: readonly [number, number, number] = [0.1, 0.3, 0.52];
const SHALLOW: readonly [number, number, number] = [0.2, 0.5, 0.6];

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function buildWaterGeometry(): THREE.IcosahedronGeometry {
  const geo = new THREE.IcosahedronGeometry(RADIUS + WATER_HEIGHT, DETAIL);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 4);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const s = 1 / (Math.hypot(x, y, z) || 1);
    const w = maxDistrictWeight({ x: x * s, y: y * s, z: z * s });

    // 1 out at sea, 0 on dry land.
    const wet = 1 - smoothstep(WET, DRY, w);
    // Peaks exactly at the waterline and falls away on both sides.
    const foam = Math.max(
      0,
      1 - Math.abs(w - WATER_EDGE_WEIGHT) / FOAM_WIDTH
    );

    // Shallower (and lighter) as the island is approached.
    const toShore = smoothstep(0, WATER_EDGE_WEIGHT, w);
    const r = DEEP[0] + (SHALLOW[0] - DEEP[0]) * toShore + foam * 0.35;
    const g = DEEP[1] + (SHALLOW[1] - DEEP[1]) * toShore + foam * 0.35;
    const b = DEEP[2] + (SHALLOW[2] - DEEP[2]) * toShore + foam * 0.32;

    const o = i * 4;
    colors[o] = r;
    colors[o + 1] = g;
    colors[o + 2] = b;
    // Foam is opaque even where the water is thinning out, so the coastline
    // keeps a defined edge instead of dissolving.
    colors[o + 3] = Math.min(1, wet * 0.55 + foam * 0.4);
  }

  geo.setAttribute("color", new THREE.BufferAttribute(colors, 4));
  return geo;
}

export function Water() {
  const uniforms = useRef({ uTime: { value: 0 } });

  const geometry = useMemo(() => buildWaterGeometry(), []);

  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      roughness: 0.18,
      metalness: 0.0,
      side: THREE.FrontSide,
    });

    // Two long, slow swells summed at incommensurate frequencies so the
    // surface never visibly repeats. Displacement is along the surface normal,
    // which on a sphere is just the normalised position.
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.current.uTime;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           vec3 nrm = normalize(position);
           float swell =
             sin(position.x * 0.55 + uTime * 0.75) +
             sin(position.z * 0.43 - uTime * 0.55) +
             sin(position.y * 0.61 + uTime * 0.35) * 0.6;
           transformed += nrm * swell * 0.055;`
        );
    };
    return m;
  }, []);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((state) => {
    uniforms.current.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh
      geometry={geometry}
      material={material}
      // After the planet, so the transparent surface blends over the seabed.
      renderOrder={1}
    />
  );
}

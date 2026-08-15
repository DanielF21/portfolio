"use client";

import { Clone, useGLTF } from "@react-three/drei";
import {
  Component,
  useEffect,
  useMemo,
  useRef,
  type ComponentType,
  type ReactNode,
} from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { ASSETS } from "@/lib/planet/asset-manifest";

import { fixGltfMaterials } from "./gltf-fixup";

/**
 * The 3D body of a marker: a GLTF model when the manifest has a URL, a
 * procedural primitive assembly otherwise (or when the fetch fails).
 *
 * Contract with `marker-mesh.tsx`: the body registers every fade-able material
 * into `matsRef` on mount. The marker's frame loop lerps those materials
 * toward the visited grey; it never traverses or allocates per frame.
 */

/** One material the marker frame loop is allowed to tint. */
export interface FadeEntry {
  mat: THREE.MeshStandardMaterial;
  /** The material's authored colour; the loop lerps from a copy of this. */
  live: THREE.Color;
  /** Only procedural bodies pulse emissive; arbitrary GLTF materials are left
   *  alone beyond the colour fade. */
  emissive: boolean;
}

export type MatsRef = React.MutableRefObject<FadeEntry[]>;

// NOTE: no module-scope preload here. This file is imported by scenery.tsx
// (for AssetErrorBoundary), so a `for (const def of Object.values(ASSETS))`
// preload loop would run on every entry and fetch all ~740KB of models,
// including the dozen that exist only for markers the world no longer ships.
// Scenery preloads what scenery uses; a mounted marker body fetches its own
// model through the useGLTF suspension below.

interface BodyProps {
  assetId: string;
  /** District accent colour, used by procedural bodies. */
  accent: string;
  /** Fallback silhouette hint: projects float an octahedron, landmarks a box. */
  isProject: boolean;
  matsRef: MatsRef;
}

function GltfBody({
  url,
  scale,
  yOffset,
  matsRef,
}: {
  url: string;
  scale: number;
  yOffset: number;
  matsRef: MatsRef;
}) {
  const { scene } = useGLTF(url);
  const group = useRef<THREE.Group>(null);

  useEffect(() => {
    const g = group.current;
    if (!g) return;

    // Same repairs as scenery: metallicFactor default and near-black base
    // colours both render as holes in a scene with no environment map.
    fixGltfMaterials(g);

    const entries: FadeEntry[] = [];
    let meshes = 0;
    g.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh) return;
      meshes++;
      const mesh = o as THREE.Mesh;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial;
        if (std.color) {
          entries.push({ mat: std, live: std.color.clone(), emissive: false });
        }
      }
    });
    if (process.env.NODE_ENV !== "production" && meshes > 3) {
      console.warn(
        `[planet] asset ${url} has ${meshes} meshes; keep marker bodies at <= 3 to hold the draw-call budget.`
      );
    }
    matsRef.current = entries;
    return () => {
      matsRef.current = [];
    };
  }, [url, matsRef]);

  return (
    <group ref={group} position={[0, yOffset, 0]} scale={scale}>
      {/* materialsOnly: each marker gets its own material instances, so the
          visited fade on one never greys the shared GLTF cache. */}
      <Clone object={scene} deep="materialsOnly" />
    </group>
  );
}

/** Creates a fixed set of materials once, registers them for the visited
 *  fade, and disposes them on unmount. `specs` must be a module constant. */
function useBodyMats(
  matsRef: MatsRef,
  specs: readonly { color: string; emissive: boolean; rough?: number; metal?: number }[]
) {
  const mats = useMemo(
    () =>
      specs.map(
        (s) =>
          new THREE.MeshStandardMaterial({
            color: s.color,
            emissive: s.emissive ? s.color : "#000000",
            emissiveIntensity: s.emissive ? 0.5 : 0,
            roughness: s.rough ?? 0.5,
            metalness: s.metal ?? 0.1,
            flatShading: true,
          })
      ),
    [specs]
  );

  useEffect(() => {
    matsRef.current = mats.map((m, i) => ({
      mat: m,
      live: m.color.clone(),
      emissive: specs[i].emissive,
    }));
    return () => {
      matsRef.current = [];
      for (const m of mats) m.dispose();
    };
  }, [mats, matsRef, specs]);

  return mats;
}

// ---------------------------------------------------------------- lectern

const LECTERN_SPECS = [
  { color: "#7c5a3a", emissive: false, rough: 0.8 }, // wood
  { color: "#f5f1e6", emissive: true, rough: 0.6 }, // the page
] as const;

/** The résumé: a big document on a slanted lectern. */
function LecternBody({ matsRef }: BodyProps) {
  const [wood, page] = useBodyMats(matsRef, LECTERN_SPECS);
  return (
    <group>
      <mesh material={wood} position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.05, 0.09, 0.5, 8]} />
      </mesh>
      <mesh material={wood} position={[0, 0.08, 0]} rotation={[-0.5, 0, 0]}>
        <boxGeometry args={[0.44, 0.05, 0.34]} />
      </mesh>
      <mesh material={page} position={[0, 0.13, 0.01]} rotation={[-0.5, 0, 0]}>
        <boxGeometry args={[0.36, 0.02, 0.28]} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------- dna helix

const HELIX_SPECS = [{ color: "#86efac", emissive: true, rough: 0.35 }] as const;

/** Two twisted strands of spheres with rungs, merged into one geometry. */
function DnaHelixBody({ matsRef }: BodyProps) {
  const [mat] = useBodyMats(matsRef, HELIX_SPECS);

  const geometry = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const STEPS = 14;
    const HEIGHT = 0.95;
    const R = 0.15;
    const TURNS = 1.75;

    for (let i = 0; i < STEPS; i++) {
      const t = i / (STEPS - 1);
      // Base at local zero (plus sphere radius): this body is grounded, so
      // its bottom must meet the pad rather than centre on the hover origin.
      const y = 0.045 + t * HEIGHT;
      const a = t * TURNS * Math.PI * 2;
      for (const phase of [0, Math.PI]) {
        const s = new THREE.SphereGeometry(0.045, 8, 6);
        s.translate(Math.cos(a + phase) * R, y, Math.sin(a + phase) * R);
        parts.push(s);
      }
      if (i % 3 === 1) {
        const rung = new THREE.CylinderGeometry(0.018, 0.018, R * 2, 6);
        rung.rotateZ(Math.PI / 2);
        rung.rotateY(-a);
        rung.translate(0, y, 0);
        parts.push(rung);
      }
    }

    const merged = mergeGeometries(parts);
    for (const p of parts) p.dispose();
    return merged;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return <mesh geometry={geometry} material={mat} />;
}

// ---------------------------------------------------------------- lambda

const LAMBDA_SPECS = [
  { color: "#3b3f54", emissive: false, rough: 0.7 }, // plinth
  { color: "#c084fc", emissive: true, rough: 0.3 }, // glyph
] as const;

/** The Scheme interpreter: a glowing lambda on a plinth. */
function LambdaBody({ matsRef }: BodyProps) {
  const [plinth, glyph] = useBodyMats(matsRef, LAMBDA_SPECS);
  return (
    <group>
      <mesh material={plinth} position={[0, -0.38, 0]}>
        <boxGeometry args={[0.46, 0.1, 0.46]} />
      </mesh>
      {/* Long stroke: top-left down to bottom-right. */}
      <mesh material={glyph} position={[0.07, 0.02, 0]} rotation={[0, 0, -0.42]}>
        <boxGeometry args={[0.11, 0.72, 0.09]} />
      </mesh>
      {/* Short leg: from the middle down to bottom-left. */}
      <mesh material={glyph} position={[-0.12, -0.14, 0]} rotation={[0, 0, 0.42]}>
        <boxGeometry args={[0.11, 0.42, 0.09]} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------- hoop

const HOOP_SPECS = [
  { color: "#9aa3b2", emissive: false, metal: 0.5, rough: 0.4 }, // pole
  { color: "#f5f1e6", emissive: false, rough: 0.6 }, // backboard
  { color: "#fb923c", emissive: true, rough: 0.35 }, // ring
] as const;

/** NBA clustering: a basketball hoop. */
function HoopBody({ matsRef }: BodyProps) {
  const [pole, board, ring] = useBodyMats(matsRef, HOOP_SPECS);
  return (
    <group>
      <mesh material={pole} position={[0, -0.05, -0.16]}>
        <cylinderGeometry args={[0.035, 0.035, 1.15, 8]} />
      </mesh>
      <mesh material={board} position={[0, 0.38, -0.12]}>
        <boxGeometry args={[0.5, 0.34, 0.03]} />
      </mesh>
      <mesh material={ring} position={[0, 0.28, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.12, 0.016, 8, 20]} />
      </mesh>
    </group>
  );
}

/** Procedural-by-design bodies, keyed by assetId. */
const PROCEDURAL: Record<string, ComponentType<BodyProps>> = {
  "lectern-document": LecternBody,
  "dna-helix": DnaHelixBody,
  "lambda-sign": LambdaBody,
  "basketball-hoop": HoopBody,
};

/** Procedural body: the pre-GLTF octahedron/box vocabulary, still used as the
 *  failure fallback and for markers with no bespoke procedural body. */
export function FallbackBody({ accent, isProject, matsRef }: BodyProps) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);

  useEffect(() => {
    const m = mat.current;
    if (!m) return;
    matsRef.current = [{ mat: m, live: new THREE.Color(accent), emissive: true }];
    return () => {
      matsRef.current = [];
    };
  }, [accent, matsRef]);

  return (
    <mesh>
      {isProject ? (
        <octahedronGeometry args={[0.34, 0]} />
      ) : (
        <boxGeometry args={[0.42, 0.62, 0.42]} />
      )}
      <meshStandardMaterial
        ref={mat}
        color={accent}
        emissive={accent}
        emissiveIntensity={0.5}
        roughness={0.25}
        metalness={0.35}
        flatShading
      />
    </mesh>
  );
}

interface BoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

/** A failed asset degrades one marker to its procedural body instead of
 *  crashing the canvas into WebglBoundary's 2D bail. */
export class AssetErrorBoundary extends Component<
  BoundaryProps,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("[planet] marker asset failed to load, using fallback:", error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function MarkerBody(props: BodyProps) {
  const def = ASSETS[props.assetId] ?? ASSETS.fallback;
  if (!def.url) {
    const Procedural = PROCEDURAL[props.assetId];
    return Procedural ? <Procedural {...props} /> : <FallbackBody {...props} />;
  }

  return (
    <AssetErrorBoundary fallback={<FallbackBody {...props} />}>
      <GltfBody
        url={def.url}
        scale={def.scale}
        yOffset={def.yOffset}
        matsRef={props.matsRef}
      />
    </AssetErrorBoundary>
  );
}

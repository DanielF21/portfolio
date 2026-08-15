"use client";

import { Clone, useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

import { ASSETS } from "@/lib/planet/asset-manifest";
import { RADIUS } from "@/lib/planet/config";
import { segments, SPANS, type SpanDef } from "@/lib/planet/spans";

import { fixGltfMaterials } from "./gltf-fixup";
import { AssetErrorBoundary } from "./marker-asset";

/**
 * The rendered spans. Walkability comes from the platform caps built in
 * `world.tsx` off the same `spans.ts` data, not from anything here.
 *
 * ORIENTATION IS BUILT FROM THE TANGENT, not from a `heading` angle the way
 * `SceneryItem` does it. A heading is fine for a windmill, which only has to
 * face somewhere plausible, and useless for a bridge, which has to be aimed
 * along a specific great circle to within a degree or the segments visibly
 * zigzag. `makeBasis(tangent, normal, tangent x normal)` gets it exactly right
 * and cannot drift, and the model's long axis is its local X (measured at
 * 1.04 x 0.35 x 0.84).
 */

const URL = ASSETS.bridge.url as string;

function Span({ def }: { def: SpanDef }) {
  const { scene } = useGLTF(URL);

  useEffect(() => {
    fixGltfMaterials(scene);
  }, [scene]);

  const placed = useMemo(() => {
    const basis = new THREE.Matrix4();
    const x = new THREE.Vector3();
    const y = new THREE.Vector3();
    const z = new THREE.Vector3();

    return segments(def).map((s) => {
      x.set(s.tangent.x, s.tangent.y, s.tangent.z).normalize();
      y.set(s.dir.x, s.dir.y, s.dir.z).normalize();
      // Re-orthogonalise before use: the tangent is analytic here, but this
      // costs nothing and makeBasis silently produces a sheared frame if its
      // inputs are not orthonormal.
      x.addScaledVector(y, -x.dot(y)).normalize();
      z.crossVectors(x, y);
      basis.makeBasis(x, y, z);

      return {
        position: y.clone().multiplyScalar(RADIUS),
        quaternion: new THREE.Quaternion().setFromRotationMatrix(basis),
      };
    });
  }, [def]);

  return (
    <>
      {placed.map((p, i) => (
        <group key={i} position={p.position} quaternion={p.quaternion} scale={def.scale}>
          <Clone object={scene} />
        </group>
      ))}
    </>
  );
}

export function Bridges() {
  return (
    <>
      {SPANS.map((def) => (
        // A missing bridge model costs the crossing, not the page.
        <AssetErrorBoundary key={def.id} fallback={null}>
          <Span def={def} />
        </AssetErrorBoundary>
      ))}
    </>
  );
}

"use client";

import { Stars } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, CanvasTexture, DoubleSide, type Group } from "three";

/**
 * Distant scenery: stars, a sun, and a ringed gas giant.
 *
 * All of it sits far outside the planet and is drawn without depth writes, so
 * nothing here can occlude or z-fight with the surface. No bloom or other
 * postprocessing: `@react-three/postprocessing` is not a dependency, and a full
 * screen pass is not worth it for background dressing.
 *
 * The sun's position is deliberately colinear with the directional light in
 * `scene.tsx`, so the light visibly comes from where the sun is drawn.
 */

const SUN_POS: [number, number, number] = [116, 84, 68];
const GIANT_POS: [number, number, number] = [-144, 36, -190];

/** Radial falloff for the sun halo. Without a map, a sprite renders as a
 *  hard-edged quad, which reads as a floating rectangle, not a glow. */
function makeHaloTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

export function Sky() {
  const giant = useRef<Group>(null);
  const stars = useRef<Group>(null);
  const halo = useMemo(() => makeHaloTexture(), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // Barely perceptible, but a completely static sky is what makes a skybox
    // read as a painted backdrop rather than as space.
    if (giant.current) giant.current.rotation.y = t * 0.01;
    if (stars.current) stars.current.rotation.y = t * 0.004;
  });

  return (
    <group>
      <group ref={stars}>
        <Stars radius={190} depth={60} count={1400} factor={3} fade speed={0.4} />
      </group>

      {/* Sun: a small bright core with an additive halo around it. Sizes are
          doubled with the distances, preserving the original angular size. */}
      <mesh position={SUN_POS}>
        <sphereGeometry args={[6.4, 16, 16]} />
        <meshBasicMaterial color="#fff6e0" toneMapped={false} />
      </mesh>
      <sprite position={SUN_POS} scale={[52, 52, 1]}>
        <spriteMaterial
          map={halo}
          color="#ffd9a0"
          transparent
          opacity={0.4}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>

      {/* Ringed gas giant. */}
      <group ref={giant} position={GIANT_POS}>
        <mesh>
          <sphereGeometry args={[28, 24, 24]} />
          <meshStandardMaterial
            color="#b08a6a"
            roughness={1}
            metalness={0}
            emissive="#3a2a1e"
            emissiveIntensity={0.5}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2.6, 0, 0.3]}>
          <ringGeometry args={[36, 54, 48]} />
          <meshBasicMaterial
            color="#d8c0a0"
            transparent
            opacity={0.32}
            side={DoubleSide}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}

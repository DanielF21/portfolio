"use client";

import { Stars } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import {
  darknessAt,
  dayPhase,
  SPIN_AXIS,
  SUN_DISTANCE,
  sunDirection,
} from "@/lib/planet/daylight";
import { telescope } from "@/lib/planet/telescope";
import { CONSTELLATIONS } from "@/lib/planet/constellations";

/**
 * Distant scenery: stars, constellations, a sun, a moon and a ringed gas giant.
 *
 * ALL OF IT LIVES IN ONE ROTATING GROUP, and that is the whole design. The sun
 * appears to cross the sky because the PLANET TURNS, so every other celestial
 * object has to turn with it, about the same axis, at the same rate. The
 * previous version spun the stars about +Y at 0.004 rad/s while the sun ran on
 * an unrelated tilted circle, which meant the constellations slid against the
 * sun over a few minutes.
 *
 * With everything parented to `celestial`, the sun's world position is just
 * its local position carried round by the group, and consistency with the key
 * light is structural rather than something two pieces of code have to agree
 * about.
 *
 * Nothing here writes depth, so none of it can occlude or z-fight the surface.
 */

const GIANT_POS: [number, number, number] = [-202, 50, -266];
const MOON_DISTANCE = SUN_DISTANCE * 0.78;
const STAR_DISTANCE = 300;

/** Radial falloff for the sun halo. Without a map, a sprite renders as a
 *  hard-edged quad, which reads as a floating rectangle, not a glow. */
function makeHaloTexture(): THREE.CanvasTexture {
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
  return new THREE.CanvasTexture(canvas);
}

/**
 * Named stars and the lines between them.
 *
 * Two draw calls for every constellation on the sphere: one InstancedMesh of
 * star quads, one LineSegments for all the joins. Both fade with how dark it
 * is where the observer is standing, so the shapes emerge as night falls
 * rather than being permanently painted on.
 */
function Constellations() {
  const starsRef = useRef<THREE.InstancedMesh>(null);

  const { starGeo, starMat, lineGeo, lineMat, matrices } = useMemo(() => {
    const matrices: THREE.Matrix4[] = [];
    const linePts: number[] = [];

    const up = new THREE.Vector3();
    const right = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const ref = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const scl = new THREE.Vector3();

    for (const c of CONSTELLATIONS) {
      dir.set(c.at.x, c.at.y, c.at.z).normalize();
      // Any consistent tangent frame; the plate is small enough that the
      // choice only rotates the pattern, it does not distort it.
      ref.set(0, 1, 0);
      if (Math.abs(dir.y) > 0.95) ref.set(1, 0, 0);
      right.crossVectors(ref, dir).normalize();
      up.crossVectors(dir, right).normalize();

      // Small-angle placement: offset the direction in the tangent plane and
      // renormalise. Exact enough at a 0.2 rad spread.
      const pts = c.stars.map((s) =>
        dir
          .clone()
          .addScaledVector(right, s.x * c.spread)
          .addScaledVector(up, s.y * c.spread)
          .normalize()
          .multiplyScalar(STAR_DISTANCE)
      );

      pts.forEach((p, i) => {
        // Small. These are stars: at 300 units out they should read as
        // pinpricks that vary in brightness, not as spheres. An earlier pass
        // ran three times this size and they came out as pale orbs.
        matrices.push(
          new THREE.Matrix4().compose(p, q, scl.setScalar(0.34 + c.stars[i].mag * 0.8))
        );
      });
      for (const [a, b] of c.lines) {
        linePts.push(pts[a].x, pts[a].y, pts[a].z, pts[b].x, pts[b].y, pts[b].z);
      }
    }

    const starGeo = new THREE.SphereGeometry(1, 6, 5);
    const starMat = new THREE.MeshBasicMaterial({
      // Plain white. The faint blue tint that was here read as decoration;
      // brightness alone should distinguish one star from another.
      color: new THREE.Color(1, 1, 1),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
    });

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePts, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(0.42, 0.56, 0.85),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    });

    return { starGeo, starMat, lineGeo, lineMat, matrices };
  }, []);

  useEffect(() => {
    const m = starsRef.current;
    if (!m) return;
    for (let i = 0; i < matrices.length; i++) m.setMatrixAt(i, matrices[i]);
    m.instanceMatrix.needsUpdate = true;
  }, [matrices]);

  // Owns its own fade rather than having the parent reach in and mutate it.
  // Constellations emerge as night arrives: walking into dusk and watching
  // Orion resolve out of the dark is the payoff for the whole day cycle.
  const camera = useThree((s) => s.camera);
  const observer = useMemo(() => new THREE.Vector3(), []);
  useFrame((state, delta) => {
    observer.copy(camera.position).normalize();
    const sun = sunDirection(dayPhase(state.clock.elapsedTime));
    const dark = darknessAt(
      observer.x * sun.x + observer.y * sun.y + observer.z * sun.z
    );

    // THE TELESCOPE GATHERS LIGHT. Without this the instrument works for about
    // a third of the day and looks broken for the rest of it: the sky it points
    // at is real, so in daylight there is honestly nothing there to see. A lens
    // that shows you stars you cannot see with the naked eye is what a
    // telescope is for, so being at the eyepiece lifts them.
    const seen = telescope.at ? 1 : 0;
    const starTarget = Math.max(0.22 + dark * 0.78, seen * 0.95);
    const lineTarget = Math.max(dark * 0.28, seen * 0.4);
    // Eased over about a third of a second, so stepping up to it reads as eyes
    // adjusting rather than as a light being switched on.
    const k = 1 - Math.exp(-delta / 0.3);
    starMat.opacity += (starTarget - starMat.opacity) * k;
    lineMat.opacity += (lineTarget - lineMat.opacity) * k;
  });

  useEffect(
    () => () => {
      starGeo.dispose();
      starMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
    },
    [starGeo, starMat, lineGeo, lineMat]
  );

  return (
    <>
      <instancedMesh
        ref={starsRef}
        args={[starGeo, starMat, matrices.length]}
        frustumCulled={false}
      />
      <lineSegments geometry={lineGeo} material={lineMat} frustumCulled={false} />
    </>
  );
}

export function Sky() {
  const celestial = useRef<THREE.Group>(null);
  const giant = useRef<THREE.Group>(null);
  const moonMat = useRef<THREE.MeshStandardMaterial>(null);
  const halo = useMemo(() => makeHaloTexture(), []);
  const camera = useThree((s) => s.camera);

  const axis = useMemo(
    () => new THREE.Vector3(SPIN_AXIS.x, SPIN_AXIS.y, SPIN_AXIS.z).normalize(),
    []
  );
  const observer = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => () => halo.dispose(), [halo]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const phase = dayPhase(t);

    // ONE rotation for the whole sky. The sun's mesh is a child at local
    // (SUN_DISTANCE, 0, 0), which is SUN_AT_ZERO scaled, so after this it
    // lands exactly where `sunDirection(phase)` says the light is coming from.
    if (celestial.current) {
      celestial.current.quaternion.setFromAxisAngle(axis, phase * Math.PI * 2);
    }

    // The gas giant keeps a slow spin of its own, on top of the sky's. A
    // completely static sky is what makes a skybox read as a painted backdrop.
    if (giant.current) giant.current.rotation.y = t * 0.01;

    // How dark it is where the viewer is. Taken from the camera rather than
    // the player because Sky has no access to the player, and at 14 units from
    // a 16-unit planet the two directions are close enough for a brightness
    // curve.
    observer.copy(camera.position).normalize();
    const sun = sunDirection(phase);
    const dark = darknessAt(
      observer.x * sun.x + observer.y * sun.y + observer.z * sun.z
    );

    // A touch of earthshine so the moon is never a flat disc, brighter once
    // the observer is on the night side and it is the only thing up there.
    if (moonMat.current) moonMat.current.emissiveIntensity = 0.15 + dark * 0.5;
  });

  return (
    <group ref={celestial}>
      <Stars radius={265} depth={80} count={1600} factor={4} fade speed={0} />

      <Constellations />

      {/* Sun: a small bright core with an additive halo. At local +X, which is
          SUN_AT_ZERO, so the group's rotation carries it along the same path
          the key light follows. */}
      <group position={[SUN_DISTANCE, 0, 0]}>
        <mesh>
          <sphereGeometry args={[6.4, 16, 16]} />
          <meshBasicMaterial color="#fff6e0" toneMapped={false} />
        </mesh>
        <sprite scale={[52, 52, 1]}>
          <spriteMaterial
            map={halo}
            color="#ffd9a0"
            transparent
            opacity={0.4}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      </group>

      {/* Moon, directly opposite the sun, so it is always full and always up
          when the sun is down. Lit by the same directional light: the light
          travels from the sun past the planet and strikes the face turned back
          toward us, which is exactly what a full moon is. */}
      <group position={[-MOON_DISTANCE, 0, 0]}>
        <mesh>
          <sphereGeometry args={[4.6, 20, 16]} />
          <meshStandardMaterial
            ref={moonMat}
            color="#d9d9d2"
            roughness={1}
            metalness={0}
            emissive="#3a3f52"
            emissiveIntensity={0.2}
            flatShading
          />
        </mesh>
        {/* Maria. Tidally locked, so they rotate with the moon and always
            present the same face. */}
        <mesh position={[4.1, 1.1, 0.9]}>
          <sphereGeometry args={[1.5, 10, 8]} />
          <meshStandardMaterial color="#9fa0a6" roughness={1} flatShading />
        </mesh>
        <mesh position={[3.9, -1.4, -1.3]}>
          <sphereGeometry args={[1.1, 10, 8]} />
          <meshStandardMaterial color="#a8a9ae" roughness={1} flatShading />
        </mesh>
      </group>

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
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}

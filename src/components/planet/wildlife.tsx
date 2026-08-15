"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { RADIUS, WATER_HEIGHT } from "@/lib/planet/config";
import { dayPhase, darknessAt, sunDirection } from "@/lib/planet/daylight";
import { DISTRICT_BY_ID } from "@/lib/planet/districts";
import { placeOnSphere } from "@/lib/planet/layout";

/**
 * Birds, fish and fireflies.
 *
 * Every group is ONE InstancedMesh driven by closed-form motion: each
 * instance's position is a pure function of (time, index), so there is no
 * simulation state, nothing to keep in sync, and nothing that can drift. That
 * matters more here than it sounds, because this is decoration that runs on
 * every frame forever, and decoration that accumulates state is decoration
 * that eventually has a bug in it.
 *
 * Three draw calls total for the whole thing.
 */

const UP = new THREE.Vector3(0, 1, 0);

/** Deterministic hash, matching the convention in scatter.tsx. */
function hash(n: number, seed: number): number {
  const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ---------------------------------------------------------------- birds

const BIRD_COUNT = 14;
const BIRD_ALTITUDE = 7;

/** A gull: two triangles meeting at the body, flapping about the long axis. */
function birdGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  // Two wings sharing the centre vertex, in the XZ plane pointing along Z.
  const v = new Float32Array([
    0, 0, 0.18, -0.42, 0.02, -0.16, 0, 0, -0.08, 0, 0, 0.18, 0, 0, -0.08, 0.42,
    0.02, -0.16,
  ]);
  g.setAttribute("position", new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

function Birds() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => birdGeometry(), []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0.82, 0.84, 0.9),
        roughness: 0.9,
        side: THREE.DoubleSide,
        flatShading: true,
      }),
    []
  );

  /** Each bird gets its own great circle: a random axis and a phase. */
  const orbits = useMemo(
    () =>
      Array.from({ length: BIRD_COUNT }, (_, i) => {
        // Uniform-ish axis from the hash, then an orthonormal pair spanning
        // the circle's plane.
        const z = hash(i, 1) * 2 - 1;
        const t = hash(i, 2) * Math.PI * 2;
        const r = Math.sqrt(Math.max(0, 1 - z * z));
        const axis = new THREE.Vector3(Math.cos(t) * r, z, Math.sin(t) * r).normalize();
        const a = new THREE.Vector3();
        // Any vector not parallel to the axis works as the seed for the pair.
        a.set(0, 1, 0);
        if (Math.abs(axis.y) > 0.9) a.set(1, 0, 0);
        const u = new THREE.Vector3().crossVectors(axis, a).normalize();
        const v = new THREE.Vector3().crossVectors(axis, u);
        return {
          u,
          v,
          phase: hash(i, 3) * Math.PI * 2,
          speed: 0.055 + hash(i, 4) * 0.045,
          altitude: BIRD_ALTITUDE + hash(i, 5) * 3,
        };
      }),
    []
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );

  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const t = state.clock.elapsedTime;

    const pos = new THREE.Vector3();
    const fwd = new THREE.Vector3();
    const up = new THREE.Vector3();
    const right = new THREE.Vector3();
    const basis = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const mat = new THREE.Matrix4();

    for (let i = 0; i < BIRD_COUNT; i++) {
      const o = orbits[i];
      const a = o.phase + t * o.speed;
      // Point on the great circle, and its derivative for the heading.
      up.copy(o.u).multiplyScalar(Math.cos(a)).addScaledVector(o.v, Math.sin(a));
      fwd.copy(o.u).multiplyScalar(-Math.sin(a)).addScaledVector(o.v, Math.cos(a));
      pos.copy(up).multiplyScalar(RADIUS + o.altitude);

      right.crossVectors(fwd, up).normalize();
      basis.makeBasis(right, up, fwd);
      quat.setFromRotationMatrix(basis);

      // Flap by squashing the wingspan: cheaper than posing two wings and
      // reads the same at this size.
      const flap = 0.62 + Math.abs(Math.sin(t * 6 + i * 1.7)) * 0.38;
      scale.set(flap, 1, 1);
      m.setMatrixAt(i, mat.compose(pos, quat, scale));
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, BIRD_COUNT]}
      frustumCulled={false}
    />
  );
}

// ---------------------------------------------------------------- fish

const FISH_COUNT = 18;
/** Seconds between a fish's leaps. */
const FISH_PERIOD = 7;

/**
 * Fish breaching in the shallows.
 *
 * Each one has a fixed spot and leaps on its own cycle: a short parabola above
 * the water surface, hidden the rest of the time. Spots are picked around each
 * island at the shoreline weight the water shell fades at, so the fish are
 * always in visibly shallow water rather than mid-ocean.
 */
function Fish() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => {
    const g = new THREE.ConeGeometry(0.11, 0.42, 5);
    g.rotateX(Math.PI / 2);
    return g;
  }, []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0.5, 0.62, 0.72),
        roughness: 0.35,
        metalness: 0.25,
        flatShading: true,
      }),
    []
  );

  const spots = useMemo(() => {
    const ids = ["shore", "ember", "frost", "dune", "verdant"] as const;
    const out: { dir: THREE.Vector3; offset: number }[] = [];
    for (let i = 0; i < FISH_COUNT; i++) {
      const d = DISTRICT_BY_ID[ids[i % ids.length]];
      // Just outside the core, in the shallows band the water shell paints.
      const arc = d.coreRadius + d.falloff * (0.55 + hash(i, 11) * 0.5);
      const p = placeOnSphere(d.centre, hash(i, 12) * Math.PI * 2, arc);
      out.push({
        dir: new THREE.Vector3(p.x, p.y, p.z),
        offset: hash(i, 13) * FISH_PERIOD,
      });
    }
    return out;
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );

  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const t = state.clock.elapsedTime;

    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const mat = new THREE.Matrix4();

    for (let i = 0; i < FISH_COUNT; i++) {
      const s = spots[i];
      // 0..1 within this fish's cycle; only the first fifth is a leap.
      const u = ((t + s.offset) % FISH_PERIOD) / FISH_PERIOD;
      const leap = u < 0.2 ? u / 0.2 : -1;
      if (leap < 0) {
        // Parked below the seabed rather than toggled invisible: one matrix
        // write either way, and no per-instance visibility to track.
        scale.setScalar(0.0001);
        m.setMatrixAt(i, mat.compose(pos.set(0, 0, 0), quat, scale));
        continue;
      }
      // Parabola: out of the water and back.
      const h = Math.sin(leap * Math.PI) * 0.85;
      pos.copy(s.dir).multiplyScalar(RADIUS + WATER_HEIGHT + h - 0.15);
      // Nose up on the way out, down on the way back in.
      quat.setFromUnitVectors(UP, s.dir);
      quat.multiply(
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(1, 0, 0),
          Math.PI / 2 - (leap - 0.5) * 2.2
        )
      );
      scale.setScalar(1);
      m.setMatrixAt(i, mat.compose(pos, quat, scale));
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, FISH_COUNT]}
      frustumCulled={false}
    />
  );
}

// ---------------------------------------------------------------- fireflies

const FIREFLY_COUNT = 40;

/**
 * Fireflies over the jungle, at night only.
 *
 * "Night" is local, as everywhere else on this planet: they check the sun
 * against their own island, so they come out as the terminator crosses the
 * jungle and not on a global timer.
 */
function Fireflies() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.SphereGeometry(0.075, 6, 5), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.85, 1, 0.5),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  );

  const spots = useMemo(() => {
    const d = DISTRICT_BY_ID.verdant;
    return Array.from({ length: FIREFLY_COUNT }, (_, i) => {
      const p = placeOnSphere(
        d.centre,
        hash(i, 21) * Math.PI * 2,
        hash(i, 22) * d.coreRadius * 0.95
      );
      return {
        dir: new THREE.Vector3(p.x, p.y, p.z),
        height: 0.5 + hash(i, 23) * 1.6,
        drift: hash(i, 24) * Math.PI * 2,
        rate: 0.5 + hash(i, 25) * 0.8,
      };
    });
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );

  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const t = state.clock.elapsedTime;

    const sun = sunDirection(dayPhase(t));
    const c = DISTRICT_BY_ID.verdant.centre;
    const dark = darknessAt(c.x * sun.x + c.y * sun.y + c.z * sun.z);
    material.opacity = dark * 0.9;
    m.visible = dark > 0.02;
    if (!m.visible) return;

    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const mat = new THREE.Matrix4();

    for (let i = 0; i < FIREFLY_COUNT; i++) {
      const s = spots[i];
      const bob = Math.sin(t * s.rate + s.drift) * 0.35;
      pos.copy(s.dir).multiplyScalar(RADIUS + s.height + bob);
      // Individual blink, so the swarm is not one pulsing block.
      const blink = 0.35 + Math.abs(Math.sin(t * 1.9 + i * 2.9)) * 0.65;
      scale.setScalar(blink);
      m.setMatrixAt(i, mat.compose(pos, quat, scale));
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, FIREFLY_COUNT]}
      frustumCulled={false}
      visible={false}
    />
  );
}

export function Wildlife() {
  return (
    <>
      <Birds />
      <Fish />
      <Fireflies />
    </>
  );
}

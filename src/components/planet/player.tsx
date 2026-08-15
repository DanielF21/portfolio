"use client";

import { useFrame, useThree } from "@react-three/fiber";
// Subpath import, not `import { easing } from "maath"`: the barrel would pull
// random/geometry/matrix/etc into the chunk for no reason.
import { damp3, dampQ } from "maath/easing";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import {
  CAM_DISTANCE,
  CAM_FOV,
  CAM_FOV_TELESCOPE,
  CAM_HEAD_OFFSET,
  CAM_HEIGHT,
  CAM_JUMP_FOLLOW,
  CAM_LOOK_SMOOTH,
  CAM_MIN_CLEARANCE,
  CAM_PITCH_DEFAULT,
  CAM_PITCH_MAX,
  CAM_PITCH_MIN,
  CAM_PITCH_SENS,
  CAM_POS_SMOOTH,
  CAM_RECENTER_DELAY_MS,
  CAM_RECENTER_MAX_RATE,
  CAM_RECENTER_TAU,
  CAM_ROT_SMOOTH,
  CAM_UP_SMOOTH,
  CAM_YAW_SENS,
  CAM_ZOOM_SMOOTH,
  CHAR_HALF_HEIGHT,
  GRAVITY,
  JUMP_VELOCITY,
  MAX_DELTA,
  MOVE_ACCEL_TAU,
  ORIENT_SMOOTH,
  RADIUS,
  SPRINT_MULT,
  SWIM_SPEED_MULT,
  SWIM_SUBMERGE,
  TRAMPOLINE_BOUNCE,
  TRAMPOLINE_RADIUS,
  TRAMPOLINE_REACH,
  TRAMPOLINE_RESTITUTION,
  TURN_SPEED,
  WALK_SPEED,
  WATER_EDGE_WEIGHT,
  WATER_HEIGHT,
} from "@/lib/planet/config";
import { maxDistrictWeight } from "@/lib/planet/districts";
import { compass } from "@/lib/planet/compass";
import {
  bounceSound,
  chessClack,
  footstep,
  landThud,
  millCreak,
  pianoNote,
  rocketLaunchSound,
  setAudioState,
  snowThrow,
  splash,
  tickAmbience,
} from "@/lib/planet/audio";
import { darknessAt, dayPhase, sunDirection } from "@/lib/planet/daylight";
import { clearMovement, input } from "@/lib/planet/input";
import { HELD_SNOWBALL_ID, INTERACTABLES } from "@/lib/planet/interactables";
import { moveKnight, resetKnight } from "@/lib/planet/knight";
import { resetMill, toggleMill } from "@/lib/planet/mill";
import { resetPiano, strikePiano } from "@/lib/planet/piano";
import {
  pickUpSnowball,
  snowballs,
  throwSnowball,
} from "@/lib/planet/snowballs";
import { registerHit } from "@/lib/planet/targets";
import {
  pickTarget,
  resetTelescope,
  telescope,
  telescopeAim,
  telescopeTargetName,
} from "@/lib/planet/telescope";
import { angularRadius } from "./colliders";
import { SHIP } from "@/lib/planet/ship";
import {
  alongHull,
  liveShipFrame,
  sailShip,
  shipDeckHeightAt,
  shipState,
} from "@/lib/planet/ship-state";
import { launchRocket, rocketBusy, rocketShake } from "@/lib/planet/setpieces";
import {
  stamina,
  STAMINA_MAX_S,
  STAMINA_REGEN_DELAY_S,
  STAMINA_REGEN_PER_S,
  STAMINA_UNLOCK,
} from "@/lib/planet/stamina";
import { usePlanetStore } from "@/lib/planet/store";
import type { PlanetMarker, SpawnPoint } from "@/lib/planet/types";

import type { Collider, Platform } from "./colliders";
import { updateCompass } from "./compass-tracker";

/** Project `v` onto the tangent plane at `n` and renormalize. Kills the
 *  micro-radian drift that accumulates over thousands of quaternion applies. */
function orthonormalize(v: THREE.Vector3, n: THREE.Vector3) {
  v.addScaledVector(n, -v.dot(n));
  const len = v.length();
  if (len > 1e-6) v.divideScalar(len);
}

/**
 * Rotate the tangent vector `from` toward the tangent vector `to`, by at most
 * `maxStep` radians. Both must already be tangent to `up`.
 */
function turnToward(
  from: THREE.Vector3,
  to: THREE.Vector3,
  up: THREE.Vector3,
  maxStep: number,
  axisScratch: THREE.Vector3
) {
  const d = THREE.MathUtils.clamp(from.dot(to), -1, 1);
  const angle = Math.acos(d);
  if (angle < 1e-4) return;

  axisScratch.crossVectors(from, to);
  if (axisScratch.lengthSq() < 1e-10) {
    // Exactly antiparallel: the cross product is degenerate, so spin about the
    // surface normal instead.
    axisScratch.copy(up);
  } else {
    axisScratch.normalize();
  }

  from.applyAxisAngle(axisScratch, Math.min(angle, maxStep));
  orthonormalize(from, up);
}

/**
 * Like `turnToward`, but the step is PROPORTIONAL to the remaining error
 * rather than a fixed slew, with a hard ceiling on angular rate.
 *
 * This distinction is the difference between a camera that whips and one that
 * settles. A constant-rate slew arrives at its target still travelling at full
 * speed and then stops dead: the angular velocity is discontinuous, which the
 * eye reads as a snap. An exponential approach decays into the target, so the
 * motion has no hard edge at either end. The rate cap then guarantees that
 * even a 180-degree error cannot produce a fast sweep.
 */
function turnTowardDamped(
  from: THREE.Vector3,
  to: THREE.Vector3,
  up: THREE.Vector3,
  tau: number,
  maxRate: number,
  dt: number,
  axisScratch: THREE.Vector3
) {
  const d = THREE.MathUtils.clamp(from.dot(to), -1, 1);
  const angle = Math.acos(d);
  if (angle < 1e-4) return;

  const step = Math.min(angle * (1 - Math.exp(-dt / tau)), maxRate * dt);
  if (step < 1e-6) return;

  axisScratch.crossVectors(from, to);
  if (axisScratch.lengthSq() < 1e-10) {
    axisScratch.copy(up);
  } else {
    axisScratch.normalize();
  }

  from.applyAxisAngle(axisScratch, step);
  orthonormalize(from, up);
}

/** Passes over the collider list per frame. Two is enough to settle a wedge
 *  between two props; more spends time on a case that barely occurs. */
const COLLISION_ITERATIONS = 2;

interface Props {
  markers: readonly PlanetMarker[];
  spawn: SpawnPoint;
  colliders: readonly Collider[];
  platforms: readonly Platform[];
}

export function Player({ markers, spawn, colliders, platforms }: Props) {
  const group = useRef<THREE.Group>(null);
  /**
   * Cosmetic rig, nested inside the character group.
   *
   * Every bit of animation below (bob, lean, squash) is applied HERE and never
   * to `group`, whose transform is built from the orthonormal frame and is
   * load-bearing for the walk. Keeping the two separate means no amount of
   * animation tuning can perturb the maths that stops the character flipping
   * out at a pole.
   */
  const rig = useRef<THREE.Group>(null);
  /** The snowball in hand, shown and hidden from the frame loop. */
  const heldSnowball = useRef<THREE.Mesh>(null);
  /** The contact shadow lives outside the character group so a jump lifts the
   *  character without lifting its shadow off the ground. */
  const shadowGroup = useRef<THREE.Group>(null);
  const shadowMesh = useRef<THREE.Mesh>(null);
  /** Wake ring, pinned to the sea surface while wading. */
  const rippleGroup = useRef<THREE.Group>(null);
  const rippleMesh = useRef<THREE.Mesh>(null);
  const camera = useThree((s) => s.camera);

  const markerDirs = useMemo(
    () =>
      markers.map((m) =>
        new THREE.Vector3(m.dir.x, m.dir.y, m.dir.z).normalize()
      ),
    [markers]
  );

  /** The rocket's direction, for scaling the launch shake by distance. */
  const rocketDir = useMemo(() => {
    const it = INTERACTABLES.find((i) => i.id === "rocket");
    if (!it) return null;
    const d = it.dirAt(RADIUS);
    return new THREE.Vector3(d.x, d.y, d.z);
  }, []);

  /** The trampoline's, for deciding whether a landing is a landing or a
   *  takeoff. Static: unlike the ship, it stays where it was put. */
  const trampolineDir = useMemo(() => {
    const it = INTERACTABLES.find((i) => i.id === "trampoline");
    if (!it) return null;
    const d = it.dirAt(RADIUS);
    return new THREE.Vector3(d.x, d.y, d.z);
  }, []);

  /**
   * All persistent simulation state. Vectors are allocated once; nothing in
   * the frame loop allocates.
   */
  const st = useMemo(() => {
    const posDir = new THREE.Vector3(spawn.x, spawn.y, spawn.z).normalize();

    // Authored facing when the spawn names one, so the opening shot points at
    // something. Falling back to an arbitrary tangent aims the camera wherever
    // the cross product lands, which put the world's largest landmark half off
    // the left edge of the first frame.
    let faceDir: THREE.Vector3;
    if (spawn.facing) {
      faceDir = new THREE.Vector3(spawn.facing.x, spawn.facing.y, spawn.facing.z);
      orthonormalize(faceDir, posDir);
    } else {
      const ref =
        Math.abs(posDir.y) > 0.99
          ? new THREE.Vector3(1, 0, 0)
          : new THREE.Vector3(0, 1, 0);
      faceDir = new THREE.Vector3().crossVectors(ref, posDir).normalize();
    }

    return {
      posDir,
      faceDir,
      camDir: faceDir.clone(),
      /** The camera frame the current key-hold was latched against. Movement
       *  direction derives from THIS, not the live camDir: the recenter below
       *  steers camDir while keys are held, and deriving input from a moving
       *  camera turns held strafe keys into circles. Parallel-transported
       *  with the rest of the frame, so a held key is a straight line. */
      moveFrame: faceDir.clone(),
      /** The unit direction currently being travelled, kept alive across key
       *  release so the speed ramp has something to decelerate along.
       *  Parallel-transported with the rest of the frame. */
      moveDir: faceDir.clone(),
      /** Ramped walking speed, units/s. Damped toward the target so starting
       *  and stopping have weight instead of being a step function. */
      speedCur: 0,
      lastMx: 0,
      lastMy: 0,
      wasMoving: false,
      pitch: CAM_PITCH_DEFAULT,
      /** Smoothed camera zoom factor, damped toward input.zoom. */
      zoom: 1,
      smoothedUp: posDir.clone(),
      lookTarget: new THREE.Vector3(),
      nearbyId: null as string | null,
      warmedUp: false,

      /** Height above the standing altitude, in world units. Purely radial and
       *  never negative; the surface walk below is untouched by it. */
      alt: 0,
      /** Radial velocity, units/s. */
      vAlt: 0,

      /** How far the character is currently sunk into the sea, world units.
       *  Damped rather than switched, so wading in and out is a wade. */
      submerge: 0,

      /** Walk-cycle phase, advanced by DISTANCE TRAVELLED rather than by wall
       *  clock. That is the whole difference between feet that stay planted at
       *  every speed and feet that skate: at 1.9x sprint speed a clock-driven
       *  cycle would take the same number of steps to cover twice the ground. */
      stridePhase: 0,
      /** Smoothed roll into a turn, radians. */
      lean: 0,
      /** Positive squashes, negative stretches. Spikes on landing and takeoff
       *  and decays; nothing else drives it. */
      squash: 0,
      /** Previous frame's facing, for measuring turn rate. */
      lastFace: faceDir.clone(),
      wasGrounded: true,
      /** Radial speed at the moment of the last touchdown, units/s. */
      impact: 0,
      /** Clock time at which stamina may start recovering again. */
      regenAt: 0,
      /** Height of the deck currently underfoot, world units above RADIUS.
       *  Damped, so stepping onto a bridge is a step and not a teleport. */
      deck: 0,
      /** Which half-stride the walk cycle was in last frame. A footfall is the
       *  moment this changes, which means steps are emitted per unit of GROUND
       *  COVERED rather than per unit of time and stay in sync at any speed. */
      lastStep: 0,
      wasOverWater: false,

      // scratch
      up: new THREE.Vector3(),
      /** Physical right, = cross(forward, up). Used for strafe input. */
      right: new THREE.Vector3(),
      /** The x column of the character's basis matrix, = cross(up, forward).
       *  Opposite sign to `right`; see the note at the makeBasis call. */
      basisX: new THREE.Vector3(),
      wish: new THREE.Vector3(),
      axis: new THREE.Vector3(),
      spin: new THREE.Quaternion(),
      charPos: new THREE.Vector3(),
      /** Where the camera orbits around. Follows the jump only partially. */
      camAnchor: new THREE.Vector3(),
      desired: new THREE.Vector3(),
      back: new THREE.Vector3(),
      lookAim: new THREE.Vector3(),
      dirToTarget: new THREE.Vector3(),
      camRight: new THREE.Vector3(),
      camUp: new THREE.Vector3(),
      /** Current camera shake offset, kept so it can be removed again before
       *  the next frame's damping rather than accumulating into it. */
      shake: new THREE.Vector3(),
      /** Collision scratch. */
      hitTan: new THREE.Vector3(),
      hitTarget: new THREE.Vector3(),
      hitAxis: new THREE.Vector3(),
      hitSpin: new THREE.Quaternion(),
      /** Where the telescope is pointing, in world space. */
      skyAim: new THREE.Vector3(),
      /** Camera forward, for the dev readout only. */
      camFwd: new THREE.Vector3(),
      /** Ship-riding scratch. */
      rideAxis: new THREE.Vector3(),
      rideTarget: new THREE.Vector3(),
      rideSpin: new THREE.Quaternion(),
      /** True while the deck underfoot is the ship's, so the player is carried
       *  by it. Read one frame late, which at 4 units/s is 7cm. */
      aboardShip: false,
      camBack: new THREE.Vector3(),
      basis: new THREE.Matrix4(),
      qTarget: new THREE.Quaternion(),
    };
  }, [spawn]);

  // Dev-only teleport, so pole crossings and edge cases can be tested
  // deterministically instead of by walking there.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const w = window as unknown as {
      __planetSetPos?: (
        x: number,
        y: number,
        z: number,
        face?: [number, number, number]
      ) => string;
    };
    w.__planetSetPos = (x, y, z, face) => {
      st.posDir.set(x, y, z).normalize();
      if (face) {
        st.faceDir.set(face[0], face[1], face[2]);
      } else {
        const ref =
          Math.abs(st.posDir.y) > 0.99
            ? new THREE.Vector3(1, 0, 0)
            : new THREE.Vector3(0, 1, 0);
        st.faceDir.crossVectors(ref, st.posDir);
      }
      orthonormalize(st.faceDir, st.posDir);
      st.camDir.copy(st.faceDir);
      st.moveFrame.copy(st.faceDir);
      st.moveDir.copy(st.faceDir);
      st.speedCur = 0;
      st.wasMoving = false;
      st.alt = 0;
      st.vAlt = 0;
      st.warmedUp = false;
      return "ok";
    };
    return () => {
      delete w.__planetSetPos;
      // Also drop the per-frame readout, or a stale snapshot from the last
      // session lingers after the modal closes and reads as a live scene.
      delete (window as unknown as { __planet?: unknown }).__planet;
    };
  }, [st]);

  // The store outlives this component, and `nearbyId` is mirrored in `st` so
  // the frame loop can compare without a store read. A remount therefore starts
  // with the two disagreeing: `st.nearbyId` is null and the store still holds
  // whatever the last session was standing next to, and because the loop only
  // writes on a CHANGE, nothing ever corrects it. The HUD then advertises a
  // prompt for something on another island.
  useEffect(() => {
    usePlanetStore.getState().setNearby(null);
  }, []);

  // Every set piece that holds state between frames lives in a module, which
  // outlives the stage. Cleared on the way in as well as on the way out, so a
  // session that ended in a crash cannot hand the next one a mill already
  // turning or an eye still at the eyepiece.
  useEffect(() => {
    const clear = () => {
      resetPiano();
      resetKnight();
      resetMill();
      resetTelescope();
    };
    clear();
    return clear;
  }, []);

  // Held keys must not survive a modal opening.
  useEffect(() => {
    const unsub = usePlanetStore.subscribe((s, prev) => {
      if (s.activeId !== null && prev.activeId === null) clearMovement();
    });
    return unsub;
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, MAX_DELTA);
    const store = usePlanetStore.getState();
    const modalOpen = store.activeId !== null;

    const {
      posDir,
      faceDir,
      camDir,
      up,
      wish,
      axis,
      spin,
      charPos,
      camAnchor,
      desired,
      back,
      lookAim,
      dirToTarget,
      camRight,
      camUp,
      camBack,
      basis,
      qTarget,
      smoothedUp,
      lookTarget,
    } = st;

    up.copy(posDir);

    /**
     * Carry the entire frame through a rotation of the sphere.
     *
     * THE ONE WAY THIS FILE IS ALLOWED TO MOVE THE PLAYER. Every vector the
     * simulation keeps is tangent to the surface at `posDir`, so moving the
     * position without moving them leaves them tangent to somewhere the player
     * no longer is, which is how the invariant this file guards (posDir dot
     * faceDir stays 0 forever) rots one collision at a time. Rotating all of
     * them together is parallel transport, and keeps every vector tangent by
     * construction.
     */
    const transportFrame = (q: THREE.Quaternion) => {
      posDir.applyQuaternion(q).normalize();
      faceDir.applyQuaternion(q);
      camDir.applyQuaternion(q);
      st.moveFrame.applyQuaternion(q);
      st.moveDir.applyQuaternion(q);

      up.copy(posDir);
      orthonormalize(faceDir, up);
      orthonormalize(camDir, up);
      orthonormalize(st.moveFrame, up);
      orthonormalize(st.moveDir, up);
    };

    // ---------------------------------------------------------- look input
    if (!modalOpen) {
      if (input.lookDX !== 0) {
        camDir.applyAxisAngle(up, -input.lookDX * CAM_YAW_SENS);
      }
      if (input.lookDY !== 0) {
        st.pitch = THREE.MathUtils.clamp(
          st.pitch - input.lookDY * CAM_PITCH_SENS,
          CAM_PITCH_MIN,
          CAM_PITCH_MAX
        );
      }
    }
    input.lookDX = 0;
    input.lookDY = 0;
    orthonormalize(camDir, up);

    // ------------------------------------------------------------- the ship
    //
    // Sailed every frame whether or not anyone has the wheel, because a ship
    // let go of still has way on it and has to coast to a stop somewhere.
    // A/D put the helm over, W is the throttle.
    const helmed = shipState.helmed && !modalOpen;
    sailShip(
      dt,
      helmed ? -input.moveX : 0,
      helmed ? input.moveY : 0,
      RADIUS
    );

    // ---------------------------------------------------------- movement
    //
    // Both the wheel and the eyepiece take the movement keys: you have hold of
    // something with both hands in each case.
    const telescoped = telescope.at && !modalOpen;
    const held = modalOpen || helmed || telescoped;
    const mx = held ? 0 : input.moveX;
    const my = held ? 0 : input.moveY;
    const moving = mx !== 0 || my !== 0;

    // ---------------------------------------------------------------- stamina
    //
    // Only spent while actually sprinting somewhere: holding shift standing
    // still costs nothing, because a meter that drains when you are not moving
    // teaches players to fidget with the key rather than to plan a route.
    const wantsSprint = !modalOpen && input.sprint;
    if (stamina.locked && stamina.value >= STAMINA_UNLOCK) stamina.locked = false;
    const sprinting = wantsSprint && moving && !stamina.locked;

    if (sprinting) {
      stamina.value -= dt / STAMINA_MAX_S;
      st.regenAt = state.clock.elapsedTime + STAMINA_REGEN_DELAY_S;
      if (stamina.value <= 0) {
        stamina.value = 0;
        stamina.locked = true;
      }
    } else if (state.clock.elapsedTime >= st.regenAt) {
      stamina.value = Math.min(
        1,
        stamina.value + (dt * STAMINA_REGEN_PER_S) / STAMINA_MAX_S
      );
    }
    stamina.draining = sprinting;

    // Water is read off the same island-weight field that colours the ground
    // and fades the ocean shell, so the point where the character starts
    // wading is exactly the point where the water is drawn. No second source
    // of truth for where the coastline is.
    const landWeight = maxDistrictWeight(posDir);
    const overWater = landWeight < WATER_EDGE_WEIGHT;
    // BEING OVER WATER IS NOT THE SAME AS BEING IN IT. Wading costs speed;
    // sailing over a channel mid-jump must not, or a leap from one shore
    // toward another mysteriously stalls halfway across exactly when the
    // player needs the distance. Nor does standing on a bridge or a deck: the
    // point of building a crossing is that you cross it at walking pace.
    // `st.alt` and `st.deck` are both the previous frame's here, one frame
    // stale and imperceptible.
    const inWater = overWater && st.alt === 0 && st.deck <= 0.05;
    const speed =
      WALK_SPEED * (sprinting ? SPRINT_MULT : 1) * (inWater ? SWIM_SPEED_MULT : 1);

    // A/D are PURE STRAFE. They used to also yaw the input frame and the
    // camera in lockstep at a constant rate, which meant one key press drove
    // four coupled state variables at once: it translated you sideways, spun
    // the camera indefinitely, spun the frame that "sideways" was measured
    // against, and left the character's facing 90 degrees off the camera for
    // the auto-recenter to then yank closed. Holding D for a second and a half
    // rotated the world about 100 degrees. Movement keys no longer touch the
    // camera at all; see CAM_RECENTER_* in config for the principle.
    if (moving) {
      // Latch the input frame when movement starts or the key mix changes.
      // While the same keys stay held, the frame is only parallel-transported
      // below, never re-read from the live camera, so the path is an exact
      // great circle no matter what the camera or the character's turn
      // animation are doing.
      if (!st.wasMoving || mx !== st.lastMx || my !== st.lastMy) {
        st.moveFrame.copy(camDir);
      }

      // Right-handed check: with up=+Y and frame=-Z, cross(frame, up) = +X.
      st.right.crossVectors(st.moveFrame, up).normalize();
      wish
        .set(0, 0, 0)
        .addScaledVector(st.moveFrame, my)
        .addScaledVector(st.right, mx);
      // Normalizing is what stops diagonal movement being 1.41x faster.
      if (wish.lengthSq() > 1e-8) {
        wish.normalize();
        st.moveDir.copy(wish);
      }
    }
    st.wasMoving = moving;
    st.lastMx = mx;
    st.lastMy = my;

    // Ramp toward the target speed rather than stepping to it. Runs every
    // frame, including after release, which is why moveDir has to survive the
    // key going up: deceleration needs a direction to decelerate along.
    const targetSpeed = moving ? speed : 0;
    st.speedCur +=
      (targetSpeed - st.speedCur) * (1 - Math.exp(-dt / MOVE_ACCEL_TAU));
    // Cut the exponential tail. Below this the character is crawling at 5mm/s
    // and would never formally reach rest; the arc discarded is ~0.005 units.
    if (!moving && st.speedCur < 0.05) st.speedCur = 0;

    if (st.speedCur > 0) {
      // A step along the surface is exactly a rotation of the whole frame
      // about cross(up, moveDir) by arcLength / RADIUS. Exact, uniform speed
      // everywhere, and no coordinate singularity at the poles.
      axis.crossVectors(up, st.moveDir);
      if (axis.lengthSq() > 1e-8) {
        axis.normalize();
        spin.setFromAxisAngle(axis, (st.speedCur * dt) / RADIUS);
        transportFrame(spin);
      }

      // Purely cosmetic from here on: faceDir drives the rendered model's
      // orientation, never the movement direction.
      turnToward(faceDir, st.moveDir, up, TURN_SPEED * dt, axis);
    }

    // ------------------------------------------------------------- collision
    //
    // Runs after the walk and before anything reads the position.
    //
    // THE PUSHOUT IS APPLIED AS A ROTATION OF THE WHOLE FRAME, exactly the way
    // the walk step above is. That is the entire trick, and the reason this is
    // ~20 lines rather than a physics engine. Displacing posDir on its own
    // would leave faceDir, camDir, moveFrame and moveDir tangent to where the
    // player USED to be, breaking the invariant this file guards (posDir dot
    // faceDir must stay 0 forever) and slowly corrupting the frame with every
    // brush against a tree. Treating the correction as parallel transport
    // keeps every vector tangent by construction.
    //
    // Sliding falls out of it for free: only the component of motion into the
    // prop is removed, so walking into a wall at an angle carries you along it
    // rather than stopping you dead.
    for (let iter = 0; iter < COLLISION_ITERATIONS; iter++) {
      let hit = false;

      for (let i = 0; i < colliders.length; i++) {
        const c = colliders[i];
        const dot = posDir.x * c.x + posDir.y * c.y + posDir.z * c.z;
        // Outside the cap, or jumping over it.
        if (dot <= c.cosR || st.alt > c.height) continue;

        // Tangent at the collider centre, pointing at the player.
        st.hitTan.set(
          posDir.x - c.x * dot,
          posDir.y - c.y * dot,
          posDir.z - c.z * dot
        );
        const len = st.hitTan.length();
        if (len > 1e-6) {
          st.hitTan.divideScalar(len);
        } else {
          // Dead centre: no "away" direction exists, so leave along the way
          // the character is already facing.
          st.hitTan.copy(faceDir);
        }

        // Nearest point on the cap's boundary circle.
        st.hitTarget
          .set(c.x * c.cosR, c.y * c.cosR, c.z * c.cosR)
          .addScaledVector(st.hitTan, c.sinR)
          .normalize();

        st.hitAxis.crossVectors(posDir, st.hitTarget);
        if (st.hitAxis.lengthSq() < 1e-12) continue;
        const step = Math.acos(
          THREE.MathUtils.clamp(posDir.dot(st.hitTarget), -1, 1)
        );
        if (step < 1e-7) continue;
        st.hitAxis.normalize();
        st.hitSpin.setFromAxisAngle(st.hitAxis, step);
        transportFrame(st.hitSpin);
        hit = true;
      }

      if (!hit) break;
    }

    // ------------------------------------------------------------ ship rider
    //
    // A deck that sails out from under you is worse than no deck at all, so
    // anything standing on the ship gets the ship's own rigid motion applied
    // to it. Same parallel-transport rule as the walk and the pushout: rotate
    // the WHOLE frame, never displace the position on its own.
    //
    // Two rotations, in the order sailShip performed them: the yaw about the
    // point the ship was standing on, then the swing forward along its new
    // heading. Applied to a point on the deck, they land it exactly where the
    // planking under it went.
    if (st.aboardShip || helmed) {
      if (shipState.yawAngle !== 0) {
        st.rideAxis.set(
          shipState.yawAxis.x,
          shipState.yawAxis.y,
          shipState.yawAxis.z
        );
        st.rideSpin.setFromAxisAngle(st.rideAxis, shipState.yawAngle);
        transportFrame(st.rideSpin);
      }
      if (shipState.stepAngle !== 0) {
        st.rideAxis.set(
          shipState.stepAxis.x,
          shipState.stepAxis.y,
          shipState.stepAxis.z
        );
        st.rideSpin.setFromAxisAngle(st.rideAxis, shipState.stepAngle);
        transportFrame(st.rideSpin);
      }
    }

    // At the wheel the character is not walking, it is standing at a fixed
    // point of the ship, so it is pinned there outright rather than carried.
    // Rounding error over a long voyage cannot drift the helmsman off the
    // quarterdeck if the position is restated from the ship every frame.
    if (helmed) {
      const h = alongHull(SHIP.helmOffset, RADIUS);
      st.rideTarget.set(h.x, h.y, h.z);
      st.rideAxis.crossVectors(posDir, st.rideTarget);
      const step = Math.acos(
        THREE.MathUtils.clamp(posDir.dot(st.rideTarget), -1, 1)
      );
      if (st.rideAxis.lengthSq() > 1e-14 && step > 1e-9) {
        st.rideAxis.normalize();
        st.rideSpin.setFromAxisAngle(st.rideAxis, step);
        transportFrame(st.rideSpin);
      }
      // Face the way the ship is going, so leaving the wheel leaves you
      // pointing forward rather than wherever you boarded facing.
      const f = liveShipFrame();
      st.moveDir.set(f.x.x, f.x.y, f.x.z);
      orthonormalize(st.moveDir, up);
      turnToward(faceDir, st.moveDir, up, TURN_SPEED * dt, axis);
      st.speedCur = 0;
    }

    // Weak forward-only camera assist. Deliberately NOT active during a
    // strafe: mid-strafe the character faces 90 degrees off the camera, and
    // aiming the camera at that facing is precisely the yank that read as a
    // whip. Pure backpedal is excluded for the same reason at 180 degrees;
    // running toward the lens with the camera planted is the correct
    // screen-relative behaviour, not a bug to correct.
    //
    // In practice the error here is already near zero, because the input frame
    // was latched off this same camera. It only does real work after a manual
    // drag, where it eases the camera back behind you over a second or two.
    if (
      moving &&
      my > 0 &&
      mx === 0 &&
      performance.now() - input.lastDragAt > CAM_RECENTER_DELAY_MS
    ) {
      turnTowardDamped(
        camDir,
        faceDir,
        up,
        CAM_RECENTER_TAU,
        CAM_RECENTER_MAX_RATE,
        dt,
        axis
      );
    }

    // ------------------------------------------------------------------ jump
    //
    // Entirely radial. This block must never touch posDir / faceDir / camDir:
    // the surface walk above is what guarantees the pole-crossing invariants,
    // and altitude is orthogonal to it by construction.
    if (input.jump) {
      input.jump = false;
      // No jumping out of the sea. Treading water gives nothing to push off,
      // and a full-height leap from the middle of a channel looked like the
      // character was standing on the surface, which is the exact impression
      // the water is here to remove.
      // Nor at the wheel: the character is pinned to the helm, so a jump there
      // is a hop on the spot that detaches it from the thing it is holding.
      if (!modalOpen && st.alt === 0 && !inWater && !helmed) {
        st.vAlt = JUMP_VELOCITY;
        st.squash = -0.22; // stretch out of the crouch
      }
    }
    if (st.alt > 0 || st.vAlt !== 0) {
      st.vAlt -= GRAVITY * dt;
      st.alt += st.vAlt * dt;
      if (st.alt <= 0) {
        // Snap to exactly zero rather than letting the integrator leave a
        // residue, or the character slowly sinks over many landings.
        st.alt = 0;
        // Keep the impact speed before discarding it: the landing squash
        // below scales with it, and this is the last frame it exists.
        st.impact = Math.abs(st.vAlt);
        st.vAlt = 0;
      }
    }
    // --------------------------------------------------------------- decking
    //
    // Highest platform underfoot wins, so overlapping caps along a bridge read
    // as one continuous deck rather than a row of bumps. Damped afterwards, so
    // even a hard edge between two platforms is walked rather than teleported.
    let deckTarget = 0;
    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      const dot = posDir.x * p.x + posDir.y * p.y + posDir.z * p.z;
      if (dot <= p.cosR) continue;
      const angle = Math.acos(THREE.MathUtils.clamp(dot, -1, 1));
      // 0 at the cap edge, 1 once fully inside the ramp band.
      const t = Math.min(1, (1 - angle / p.radius) / Math.max(p.ramp, 1e-4));
      const h = p.height * (t * t * (3 - 2 * t));
      if (h > deckTarget) deckTarget = h;
    }
    // The ship's decks, live rather than baked, because they sail.
    const shipDeck = shipDeckHeightAt(posDir, RADIUS);
    st.aboardShip = shipDeck > 0.05;
    if (shipDeck > deckTarget) deckTarget = shipDeck;

    st.deck += (deckTarget - st.deck) * (1 - Math.exp(-dt / 0.12));
    const onDeck = st.deck > 0.05;

    let grounded = st.alt === 0;
    // Landing impact scales with how hard you came down, so a hop off a rock
    // and a fall from the top of a jump do not read identically.
    if (grounded && !st.wasGrounded) {
      // On the trampoline, a landing is a takeoff. Restitution rather than a
      // fixed launch, so a hop gives a hop back and a fall from the apex throws
      // you nearly as high again, and the sequence decays instead of running
      // forever. The floor keeps the last few bounces from being a twitch.
      const onMat =
        trampolineDir !== null &&
        posDir.dot(trampolineDir) > Math.cos(angularRadius(TRAMPOLINE_RADIUS));
      if (onMat && st.impact > 0.6) {
        // No floor under the restitution, deliberately: with one, the last
        // bounce never falls below it and you are left bobbing on the spot
        // forever, never grounded, unable to jump. Left to decay, a jump's
        // worth of impact dies out in about ten bounces.
        st.vAlt = st.impact * TRAMPOLINE_RESTITUTION;
        st.alt = 1e-4;
        st.squash = -0.24;
        grounded = false;
        bounceSound();
      } else {
        st.squash = Math.min(0.36, 0.1 + st.impact * 0.05);
        if (overWater && !onDeck) splash(Math.min(1, st.impact / JUMP_VELOCITY));
        else landThud();
      }
    }
    st.wasGrounded = grounded;

    // Wading in from the beach, or out of it. Only on the way IN: coming ashore
    // is a quiet business.
    if (overWater && !st.wasOverWater && grounded && !onDeck) splash(0.35);
    st.wasOverWater = overWater;

    // ------------------------------------------------------------------ water
    // Damped, not switched: crossing the waterline should be a wade, and the
    // same damping carries the character back up on the far shore.
    //
    // Uses THIS frame's grounded state, not the stale one the speed above
    // used, so the character rises out of the water the instant a jump starts
    // and settles back in on landing rather than being dragged along sunk.
    // Standing on a deck is not wading, however much water is underneath: the
    // whole point of the bridge and the ship is to be dry.
    const wading = overWater && grounded && !onDeck;
    st.submerge +=
      ((wading ? SWIM_SUBMERGE : 0) - st.submerge) * (1 - Math.exp(-dt / 0.28));
    // A gentle bob, so treading water is not perfectly still. Scaled by how
    // submerged the character is, so it does not twitch on dry land.
    const bob =
      Math.sin(state.clock.elapsedTime * 1.7) * 0.035 * (st.submerge / SWIM_SUBMERGE);

    // ---------------------------------------------------- character transform
    charPos
      .copy(posDir)
      .multiplyScalar(
        RADIUS + CHAR_HALF_HEIGHT + st.deck + st.alt - st.submerge + bob
      );

    if (group.current) {
      group.current.position.copy(charPos);
      // makeBasis cannot degenerate here: the two inputs are orthogonal by
      // construction. Object3D.lookAt() would, and that is the classic
      // "character flips out at the pole" bug.
      //
      // NOTE the cross order differs from the input basis above, and both are
      // correct. makeBasis needs x cross y === z, so with y=up and z=faceDir
      // the x column must be cross(up, faceDir) (which points to the
      // character's *left*). The movement code needs the physical right
      // direction, which is cross(forward, up). Same triple, opposite sign,
      // different jobs.
      st.basisX.crossVectors(up, faceDir).normalize();
      basis.makeBasis(st.basisX, up, faceDir);
      qTarget.setFromRotationMatrix(basis);
      if (st.warmedUp) {
        dampQ(group.current.quaternion, qTarget, ORIENT_SMOOTH, dt);
      } else {
        group.current.quaternion.copy(qTarget);
      }

      // ------------------------------------------------------------ animation
      // All of this drives `rig`, never `group`. See the ref's comment.
      if (rig.current) {
        // Stride advances with ground covered, so feet stay planted whether
        // walking or sprinting. STRIDE is the distance per half-cycle.
        const STRIDE = 0.85;
        st.stridePhase += (st.speedCur * dt) / STRIDE;
        const gait = Math.min(1, st.speedCur / WALK_SPEED);
        // Airborne and swimming both suspend the walk cycle: there is nothing
        // to push against in either case.
        const walking = grounded ? gait * (1 - st.submerge / SWIM_SUBMERGE) : 0;

        // Turn rate, measured rather than inferred from input, so it also
        // covers being spun by a collision slide.
        st.axis.crossVectors(st.lastFace, faceDir);
        const signed = st.axis.dot(up);
        const turned = Math.atan2(
          signed,
          THREE.MathUtils.clamp(st.lastFace.dot(faceDir), -1, 1)
        );
        st.lastFace.copy(faceDir);
        const targetLean = THREE.MathUtils.clamp(
          (-turned / Math.max(dt, 1e-4)) * 0.05 * gait,
          -0.35,
          0.35
        );
        st.lean += (targetLean - st.lean) * (1 - Math.exp(-dt / 0.12));

        st.squash += (0 - st.squash) * (1 - Math.exp(-dt / 0.09));

        // A footfall every half stride. Because stridePhase advances with
        // distance, this fires per metre walked and stays locked to the bob at
        // sprint speed, where a timer-driven step would drift out of sync.
        const step = Math.floor(st.stridePhase / Math.PI);
        if (step !== st.lastStep) {
          st.lastStep = step;
          if (walking > 0.15) {
            footstep(onDeck ? "deck" : inWater ? "water" : "land");
          }
        }

        // Two bounces per stride, as if per footfall. There are no feet to
        // match any more, but the cadence is what makes movement read as
        // travelling rather than sliding, so it stays.
        rig.current.position.y = Math.sin(st.stridePhase * 2) * 0.04 * walking;
        rig.current.rotation.z = st.lean;
        // Lean into the direction of travel a little when moving fast.
        rig.current.rotation.x = -0.1 * walking;
        rig.current.scale.set(
          1 + st.squash * 0.45,
          1 - st.squash,
          1 + st.squash * 0.45
        );
      }

      // Shadow stays pinned to the surface and shrinks/fades with altitude,
      // which is what actually sells the height of a jump.
      if (shadowGroup.current) {
        // Follows the deck, so a shadow on a bridge lands on the bridge rather
        // than on the water several units below it.
        shadowGroup.current.position
          .copy(posDir)
          .multiplyScalar(RADIUS + st.deck + 0.02);
        shadowGroup.current.quaternion.copy(group.current.quaternion);
        const shrink = 1 / (1 + st.alt * 0.6);
        shadowGroup.current.scale.setScalar(shrink);
        if (shadowMesh.current) {
          // Fades out as the character submerges: a crisp contact shadow on
          // open water is the tell that the character is standing on it.
          (shadowMesh.current.material as THREE.MeshBasicMaterial).opacity =
            (0.28 / (1 + st.alt * 1.2)) * (1 - st.submerge / SWIM_SUBMERGE);
        }
      }

      // Ripple ring, pinned to the water surface rather than to the character,
      // so it stays flat on the sea while the character bobs through it.
      if (rippleGroup.current) {
        const t = st.submerge / SWIM_SUBMERGE;
        rippleGroup.current.visible = t > 0.02;
        if (rippleGroup.current.visible) {
          rippleGroup.current.position
            .copy(posDir)
            .multiplyScalar(RADIUS + WATER_HEIGHT + 0.01);
          rippleGroup.current.quaternion.copy(group.current.quaternion);
          // Wider wake the faster you move.
          rippleGroup.current.scale.setScalar(
            (0.85 + (st.speedCur / WALK_SPEED) * 0.6) *
              (1 + Math.sin(state.clock.elapsedTime * 2.4) * 0.06)
          );
          if (rippleMesh.current) {
            (rippleMesh.current.material as THREE.MeshBasicMaterial).opacity =
              t * (0.18 + (st.speedCur / WALK_SPEED) * 0.22);
          }
        }
      }
    }

    // ---------------------------------------------------------------- camera
    back.copy(camDir).negate();

    // Scroll zoom scales the whole orbit (distance AND height) so the framing
    // angle survives the zoom; only proximity changes. Damped so a wheel
    // flick glides instead of snapping.
    st.zoom += (input.zoom - st.zoom) * (1 - Math.exp(-dt / CAM_ZOOM_SMOOTH));

    const horiz = Math.cos(st.pitch) * CAM_DISTANCE * st.zoom;
    const vert = (Math.sin(st.pitch) * CAM_DISTANCE + CAM_HEIGHT) * st.zoom;

    // The camera orbits an anchor that only partially follows the jump, while
    // lookAim below tracks the character exactly. The gap is deliberate: a
    // camera that matches the jump 1:1 reads as the planet dropping away and
    // is nauseating, whereas at CAM_JUMP_FOLLOW the camera pitches up to keep
    // the character framed and the leap reads as height.
    camAnchor
      .copy(posDir)
      .multiplyScalar(
        RADIUS + CHAR_HALF_HEIGHT + st.deck + st.alt * CAM_JUMP_FOLLOW
      );

    desired
      .copy(camAnchor)
      .addScaledVector(back, horiz)
      .addScaledVector(up, vert);

    // Never let the camera sink into the planet when pitched down.
    const dist = desired.length();
    const minDist = RADIUS + CAM_MIN_CLEARANCE;
    if (dist < minDist) desired.multiplyScalar(minDist / dist);

    lookAim.copy(charPos).addScaledVector(up, CAM_HEAD_OFFSET);

    // ------------------------------------------------------------- telescope
    //
    // The whole of the effect, and deliberately so: the camera keeps its orbit
    // and its damping, and the only thing that changes is WHAT IT LOOKS AT.
    // Pointing the existing rig at a star is two lines; rewriting the rig to
    // have a first-person mode would be the most dangerous change in the file,
    // since every invariant the walk guarantees is expressed through it.
    //
    // The transition in and out comes free from `CAM_LOOK_SMOOTH`, which damps
    // the look target: the view swings up to the sky and back down to the
    // character over about a second without a line of animation code.
    if (telescoped) {
      const aim = telescopeAim(
        { x: posDir.x, y: posDir.y, z: posDir.z },
        dayPhase(state.clock.elapsedTime)
      );
      st.skyAim.set(aim.x, aim.y, aim.z);
      // FROM THE CAMERA, not from the character. Aiming a point 90 units out
      // from the character's head and then viewing it from 13.5 units behind
      // leaves the line of sight 8.8 degrees off the star, which at a 22 degree
      // field of view is  most of the way to the edge of the frame. Building the
      // look target off the camera's own position removes the parallax rather
      // than diluting it, and `desired` is this frame's camera position, so it
      // is exact and free of the shake still sitting in `camera.position`.
      lookAim.copy(desired).addScaledVector(st.skyAim, 200);
    }
    // Narrowing the field of view is the magnification. Damped, or stepping up
    // to the eyepiece is a jump cut.
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const cam = camera as THREE.PerspectiveCamera;
      const target = telescoped ? CAM_FOV_TELESCOPE : CAM_FOV;
      if (Math.abs(cam.fov - target) > 0.02) {
        cam.fov += (target - cam.fov) * (1 - Math.exp(-dt / 0.32));
        cam.updateProjectionMatrix();
      }
    }

    // Undo last frame's shake before damping. The damping integrates against
    // camera.position, so leaving a random offset in it would let the shake
    // feed back into the smoothed state and the camera would wander off.
    camera.position.sub(st.shake);

    if (!st.warmedUp) {
      camera.position.copy(desired);
      lookTarget.copy(lookAim);
      smoothedUp.copy(up);
    } else {
      damp3(camera.position, desired, CAM_POS_SMOOTH, dt);
      damp3(lookTarget, lookAim, CAM_LOOK_SMOOTH, dt);
      // Up is damped deliberately slower than position: a laggy up reads as
      // weight, a snappy one reads as broken.
      damp3(smoothedUp, up, CAM_UP_SMOOTH, dt);
      smoothedUp.normalize();
    }

    dirToTarget.copy(lookTarget).sub(camera.position);
    if (dirToTarget.lengthSq() > 1e-8) {
      dirToTarget.normalize();
      camRight.crossVectors(dirToTarget, smoothedUp);
      if (camRight.lengthSq() > 1e-8) {
        camRight.normalize();
        camUp.crossVectors(camRight, dirToTarget);
        camBack.copy(dirToTarget).negate();
        basis.makeBasis(camRight, camUp, camBack);
        qTarget.setFromRotationMatrix(basis);
        if (st.warmedUp) {
          dampQ(camera.quaternion, qTarget, CAM_ROT_SMOOTH, dt);
        } else {
          camera.quaternion.copy(qTarget);
        }
      }
    }

    // Ground shake from the launch, scaled by how close you are standing to
    // the pad: felt on the volcanic island, invisible from another one.
    const shakeAmp = rocketShake(state.clock.elapsedTime);
    if (shakeAmp > 0 && rocketDir) {
      const near = Math.max(
        0,
        1 - Math.acos(THREE.MathUtils.clamp(posDir.dot(rocketDir), -1, 1)) / 0.55
      );
      const a = shakeAmp * near * 0.16;
      st.shake.set(
        (Math.random() - 0.5) * a,
        (Math.random() - 0.5) * a,
        (Math.random() - 0.5) * a
      );
    } else {
      st.shake.set(0, 0, 0);
    }
    camera.position.add(st.shake);

    st.warmedUp = true;

    // Runs after the camera transform above, so the indicators are computed
    // from this frame's camera rather than the previous one's.
    updateCompass(markers, markerDirs, posDir, camera, store.visited);

    // ------------------------------------------------------------------ audio
    // Everything the mix needs already exists on this frame, which is the whole
    // reason the audio module takes a push rather than reaching for state of
    // its own: where you are, whether you are wet, and whether it is night
    // WHERE YOU ARE STANDING rather than globally.
    {
      const sun = sunDirection(dayPhase(state.clock.elapsedTime));
      setAudioState({
        land: landWeight,
        night: darknessAt(
          posDir.x * sun.x + posDir.y * sun.y + posDir.z * sun.z
        ),
        inWater,
        speed: st.speedCur / WALK_SPEED,
      });
      tickAmbience(state.clock.elapsedTime);
    }

    if (process.env.NODE_ENV !== "production") {
      // Dev-only inspection hook. `dot(posDir, faceDir)` must stay ~0 forever;
      // if it drifts, the Gram-Schmidt step is broken.
      (window as unknown as { __planet?: unknown }).__planet = {
        posDir: posDir.toArray().map((n) => +n.toFixed(4)),
        faceDir: faceDir.toArray().map((n) => +n.toFixed(4)),
        camDir: camDir.toArray().map((n) => +n.toFixed(4)),
        tangentErr: +posDir.dot(faceDir).toFixed(6),
        radius: +posDir.length().toFixed(6),
        pitch: +st.pitch.toFixed(3),
        camPos: camera.position.toArray().map((n) => +n.toFixed(2)),
        charPos: charPos.toArray().map((n) => +n.toFixed(2)),
        camToChar: +camera.position.distanceTo(charPos).toFixed(2),
        nearby: st.nearbyId,
        moving,
        // Raw, not rounded: landing must return alt to exactly 0, and a
        // rounded readout would hide a slow sink.
        alt: st.alt,
        vAlt: st.vAlt,
        grounded,
        overWater,
        inWater,
        deck: +st.deck.toFixed(3),
        onDeck,
        aboardShip: st.aboardShip,
        helmed,
        shipSpeed: +shipState.speed.toFixed(2),
        // Both handy with __planetSetPos: it is a long swim out to the ship,
        // and the wheel is a small target once you are aboard.
        shipDir: [shipState.dir.x, shipState.dir.y, shipState.dir.z].map(
          (n) => +n.toFixed(4)
        ),
        helmDir: (() => {
          const h = alongHull(SHIP.helmOffset, RADIUS);
          return [h.x, h.y, h.z].map((n) => +n.toFixed(4));
        })(),
        shipAground: shipState.grounded,
        // Must stay ~0: the bow tangent is carried, not re-derived, so this is
        // where accumulated float error would show up first.
        shipTangentErr: +(
          shipState.dir.x * shipState.fwd.x +
          shipState.dir.y * shipState.fwd.y +
          shipState.dir.z * shipState.fwd.z
        ).toFixed(6),
        telescopeAt: telescope.at,
        telescopeTarget: telescopeTargetName(),
        // Angle between where the camera is actually looking and the star it
        // is supposed to be looking at. The one number that says whether the
        // telescope works.
        skyErrDeg: telescoped
          ? +(
              (Math.acos(
                THREE.MathUtils.clamp(
                  st.skyAim.dot(
                    st.camFwd.set(0, 0, -1).applyQuaternion(camera.quaternion)
                  ),
                  -1,
                  1
                )
              ) *
                180) /
              Math.PI
            ).toFixed(1)
          : null,
        darkness: +(() => {
          const sun = sunDirection(dayPhase(state.clock.elapsedTime));
          return darknessAt(
            posDir.x * sun.x + posDir.y * sun.y + posDir.z * sun.z
          );
        })().toFixed(3),
        snowballHeld: snowballs.holding,
        // Seconds since a snowball last hit something solid, and how hard the
        // snowman is rocking right now. -1 and 0 mean nothing has been hit.
        // Seconds since a snowball last hit something solid. Useful because
        // `wobble` decays over about a second, which in a throttled tab is
        // gone before you can look at it.
        struckAgo: +(state.clock.elapsedTime - snowballs.struckAt).toFixed(2),
        snowballsInAir: snowballs.pool.filter((b) => b.live).length,
        submerge: +st.submerge.toFixed(3),
        sprinting,
        stamina: +stamina.value.toFixed(3),
        staminaLocked: stamina.locked,
        zoom: +st.zoom.toFixed(3),
        speed: +speed.toFixed(2),
        speedCur: +st.speedCur.toFixed(2),
        fps: Math.round(1 / Math.max(delta, 1e-4)),
        compass: compass.slots
          .filter((s) => s.id !== null)
          .map((s) => ({
            id: s.id,
            deg: Math.round((s.angle * 180) / Math.PI),
            dist: +s.distance.toFixed(2),
          })),
      };
    }

    // ------------------------------------------------------------- proximity
    //
    // Interactables use the same enter/exit hysteresis the markers did: the
    // prompt appears at each one's own radius and only clears once you are
    // 25% further out, so standing on the boundary cannot flicker the HUD.
    // Anything mid-event drops out of the running entirely, which is what
    // stops you re-triggering a launch that is already under way.
    let bestId: string | null = null;
    let bestAngle = Infinity;
    for (const it of INTERACTABLES) {
      if (it.id === "rocket" && rocketBusy(state.clock.elapsedTime)) continue;
      // THE TRAMPOLINE IS ONLY OFFERED NEAR THE MAT. The proximity test is an
      // angle and knows nothing about altitude, so without this the prompt
      // stays up the whole way through the arc and E launches you again from
      // the top of it: press it fast enough and you climb forever.
      if (it.id === "trampoline" && st.alt > TRAMPOLINE_REACH) continue;
      // At the wheel, the wheel is the only thing you can interact with, and
      // it stays offered however far the pinning drifts you from its centre.
      if (shipState.helmed && it.id !== "helm") continue;
      const d = it.dirAt(RADIUS);
      const dot = posDir.x * d.x + posDir.y * d.y + posDir.z * d.z;
      const angle = Math.acos(THREE.MathUtils.clamp(dot, -1, 1));
      const limit = st.nearbyId === it.id ? it.radius * 1.25 : it.radius;
      if (angle < limit && angle < bestAngle) {
        bestAngle = angle;
        bestId = it.id;
      }
    }
    // AT THE EYEPIECE, THE EYEPIECE IS ALWAYS OFFERED, however the proximity
    // test came out. Being at it takes the movement keys, so if the prompt can
    // ever clear while you are looking through it there is no way back out and
    // the stage is bricked. The wheel is offered unconditionally for the same
    // reason.
    if (telescope.at) bestId = "telescope";
    // CARRYING A SNOWBALL TAKES THE KEY. Whatever you are standing next to,
    // E throws first: there is no way to hold a thing and press a button with
    // the same hand, and having the launch pad quietly win over the snowball
    // would be the kind of ambiguity you only discover by losing a throw to it.
    if (snowballs.holding) bestId = HELD_SNOWBALL_ID;
    if (heldSnowball.current) heldSnowball.current.visible = snowballs.holding;
    if (bestId !== st.nearbyId) {
      st.nearbyId = bestId;
      store.setNearby(bestId);
    }

    // -------------------------------------------------------------- interact
    if (input.interact) {
      input.interact = false;
      // Ordered by precedence, and the order is the whole design: a snowball in
      // hand answers E before anything you happen to be standing next to does.
      if (modalOpen) {
        // Nothing. Consuming the press is the point.
      } else if (snowballs.holding) {
        // Thrown from the hand's height, so a throw off the ship's deck starts
        // at deck height instead of at sea level.
        throwSnowball(
          { x: posDir.x, y: posDir.y, z: posDir.z },
          { x: faceDir.x, y: faceDir.y, z: faceDir.z },
          st.deck + st.alt + CHAR_HALF_HEIGHT * 0.9
        );
        snowThrow();
      } else if (st.nearbyId === "snowpile") {
        pickUpSnowball();
      } else if (st.nearbyId === "trampoline" && st.alt <= TRAMPOLINE_REACH) {
        // Re-checked rather than trusted: `nearbyId` is a frame old by the time
        // it is read here, and the frame it can be wrong in is the frame a
        // bounce starts. SETS the speed, never adds to it, which is what keeps
        // this from being a ladder.
        st.vAlt = TRAMPOLINE_BOUNCE;
        st.squash = -0.3;
        bounceSound();
      } else if (st.nearbyId === "piano") {
        const note = strikePiano(state.clock.elapsedTime);
        pianoNote(note.hertz, note.level);
        // Reuses the struck-prop registry the snowballs write to: a played note
        // and a snowball landing are the same event as far as the instrument is
        // concerned, which is that something knocked it.
        registerHit("piano", state.clock.elapsedTime);
      } else if (st.nearbyId === "knight") {
        if (moveKnight(state.clock.elapsedTime)) chessClack();
      } else if (st.nearbyId === "mill") {
        millCreak(toggleMill());
        // The wheel's trick: drop the prompt so its text is recomputed, since
        // it depends on state the store cannot see.
        st.nearbyId = null;
        store.setNearby(null);
      } else if (st.nearbyId === "telescope") {
        telescope.at = !telescope.at;
        if (telescope.at) {
          telescope.target = pickTarget(
            { x: posDir.x, y: posDir.y, z: posDir.z },
            dayPhase(state.clock.elapsedTime)
          );
        }
        st.nearbyId = null;
        store.setNearby(null);
      } else if (st.nearbyId === "rocket") {
        if (launchRocket(state.clock.elapsedTime)) {
          rocketLaunchSound();
          // Clear immediately so the prompt does not linger for the frame
          // before the proximity pass notices the rocket is busy.
          st.nearbyId = null;
          store.setNearby(null);
        }
      } else if (st.nearbyId === "helm") {
        shipState.helmed = !shipState.helmed;
        if (!shipState.helmed) {
          // Let the ship coast to a stop rather than stopping dead the moment
          // the wheel is let go.
          shipState.speed = Math.min(shipState.speed, 1.2);
        }
        // Drop the prompt so it is recomputed next frame: the HUD renders from
        // `nearbyId`, and the wheel's text depends on state the store cannot
        // see. One frame without a prompt, then the correct one.
        st.nearbyId = null;
        store.setNearby(null);
      }
    }
  });

  return (
    <>
      <group ref={group}>
        {/* Everything cosmetic hangs off `rig`, which the frame loop bobs,
            leans and squashes. `group` itself only ever carries the frame
            transform. Feet bottom out at y = -0.42 = -CHAR_HALF_HEIGHT, so the
            character stands on the surface rather than hovering over it. */}
        <group ref={rig}>
          {/* Body. Total height = length + 2*radius = 0.84 = 2 *
              CHAR_HALF_HEIGHT.

              Deliberately an abstract shape and not a little figure. A version
              of this with a head and two feet was tried and read as uncanny:
              at this size the silhouette is only a few dozen pixels, so
              anything humanoid lands in the gap between "token" and
              "character" without being either. An abstract capsule with a
              clear facing is legible at every zoom level and never invites the
              comparison. */}
          <mesh castShadow={false}>
            <capsuleGeometry args={[0.22, 0.4, 4, 16]} />
            <meshStandardMaterial color="#f472b6" roughness={0.45} metalness={0.1} />
          </mesh>

          {/* Nose, so facing is readable. Cone points +Y by default; rotating
              +90deg about X aims it at local +Z, which makeBasis maps to
              faceDir. */}
          <mesh position={[0, 0.06, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.09, 0.2, 12]} />
            <meshStandardMaterial color="#fde68a" roughness={0.4} />
          </mesh>

          {/* The snowball you are carrying. Held out front and to one side, at
              the height it is thrown from, so the prompt saying "Throw" and the
              thing that leaves your hand agree about where it was. Visibility is
              set from the frame loop, not from React state: this flips on a
              keypress and re-rendering the scene tree to report it would be the
              one allocation in an otherwise allocation-free interaction. */}
          <mesh ref={heldSnowball} position={[0.16, 0.08, 0.2]} visible={false}>
            <sphereGeometry args={[0.09, 7, 5]} />
            <meshStandardMaterial color="#dde3ec" roughness={0.85} flatShading />
          </mesh>
        </group>
      </group>

      {/* Cheap fake contact shadow: one draw call, cannot break, and avoids a
          shadow camera that would have to track a changing up vector.
          Deliberately a sibling of the character group rather than a child, so
          a jump lifts the character and leaves the shadow on the ground. */}
      <group ref={shadowGroup}>
        <mesh ref={shadowMesh} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.3, 20]} />
          <meshBasicMaterial
            color="#000000"
            transparent
            opacity={0.28}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Wake. A ring rather than a disc, so it reads as a disturbance
          spreading out from the character rather than as a second shadow. */}
      <group ref={rippleGroup} visible={false}>
        <mesh ref={rippleMesh} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.32, 0.52, 24]} />
          <meshBasicMaterial
            color="#dbeeff"
            transparent
            opacity={0}
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      </group>
    </>
  );
}

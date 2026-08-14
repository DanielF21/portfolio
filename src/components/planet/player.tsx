"use client";

import { useFrame, useThree } from "@react-three/fiber";
// Subpath import, not `import { easing } from "maath"`: the barrel would pull
// random/geometry/matrix/etc into the chunk for no reason.
import { damp3, dampQ } from "maath/easing";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import {
  CAM_DISTANCE,
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
  COS_ENTER,
  COS_EXIT,
  GRAVITY,
  JUMP_VELOCITY,
  MAX_DELTA,
  MOVE_ACCEL_TAU,
  ORIENT_SMOOTH,
  RADIUS,
  SPRINT_MULT,
  TURN_SPEED,
  WALK_SPEED,
} from "@/lib/planet/config";
import { compass } from "@/lib/planet/compass";
import { clearMovement, input } from "@/lib/planet/input";
import { usePlanetStore } from "@/lib/planet/store";
import type { PlanetMarker, SpawnPoint } from "@/lib/planet/types";

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

interface Props {
  markers: readonly PlanetMarker[];
  spawn: SpawnPoint;
}

export function Player({ markers, spawn }: Props) {
  const group = useRef<THREE.Group>(null);
  /** The contact shadow lives outside the character group so a jump lifts the
   *  character without lifting its shadow off the ground. */
  const shadowGroup = useRef<THREE.Group>(null);
  const shadowMesh = useRef<THREE.Mesh>(null);
  const camera = useThree((s) => s.camera);

  const markerDirs = useMemo(
    () =>
      markers.map((m) =>
        new THREE.Vector3(m.dir.x, m.dir.y, m.dir.z).normalize()
      ),
    [markers]
  );

  const indexById = useMemo(() => {
    const map = new Map<string, number>();
    markers.forEach((m, i) => map.set(m.id, i));
    return map;
  }, [markers]);

  /**
   * All persistent simulation state. Vectors are allocated once; nothing in
   * the frame loop allocates.
   */
  const st = useMemo(() => {
    const posDir = new THREE.Vector3(spawn.x, spawn.y, spawn.z).normalize();

    // Any tangent vector works as the initial facing. Guard against the
    // reference axis being parallel to the normal.
    const ref =
      Math.abs(posDir.y) > 0.99
        ? new THREE.Vector3(1, 0, 0)
        : new THREE.Vector3(0, 1, 0);
    const faceDir = new THREE.Vector3().crossVectors(ref, posDir).normalize();

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

    // ---------------------------------------------------------- movement
    const mx = modalOpen ? 0 : input.moveX;
    const my = modalOpen ? 0 : input.moveY;
    const moving = mx !== 0 || my !== 0;
    const sprinting = !modalOpen && input.sprint;
    const speed = WALK_SPEED * (sprinting ? SPRINT_MULT : 1);

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

        posDir.applyQuaternion(spin).normalize();
        faceDir.applyQuaternion(spin);
        camDir.applyQuaternion(spin);
        st.moveFrame.applyQuaternion(spin);
        st.moveDir.applyQuaternion(spin);

        up.copy(posDir);
        orthonormalize(faceDir, up);
        orthonormalize(camDir, up);
        orthonormalize(st.moveFrame, up);
        orthonormalize(st.moveDir, up);
      }

      // Purely cosmetic from here on: faceDir drives the rendered model's
      // orientation, never the movement direction.
      turnToward(faceDir, st.moveDir, up, TURN_SPEED * dt, axis);
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
      if (!modalOpen && st.alt === 0) st.vAlt = JUMP_VELOCITY;
    }
    if (st.alt > 0 || st.vAlt !== 0) {
      st.vAlt -= GRAVITY * dt;
      st.alt += st.vAlt * dt;
      if (st.alt <= 0) {
        // Snap to exactly zero rather than letting the integrator leave a
        // residue, or the character slowly sinks over many landings.
        st.alt = 0;
        st.vAlt = 0;
      }
    }
    const grounded = st.alt === 0;

    // ---------------------------------------------------- character transform
    charPos.copy(posDir).multiplyScalar(RADIUS + CHAR_HALF_HEIGHT + st.alt);

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

      // Shadow stays pinned to the surface and shrinks/fades with altitude,
      // which is what actually sells the height of a jump.
      if (shadowGroup.current) {
        shadowGroup.current.position.copy(posDir).multiplyScalar(RADIUS + 0.02);
        shadowGroup.current.quaternion.copy(group.current.quaternion);
        const shrink = 1 / (1 + st.alt * 0.6);
        shadowGroup.current.scale.setScalar(shrink);
        if (shadowMesh.current) {
          (shadowMesh.current.material as THREE.MeshBasicMaterial).opacity =
            0.28 / (1 + st.alt * 1.2);
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
      .multiplyScalar(RADIUS + CHAR_HALF_HEIGHT + st.alt * CAM_JUMP_FOLLOW);

    desired
      .copy(camAnchor)
      .addScaledVector(back, horiz)
      .addScaledVector(up, vert);

    // Never let the camera sink into the planet when pitched down.
    const dist = desired.length();
    const minDist = RADIUS + CAM_MIN_CLEARANCE;
    if (dist < minDist) desired.multiplyScalar(minDist / dist);

    lookAim.copy(charPos).addScaledVector(up, CAM_HEAD_OFFSET);

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

    st.warmedUp = true;

    // Runs after the camera transform above, so the indicators are computed
    // from this frame's camera rather than the previous one's.
    updateCompass(markers, markerDirs, posDir, camera, store.visited);

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
        sprinting,
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
    let bestIdx = -1;
    let bestDot = -Infinity;
    for (let i = 0; i < markerDirs.length; i++) {
      const d = posDir.dot(markerDirs[i]);
      if (d > bestDot) {
        bestDot = d;
        bestIdx = i;
      }
    }

    const current = st.nearbyId;
    if (current === null) {
      if (bestDot > COS_ENTER && bestIdx >= 0) {
        st.nearbyId = markers[bestIdx].id;
        store.setNearby(st.nearbyId);
      }
    } else {
      const curIdx = indexById.get(current);
      const curDot = curIdx === undefined ? -Infinity : posDir.dot(markerDirs[curIdx]);
      // Exit uses a wider angle than enter. That gap is the entire anti-flicker
      // mechanism: standing on the boundary cannot oscillate.
      if (curDot < COS_EXIT) {
        if (bestDot > COS_ENTER && bestIdx >= 0 && markers[bestIdx].id !== current) {
          st.nearbyId = markers[bestIdx].id;
        } else {
          st.nearbyId = null;
        }
        store.setNearby(st.nearbyId);
      }
    }

    // -------------------------------------------------------------- interact
    if (input.interact) {
      input.interact = false;
      if (!modalOpen && st.nearbyId) store.open(st.nearbyId);
    }
  });

  return (
    <>
      <group ref={group}>
        {/* Body. Total height = length + 2*radius = 0.84 = 2 * CHAR_HALF_HEIGHT. */}
        <mesh castShadow={false}>
          <capsuleGeometry args={[0.22, 0.4, 4, 16]} />
          <meshStandardMaterial color="#f472b6" roughness={0.45} metalness={0.1} />
        </mesh>

        {/* Nose, so facing is readable. Cone points +Y by default; rotating +90deg
            about X aims it at local +Z, which makeBasis maps to faceDir. */}
        <mesh position={[0, 0.06, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.09, 0.2, 12]} />
          <meshStandardMaterial color="#fde68a" roughness={0.4} />
        </mesh>
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
    </>
  );
}

"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { GROUND_Y } from "@/lib/transformer/layout";
import { BACKGROUND, GROUND_LINE } from "@/lib/transformer/theme";

/**
 * The plane the model stands on.
 *
 * Not decoration, and not a floor in any physical sense: there is no gravity
 * here and nothing rests on it. It is a horizontal reference. Without one, every
 * object floats in an unbounded void and the empty parts of the frame read as
 * nothing rather than as space; with one they read as a workbench, which is most
 * of what separates an instrument from a diagram. It also gives the eye
 * something to measure height against, which matters now that height carries
 * parameter count.
 *
 * HAND ROLLED RATHER THAN drei's <Grid>. The transformer chunk imports zero
 * drei today (only the planet does), and pulling the barrel in for this would
 * add a dependency to the lazy chunk to get the same `fwidth` line-width trick
 * that `grid-material.ts` already implements and documents at length. Same
 * technique, same file to read to understand both.
 *
 * The fade is radial rather than a fog term. Fog would tint the lines toward the
 * background at a rate set by the fog constants, which are tuned for the model;
 * the grid needs to vanish well before the fog does or its far edge reads as a
 * hard horizon line cutting across the frame.
 */

/** Half extent in world units. Wide enough to run past the model at every
 *  authored pose without the edge entering frame. */
const HALF = 130;
/** World units per fine cell. One unit reads as a unit, which is the point. */
const CELL = 1;
/** Every fifth line is brighter, so the eye can count without the fine grid
 *  having to stay resolvable. */
const SECTION = 5;

const VERT = /* glsl */ `
varying vec2 vXz;
void main() {
  vXz = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
varying vec2 vXz;
uniform vec3 uLine;
uniform vec3 uFade;
uniform float uCell;
uniform float uSection;
uniform float uHalf;

/* One pixel wide line on every boundary of a grid of "step" units, faded out
   as the cells approach pixel size. Same trick as grid-material.ts.

   NO BACKTICKS IN HERE. This is inside a template literal, so a backtick ends
   the shader mid-sentence and the error surfaces as a TypeScript parse failure
   dozens of lines away. It has already cost this codebase once. */
float lines(vec2 p, float step) {
  vec2 c = p / step;
  vec2 fw = fwidth(c);
  vec2 d = abs(fract(c - 0.5) - 0.5) / fw;
  float line = 1.0 - min(min(d.x, d.y), 1.0);
  return line * (1.0 - smoothstep(0.3, 0.7, max(fw.x, fw.y)));
}

void main() {
  float fine = lines(vXz, uCell);
  float section = lines(vXz, uCell * uSection);

  // Section lines carry, fine lines fill in near the camera.
  float a = max(section, fine * 0.45);

  // Radial falloff, so the plane has no visible edge. Squared for a softer
  // shoulder: a linear fade leaves a discernible ring where it reaches zero.
  float r = length(vXz) / uHalf;
  a *= 1.0 - clamp(r * r, 0.0, 1.0);

  if (a < 0.002) discard;
  gl_FragColor = vec4(mix(uFade, uLine, a), a);
}
`;

export function Ground() {
  const ref = useRef<THREE.Mesh>(null);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uLine: { value: new THREE.Color(GROUND_LINE) },
          uFade: { value: new THREE.Color(BACKGROUND) },
          uCell: { value: CELL },
          uSection: { value: SECTION },
          uHalf: { value: HALF },
        },
        transparent: true,
        // Nothing is ever behind the ground that should be hidden by it, and
        // writing depth would let the transparent fringe punch holes in
        // whatever draws after it.
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    []
  );

  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    // `__transformerFit` unions the bounding box of everything drawn, and a 260
    // unit plane would swallow every subject. Excluded by flag rather than by
    // name so a future prop cannot forget.
    if (ref.current) ref.current.userData.noFit = true;
  }, []);

  return (
    <mesh
      ref={ref}
      position={[0, GROUND_Y, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      // The plane spans the whole scene, so it is never fully out of frame and
      // culling it can only cost time.
      frustumCulled={false}
      renderOrder={-1}
    >
      <planeGeometry args={[HALF * 2, HALF * 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

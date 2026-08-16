import * as THREE from "three";

/**
 * A tensor's cell grid, drawn in the fragment shader.
 *
 * WHY NOT MESHES. The honest way to draw a 1536 x 8960 matrix is 13.7 million
 * little boxes. Even the small ones are thousands. Drawing the grid procedurally
 * makes every tensor exactly ONE draw call and, unlike geometry, it stays sharp
 * at any zoom because the line width is computed in screen space. Real per-cell
 * instancing is reserved for the one or two hero close-ups where an individual
 * cell is the subject.
 *
 * THE LINE WIDTH TRICK. `abs(fract(c - 0.5) - 0.5) / fwidth(c)` is distance to
 * the nearest cell boundary measured in PIXELS, because fwidth is the screen
 * space derivative of the cell coordinate. Thresholding that gives a line one
 * pixel wide however far away the surface is, with free antialiasing. A fixed
 * width in UV space instead would be a hairline up close and a solid wash at
 * distance.
 *
 * GRACEFUL DEGRADATION, which is the part that matters for honesty. An 8960
 * column matrix seen from across the scene has many cells per pixel, and a naive
 * grid turns into moire or a flat smear that misrepresents the tensor. So two
 * levels are drawn, the real grid and one COARSE_DIV times coarser, and EACH
 * fades out on its own as its cells approach pixel size. Close up you get true
 * cells, mid range every tenth cell, far away the plain base colour. Never a
 * shimmer, and never a wash that makes a dense tensor look like a pale one.
 * The label carries the true dimensions at every distance.
 *
 * The grid is drawn only on the faces whose normal points along Z, which is the
 * FACE of the matrix. The other four faces are its thickness, and thickness has
 * no rows or columns.
 */

/** How much coarser the fallback grid is. Ten keeps the coarse lines on decimal
 *  boundaries, so a coarse cell is a round number of real cells. */
const COARSE_DIV = 10.0;

export interface GridUniforms {
  uCells: { value: THREE.Vector2 };
  uFaceSize: { value: THREE.Vector2 };
  uLineColor: { value: THREE.Color };
  uLineOpacity: { value: number };
}

export interface GridMaterial extends THREE.MeshStandardMaterial {
  gridUniforms: GridUniforms;
}

const VERT_HEAD = /* glsl */ `
varying vec3 vGridLocal;
varying vec3 vGridNormal;
`;

const VERT_BODY = /* glsl */ `
vGridLocal = position;
vGridNormal = normal;
`;

const FRAG_HEAD = /* glsl */ `
varying vec3 vGridLocal;
varying vec3 vGridNormal;
uniform vec2 uCells;
uniform vec2 uFaceSize;
uniform vec3 uLineColor;
uniform float uLineOpacity;

/**
 * One grid level: a one pixel line on every cell boundary, faded out as the
 * cells approach pixel size.
 *
 * The fade is not optional and it is not cosmetic. The distance term is
 * measured in PIXELS, so once cells are smaller than a pixel that distance is
 * below 1 everywhere and the level returns a strong value over the whole face.
 * The result is a tensor that looks uniformly brighter the denser it gets,
 * which reads as "this object is a lighter colour" rather than "this object has
 * too many cells to resolve". Fading to nothing leaves the base colour, which
 * is the honest answer, and zooming in brings the cells back.
 */
float gridLevel(vec2 c) {
  vec2 fw = fwidth(c);
  vec2 d = abs(fract(c - 0.5) - 0.5) / fw;
  float line = 1.0 - min(min(d.x, d.y), 1.0);
  float density = max(fw.x, fw.y);
  return line * (1.0 - smoothstep(0.25, 0.6, density));
}
`;

const FRAG_BODY = /* glsl */ `
// Only the face of the matrix carries rows and columns; the other four sides
// are its thickness.
if (abs(vGridNormal.z) > 0.5) {
  vec2 uvFace = vGridLocal.xy / uFaceSize + 0.5;

  vec2 cFine = uvFace * uCells;
  float a = gridLevel(cFine);

  // A second level at every tenth cell, so a tensor too dense to resolve still
  // shows structure before it goes flat. Skipped when the tensor has fewer than
  // twenty cells on an axis, where "every tenth" would be one or two lines in
  // arbitrary places rather than a coarser reading of the same grid.
  vec2 coarseCells = uCells / ${COARSE_DIV.toFixed(1)};
  if (max(coarseCells.x, coarseCells.y) >= 2.0) {
    a = max(a, gridLevel(uvFace * coarseCells));
  }

  diffuseColor.rgb = mix(diffuseColor.rgb, uLineColor, a * uLineOpacity);
}
`;

/**
 * A MeshStandardMaterial that draws its own cell grid.
 *
 * `cells` is the TRUE logical dimension of the tensor, not a number chosen to
 * look right. `faceSize` is the geometry's width and height in world units, so
 * the shader can turn a local position into a 0..1 face coordinate without
 * relying on the box's UVs, which are per-face and would make the grid density
 * depend on which side you are looking at.
 */
export function createGridMaterial(opts: {
  color: string;
  cells: [number, number];
  faceSize: [number, number];
  lineColor: string;
  lineOpacity?: number;
  roughness?: number;
  metalness?: number;
  transparent?: boolean;
  opacity?: number;
}): GridMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: opts.color,
    roughness: opts.roughness ?? 0.75,
    metalness: opts.metalness ?? 0,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
  }) as GridMaterial;

  const uniforms: GridUniforms = {
    uCells: { value: new THREE.Vector2(opts.cells[0], opts.cells[1]) },
    uFaceSize: { value: new THREE.Vector2(opts.faceSize[0], opts.faceSize[1]) },
    uLineColor: { value: new THREE.Color(opts.lineColor) },
    uLineOpacity: { value: opts.lineOpacity ?? 0.9 },
  };
  material.gridUniforms = uniforms;

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${VERT_HEAD}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${VERT_BODY}`);

    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAG_HEAD}`)
      // After color_fragment so vertex colours and the base colour are already
      // resolved, and before lighting so the lines are lit like the surface
      // rather than glowing off it.
      .replace("#include <color_fragment>", `#include <color_fragment>\n${FRAG_BODY}`);
  };

  return material;
}

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
 * grid turns into moire or a flat smear that misrepresents the tensor.
 *
 * LEVELS. Three are drawn, each COARSE_DIV coarser than the last, and EACH
 * fades out on its own as its own cells approach pixel size. Close up you get
 * true cells, then every tenth, then every hundredth, and only then the plain
 * base colour. Never a shimmer, and never a wash that makes a dense tensor look
 * like a pale one. The label carries the true dimensions at every distance.
 *
 * Two levels was not enough, and the failure was visible rather than
 * theoretical: `down_proj` is 8,960 x 1,536 drawn about 75 by 340 pixels at the
 * overview, so even every tenth row lands at 0.4 of a pixel. Both levels faded,
 * and the single largest object in the frame rendered as a blank dark rectangle
 * with no indication it was a tensor at all. A third level puts roughly 15 lines
 * across it and 90 down, which is structure rather than noise, and every one of
 * them is a real hundredth boundary.
 *
 * ALL SIX FACES ARE DRAWN, BUT NOT ALL SIX ARE THE MATRIX. Only the two faces
 * along Z carry rows AND columns. The other four are the matrix seen EDGE ON, so
 * they get a one dimensional lamination instead: the left and right sides show
 * the row boundaries, the top and bottom show the column boundaries, which is
 * what a stack of sheets looks like from the side. Painting a full 2D grid there
 * would be inventing a subdivision that does not exist, and leaving them blank
 * (which is what this used to do) is why the stack read as plain grey bricks:
 * at the default three quarter camera the sides are most of what you see.
 */

/** How much coarser the fallback grid is. Ten keeps the coarse lines on decimal
 *  boundaries, so a coarse cell is a round number of real cells. */
const COARSE_DIV = 10.0;

/**
 * How strongly the cut edges are laminated, relative to the matrix face.
 *
 * Well under one, and it has to be. The key light comes from above, so the top
 * face of a slab is the brightest surface on it; drawn at full strength the
 * lamination made the EDGE of every tensor louder than its face, which inverts
 * the emphasis. A cut edge should say "this is a stack of rows" at a glance and
 * then get out of the way. The face is the subject.
 */
const EDGE_WEIGHT = 0.32;

export interface GridUniforms {
  uCells: { value: THREE.Vector2 };
  /** Full box extent, all three axes. The third is needed to classify which
   *  face a fragment is on; see `FRAG_BODY`. */
  uSize: { value: THREE.Vector3 };
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
uniform vec3 uSize;
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

/**
 * The same thing for a single axis, for the cut edges.
 *
 * This has to be its own function rather than gridLevel with a dummy second
 * component. The 2D version takes min(d.x, d.y), so a constant second component
 * contributes a distance of zero at every fragment and the min is zero
 * everywhere: the face paints SOLID rather than striped, which looks like a
 * deliberate block of colour and is the opposite of the intent.
 */
float gridLevel1(float c) {
  float fw = fwidth(c);
  float d = abs(fract(c - 0.5) - 0.5) / fw;
  float line = 1.0 - min(d, 1.0);
  return line * (1.0 - smoothstep(0.25, 0.6, fw));
}

#define EDGE_WEIGHT ${EDGE_WEIGHT.toFixed(2)}

/** Every level of a one dimensional grid, coarsest surviving one wins. */
float laminate(float t, float cells) {
  float a = gridLevel1(t * cells);
  float c1 = cells / ${COARSE_DIV.toFixed(1)};
  if (c1 >= 2.0) a = max(a, gridLevel1(t * c1));
  float c2 = c1 / ${COARSE_DIV.toFixed(1)};
  if (c2 >= 2.0) a = max(a, gridLevel1(t * c2));
  return a;
}

/** Every level of a two dimensional grid. See LEVELS in the file comment. */
float gridMulti(vec2 uv, vec2 cells) {
  float a = gridLevel(uv * cells);
  vec2 c1 = cells / ${COARSE_DIV.toFixed(1)};
  if (max(c1.x, c1.y) >= 2.0) a = max(a, gridLevel(uv * c1));
  vec2 c2 = c1 / ${COARSE_DIV.toFixed(1)};
  if (max(c2.x, c2.y) >= 2.0) a = max(a, gridLevel(uv * c2));
  return a;
}
`;

const FRAG_BODY = /* glsl */ `
// WHICH FACE AM I ON. Classified by LOCAL POSITION, not by the normal.
//
// The obvious test is abs(normal.z) > 0.5, and it works for a plain box. It
// breaks the moment the box is bevelled: a fillet's normal sweeps continuously
// from one axis to the next, so it passes through the threshold and the face
// grid bleeds around the rounded edge. Position has no such ambiguity, and the
// winning axis of |p| / half is the correct classifier for any box, bevelled or
// not.
vec3 uHalf = uSize * 0.5;
vec3 rel = abs(vGridLocal) / max(uHalf, vec3(1e-4));

// uCells is [columns, rows]; columns run across local X, rows up local Y.
float uCols = uCells.x;
float uRows = uCells.y;

float a = 0.0;

if (rel.z >= rel.x && rel.z >= rel.y) {
  // The face of the matrix: both axes are real, so this is the 2D grid.
  a = gridMulti(vGridLocal.xy / uSize.xy + 0.5, uCells);
} else if (rel.x >= rel.y) {
  // Left and right: the matrix seen edge on along its columns, so what is
  // exposed is the stack of ROWS. Laminate along local Y at the row pitch.
  a = laminate(vGridLocal.y / uSize.y + 0.5, uRows) * EDGE_WEIGHT;
} else {
  // Top and bottom: the stack of COLUMNS, laminated along local X.
  a = laminate(vGridLocal.x / uSize.x + 0.5, uCols) * EDGE_WEIGHT;
}

diffuseColor.rgb = mix(diffuseColor.rgb, uLineColor, a * uLineOpacity);
`;

/**
 * A MeshStandardMaterial that draws its own cell grid.
 *
 * `cells` is the TRUE logical dimension of the tensor, not a number chosen to
 * look right. `size` is the geometry's full extent in world units, so the shader
 * can turn a local position into a 0..1 face coordinate without relying on the
 * box's UVs, which are per-face and would make the grid density depend on which
 * side you are looking at. All three axes are needed, not just the face: the
 * depth is what lets the shader tell a face fragment from an edge one.
 */
export function createGridMaterial(opts: {
  color: string;
  cells: [number, number];
  size: [number, number, number];
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
    uSize: { value: new THREE.Vector3(opts.size[0], opts.size[1], opts.size[2]) },
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

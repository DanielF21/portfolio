import * as THREE from "three";

/**
 * A rectangular frustum: a box whose front and back faces are different sizes.
 *
 * This is how a projection is drawn. A matrix that maps 1536 features to 8960
 * IS the widening, so drawing it as a shape that starts at the stream's width
 * and ends at the MLP's width says what it does with geometry instead of with a
 * caption. An abrupt step from one box to a wider box reads as two unrelated
 * objects sitting next to each other.
 *
 * Non-indexed, so every face gets its own flat normal. The scene is flat shaded
 * throughout and a shared vertex would average the normals across an edge.
 */
export function taperGeometry(
  frontWidth: number,
  frontHeight: number,
  backWidth: number,
  backHeight: number,
  depth: number
): THREE.BufferGeometry {
  const fw = frontWidth / 2;
  const fh = frontHeight / 2;
  const bw = backWidth / 2;
  const bh = backHeight / 2;
  const z = depth / 2;

  // Front face is at +z, which is upstream: the dataflow runs toward -z.
  const f = [
    [-fw, -fh, z],
    [fw, -fh, z],
    [fw, fh, z],
    [-fw, fh, z],
  ];
  const b = [
    [-bw, -bh, -z],
    [bw, -bh, -z],
    [bw, bh, -z],
    [-bw, bh, -z],
  ];

  const quads: number[][][] = [
    [f[0], f[1], f[2], f[3]], // front
    [b[3], b[2], b[1], b[0]], // back, wound the other way
    [f[3], f[2], b[2], b[3]], // top
    [b[0], b[1], f[1], f[0]], // bottom
    [b[3], b[0], f[0], f[3]], // left
    [f[2], f[1], b[1], b[2]], // right
  ];

  const positions: number[] = [];
  for (const [a, c, d, e] of quads) {
    positions.push(...a, ...c, ...d);
    positions.push(...a, ...d, ...e);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

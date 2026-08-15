import * as THREE from "three";

/**
 * Repairs applied to every GLTF material the moment it loads.
 *
 * These models come from a dozen different authors and kits, and they were
 * authored against renderers that do not match this scene. This scene has two
 * punctual lights, an ambient term, and NO ENVIRONMENT MAP, which is the
 * assumption both repairs below are correcting for.
 *
 * Idempotent, so calling it again on a shared cached scene (several Clone
 * instances of one model) is harmless.
 */

/** glTF defaults metallicFactor to 1 when the field is omitted, and several
 *  Kenney exports rely on that default. A fully metallic surface reflects only
 *  the environment, so with no envmap it renders black. */
const METAL_CEILING = 0.25;
const ROUGH_FLOOR = 0.5;

/** Minimum linear luminance for a base colour.
 *
 *  Some models are authored near-black on purpose (the pavilion's three
 *  materials are #191919, a linear 0.01). That is a reasonable choice under
 *  image-based lighting, where a dark surface still picks up the sky. Here it
 *  receives almost nothing and reads as a hole cut out of the world rather
 *  than as an object, which is a rendering bug to a visitor even though the
 *  model is behaving exactly as authored.
 *
 *  0.05 linear is about #4a4a4a on screen: still clearly the darkest thing
 *  around, but lit. */
const LUMA_FLOOR = 0.05;

function fixMaterial(m: THREE.Material) {
  const std = m as THREE.MeshStandardMaterial;

  if (typeof std.metalness === "number" && std.metalness > METAL_CEILING) {
    std.metalness = METAL_CEILING;
    if (typeof std.roughness === "number" && std.roughness < ROUGH_FLOOR) {
      std.roughness = ROUGH_FLOOR;
    }
  }

  const c = std.color;
  if (!c) return;
  // Rec. 709 luminance, on the linear working values (NOT the sRGB hex).
  const luma = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  if (luma >= LUMA_FLOOR) return;
  if (luma > 1e-4) {
    // Scale toward the floor, preserving hue.
    c.multiplyScalar(LUMA_FLOOR / luma);
  } else {
    c.setScalar(LUMA_FLOOR);
  }
}

/** Walks a loaded GLTF scene and repairs every material on it. */
export function fixGltfMaterials(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) fixMaterial(m);
  });
}

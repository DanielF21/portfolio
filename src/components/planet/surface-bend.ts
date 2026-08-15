import * as THREE from "three";

/**
 * Laying flat things on a round world.
 *
 * Every piece of authored scenery is built in a tangent frame: origin on the
 * surface, +y up, +x and +z along the ground. That is a lie that only holds
 * near the origin. A point `d` units out along the tangent plane sits
 * `d^2 / (2R)` above the sphere, which on this planet is 8cm at 1.6 units and
 * 70cm at 4.7 units. So a house is fine built flat and a fenced field is not:
 * the far corner of a 5-unit plot floats a knee-height above the grass, which
 * is exactly what "the field is straight, it does not fit the surface" looks
 * like.
 *
 * The fix is not to bend the geometry, it is to place each PIECE rigidly and
 * let the layout curve. A fence post is small enough to be flat; the field the
 * posts describe is not. So each part is built at the local origin and then
 * carried out to its spot by a rotation about the planet's centre, which lands
 * it on the surface and tilts it to stand up straight there.
 *
 * The same operation the walk, the collision pushout and the ship all use: on
 * a sphere, moving is rotating.
 */

/**
 * Transform for a part that belongs `dx, dz` tangent units from the anchor.
 *
 * `radius` is the planet's radius EXPRESSED IN THE PART'S OWN UNITS, so a
 * group with `scale = 2` passes `RADIUS / 2`. Getting that wrong bends the
 * layout by the scale factor and is the one easy mistake here.
 */
export function bendMatrix(dx: number, dz: number, radius: number): THREE.Matrix4 {
  const dist = Math.hypot(dx, dz);
  if (dist < 1e-6) return new THREE.Matrix4();

  // Rotating about this axis carries the local up (0,1,0) toward (dx,0,dz),
  // which is the direction the part is meant to lie in.
  const axis = new THREE.Vector3(dz / dist, 0, -dx / dist);
  const spin = new THREE.Matrix4().makeRotationAxis(axis, dist / radius);

  // Conjugated by a shift to the planet's centre, so the rotation pivots about
  // the centre rather than about the anchor.
  return new THREE.Matrix4()
    .makeTranslation(0, -radius, 0)
    .multiply(spin)
    .multiply(new THREE.Matrix4().makeTranslation(0, radius, 0));
}

/** The point `dx, dz` tangent units from the anchor and `height` above the
 *  surface, in the anchor's local frame. For building curved strips vertex by
 *  vertex, where a rigid per-part transform is not enough. */
export function bendPoint(
  dx: number,
  dz: number,
  height: number,
  radius: number,
  out = new THREE.Vector3()
): THREE.Vector3 {
  return out.set(0, height, 0).applyMatrix4(bendMatrix(dx, dz, radius));
}

/**
 * Sphere placement math.
 *
 * Scenery is placed by hand via `placeOnSphere` (district tangent frames, see
 * `world-layout.ts`); the golden-angle Fibonacci spiral is used for scattering
 * props, where an even mechanical distribution is exactly right.
 *
 * This file must never import `three`; it returns plain {x,y,z} objects.
 */

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export interface Dir {
  x: number;
  y: number;
  z: number;
}

/**
 * N evenly spread unit vectors. `offset` shifts the spiral so a second call
 * with the same N produces a different, interleaved set.
 */
export function fibonacciSphere(n: number, offset = 0.5): Dir[] {
  const out: Dir[] = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + offset)) / n;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = i * GOLDEN_ANGLE;
    out.push({ x: Math.cos(theta) * r, y, z: Math.sin(theta) * r });
  }
  return out;
}

function cross(a: Dir, b: Dir): Dir {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function normalize(v: Dir): Dir {
  const l = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

/**
 * The point at angular distance `arc` from `centre`, at compass `bearing`.
 * Bearing 0 = local north (world +Y projected onto the tangent plane),
 * increasing eastward (east = normalize(cross(worldUp, centre))). Falls back
 * to a +Z-derived frame when `centre` is within ~8 degrees of a pole, where
 * "north" stops meaning anything.
 */
/**
 * The unit tangent at `from` pointing along the great circle toward `to`.
 * Undefined when the two are identical or antipodal; returns null there so the
 * caller can pick its own fallback.
 */
export function tangentToward(from: Dir, to: Dir): Dir | null {
  const dot = from.x * to.x + from.y * to.y + from.z * to.z;
  const v = {
    x: to.x - from.x * dot,
    y: to.y - from.y * dot,
    z: to.z - from.z * dot,
  };
  const l = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (l < 1e-6) return null;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

export function placeOnSphere(centre: Dir, bearing: number, arc: number): Dir {
  const ref: Dir =
    Math.abs(centre.y) > 0.99 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };
  const east = normalize(cross(ref, centre));
  const north = cross(centre, east); // unit: centre and east are orthonormal

  const cosArc = Math.cos(arc);
  const sinArc = Math.sin(arc);
  const tx = north.x * Math.cos(bearing) + east.x * Math.sin(bearing);
  const ty = north.y * Math.cos(bearing) + east.y * Math.sin(bearing);
  const tz = north.z * Math.cos(bearing) + east.z * Math.sin(bearing);

  return normalize({
    x: centre.x * cosArc + tx * sinArc,
    y: centre.y * cosArc + ty * sinArc,
    z: centre.z * cosArc + tz * sinArc,
  });
}


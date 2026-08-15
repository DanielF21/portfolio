/**
 * The telescope on the desert island.
 *
 * The sky is the one part of this world that is a real system rather than a
 * backdrop: the sun, the moon, the gas giant and four named constellations sit
 * in a single group that turns about `SPIN_AXIS`, so anything that points at a
 * star has something true to point at, and what is overhead depends on the
 * time of day. The telescope is the payoff for having built that.
 *
 * It picks its own target: whichever constellation is highest above the horizon
 * where the telescope stands. That is what makes it work at any hour without
 * ever aiming at the ground, and it means the thing you are shown changes
 * across the day rather than being one authored view.
 *
 * This file must never import `three`.
 */

import { CONSTELLATIONS } from "./constellations";
import { SPIN_AXIS } from "./daylight";
import type { Dir } from "./layout";

export const telescope = {
  /** True while the player has their eye to it. */
  at: false,
  /** Index into CONSTELLATIONS, chosen on the way in and held until you leave,
   *  so the view does not swap targets while you are looking through it. */
  target: 0,
};

/** Rotate a direction about the spin axis, which is what carries the whole
 *  celestial sphere. The same rotation `sky.tsx` applies to its one group. */
function spin(v: Dir, angle: number): Dir {
  const a = SPIN_AXIS;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const dot = a.x * v.x + a.y * v.y + a.z * v.z;
  return {
    x: v.x * c + (a.y * v.z - a.z * v.y) * s + a.x * dot * (1 - c),
    y: v.y * c + (a.z * v.x - a.x * v.z) * s + a.y * dot * (1 - c),
    z: v.z * c + (a.x * v.y - a.y * v.x) * s + a.z * dot * (1 - c),
  };
}

function normalise(v: Dir): Dir {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

/** Where a constellation is in world space right now. */
export function constellationDir(index: number, phase: number): Dir {
  const c = CONSTELLATIONS[index % CONSTELLATIONS.length];
  return spin(normalise(c.at), phase * Math.PI * 2);
}

/**
 * The best thing to look at from `from` right now: the constellation with the
 * greatest elevation above that point's horizon.
 *
 * Ties and near-ties do not matter; what matters is never choosing one that is
 * below the ground, which on a small planet is half of them.
 */
export function pickTarget(from: Dir, phase: number): number {
  let best = 0;
  let bestUp = -2;
  for (let i = 0; i < CONSTELLATIONS.length; i++) {
    const d = constellationDir(i, phase);
    const up = d.x * from.x + d.y * from.y + d.z * from.z;
    if (up > bestUp) {
      bestUp = up;
      best = i;
    }
  }
  return best;
}

/** Where the tube is pointing: at the chosen target when in use, and at the
 *  best available one otherwise, so it tracks the sky whether or not anyone is
 *  watching. */
export function telescopeAim(from: Dir, phase: number): Dir {
  return constellationDir(
    telescope.at ? telescope.target : pickTarget(from, phase),
    phase
  );
}

/** Name of what it is currently showing, for the HUD. */
export function telescopeTargetName(): string {
  return CONSTELLATIONS[telescope.target % CONSTELLATIONS.length].name;
}

export function resetTelescope() {
  telescope.at = false;
  telescope.target = 0;
}

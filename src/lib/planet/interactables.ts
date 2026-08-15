/**
 * Things the visitor can walk up to and press E on.
 *
 * This revives machinery that has been dormant since the portfolio markers
 * were removed: `player.tsx` still has the proximity test with its enter/exit
 * hysteresis, `input.ts` still binds E and Enter, and the store still carries
 * `nearbyId`. All that was missing was anything to be near. Interactables are
 * the replacement for markers, minus everything markers dragged along with
 * them (a pad, a glow, a floating label, a beacon, a modal).
 *
 * Positions come from `SCENERY` rather than being restated here, so an
 * interactable cannot drift away from the object it belongs to.
 *
 * This file must never import `three`; the HUD reads it for the prompt text.
 */

import { knightSquare } from "./knight";
import { mill } from "./mill";
import { SHIP } from "./ship";
import { alongHull, shipState } from "./ship-state";
import { telescope } from "./telescope";
import { resolveSceneryDir, SCENERY } from "./world-layout";
import type { Dir } from "./layout";

export interface Interactable {
  readonly id: string;
  /** Unit direction on the sphere, at the moment of asking. Most interactables
   *  never move, but the ship's wheel sails away with the ship, so this is a
   *  call rather than a stored vector. */
  readonly dirAt: (radius: number) => Dir;
  /** Angular radius at which the prompt appears, radians. Wider than the
   *  collider so the prompt shows while you are still walking up, not only
   *  once you are jammed against the thing. */
  readonly radius: number;
}

const PROMPTS: Readonly<Record<string, string>> = {
  rocket: "Launch",
  helm: "Take the wheel",
  snowpile: "Take a snowball",
  trampoline: "Bounce",
  piano: "Play",
  knight: "Move",
  mill: "Start the mill",
  telescope: "Look through",
};

/**
 * Not a place, a state: what E does while you are carrying a snowball.
 *
 * Carrying one takes over the key entirely, so this is what the HUD shows no
 * matter what else you are standing next to. Modelling it as a nearby id keeps
 * the HUD's rule simple, because `nearbyId` has always meant "what E does right
 * now" and that is exactly what is true here.
 */
export const HELD_SNOWBALL_ID = "held-snowball";

const fromScenery: readonly Interactable[] = SCENERY.filter(
  (item) => item.id && PROMPTS[item.id]
).map((item) => {
  const dir = resolveSceneryDir(item);
  // The knight is the second thing here that will not hold still, so its
  // prompt is resolved per call from the square it is on. Anchoring it to the
  // row would leave the prompt behind after the first hop.
  const dirAt =
    item.id === "knight"
      ? (radius: number) => knightSquare(dir, radius)
      : () => dir;
  return {
    id: item.id!,
    dirAt,
    radius: Math.max(0.09, (item.collideAngle ?? 0.05) * 2.2),
  };
});

/** The ship's wheel. Not a `SCENERY` row, because the ship moves and `SCENERY`
 *  is authored, fixed geography. Its position is derived from the same
 *  `SHIP.helmOffset` the wheel geometry is built at. */
const HELM: Interactable = {
  id: "helm",
  dirAt: (radius) => alongHull(SHIP.helmOffset, radius),
  // Generous: you are approaching this across a rolling deck, and the deck cap
  // it stands on is only so wide.
  radius: 0.075,
};

export const INTERACTABLES: readonly Interactable[] = [...fromScenery, HELM];

export function promptFor(id: string | null): string | null {
  if (!id) return null;
  if (id === HELD_SNOWBALL_ID) return "Throw";
  if (id === "helm") return shipState.helmed ? "Leave the wheel" : PROMPTS.helm;
  if (id === "mill") return mill.running ? "Stop the mill" : PROMPTS.mill;
  if (id === "telescope") return telescope.at ? "Step back" : PROMPTS.telescope;
  return PROMPTS[id] ?? null;
}

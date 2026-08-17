"use client";

import {
  BRANCH_Y,
  CONDUIT_H,
  CONDUIT_W,
  JUNCTION_RUN,
  STATIONS,
} from "@/lib/transformer/layout";
import { STREAM } from "@/lib/transformer/theme";

import { usePick } from "./pick";

/**
 * The two runs of branch a block computes on.
 *
 * A block touches the stream four times: read, add, read, add. Between the read
 * and the add it is working on its own copy, and that copy is what runs along
 * here. Two runs, not one, because attention and the MLP each get their own read
 * and their own add.
 *
 * THIS IS THE SECOND ATTEMPT AND THE FIRST ONE WAS DELETED. What was wrong with
 * it was not the idea, it was that it ran at the same height the stations stand
 * on: centred on `BRANCH_Y` with the stations bottom aligned at exactly
 * `BRANCH_Y`, it cut a 0.17 notch into the underside of every one of them and
 * passed clean through the interior of the three that were centred rather than
 * bottom aligned.
 *
 * Both faults are gone for the same reason. **The rail's TOP FACE is the
 * baseline**, so it sits entirely below everything and the stations rest on it
 * rather than being skewered by it, and after the alignment pass nothing crosses
 * that line in the first place.
 *
 * **And it does not overhang.** Each run stops at the outermost geometry it
 * connects: no stub protruding past the first or last station into empty space.
 *
 * SCHEMATIC CROSS SECTION, exactly as the stream conduit is, and for the reason
 * set out at `CONDUIT_W`. The tensor on the branch is [seq, 1536] for most of its
 * length but not all of it: inside attention it is split into heads and inside
 * the MLP it widens. Both are drawn at true proportion INSIDE the station where
 * you look at them. Carrying a true section along the run between would make a
 * claim about widths that change.
 *
 * Slimmer and dimmer than the stream itself, so the stream stays the primary
 * object: the branch is a copy, and the copy is thrown away.
 */

const W = CONDUIT_W * 0.62;
const H = CONDUIT_H * 0.62;

function Run({ from, to }: { from: number; to: number }) {
  const length = Math.abs(from - to);
  const pick = usePick("stream");
  return (
    <mesh
      // Top face exactly on the baseline. See the note above; this one number is
      // the difference between a rail and a saw.
      position={[0, BRANCH_Y - H / 2, (from + to) / 2]}
      // Spans the whole run between two stations, so measuring a station would
      // otherwise pull in its neighbours. The stations define their own extents.
      userData={{ noFit: true }}
      {...pick}
    >
      <boxGeometry args={[W, H, length]} />
      <meshStandardMaterial
        color={STREAM}
        emissive={STREAM}
        emissiveIntensity={0.12}
        roughness={0.6}
        metalness={0}
      />
    </mesh>
  );
}

export function Branch() {
  return (
    <>
      {/* Read, attend, add back. Stops at the add's branch body, which stands
          `JUNCTION_RUN` upstream of the junction itself. */}
      <Run from={STATIONS.ln1} to={STATIONS.add1 + JUNCTION_RUN} />
      {/* Read again, mix, add back again. */}
      <Run from={STATIONS.ln2} to={STATIONS.add2 + JUNCTION_RUN} />
    </>
  );
}

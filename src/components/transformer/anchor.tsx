"use client";

import { useEffect, useRef } from "react";
import type { Object3D } from "three";

import { OVERVIEW_ID } from "@/lib/transformer/glossary";
import { useTransformerStore } from "@/lib/transformer/store";

/**
 * A point in the scene that wants a label.
 *
 * Registers an empty Object3D wherever it is placed and nothing else. The
 * label's screen position comes from that object's WORLD transform, read by
 * `label-tracker`, so an anchor cannot drift from the thing it names: move the
 * slab and the anchor moves with it, because it is inside the same group.
 *
 * The alternative, a table of label positions computed from the layout
 * constants, duplicates every placement and goes stale the first time a local
 * offset changes inside a component.
 */

export interface AnchorRecord {
  id: string;
  text: string;
  /** Second line, usually the real shape or byte count. */
  sub?: string;
  object: Object3D;
}

/** Live anchors, in mount order. Read once per frame by the tracker. */
export const anchors: AnchorRecord[] = [];

/**
 * Anchors are scoped the same way geometry is, and for the same reason.
 *
 * A `Scope` already unmounts the geometry of a station you are not looking at,
 * which takes its anchors with it. The case that needs handling is the OTHER
 * direction: at the overview every station is mounted, so every part label
 * competes for the middle of the frame and you get seven labels stacked on the
 * hero block. Part labels are for when you have asked to look at that part.
 *
 * `overview` opts a label into the whole-model shot, where only a handful of
 * top level names belong.
 */
export function Anchor({
  id,
  text,
  sub,
  overview = false,
  position = [0, 0, 0],
}: {
  id: string;
  text: string;
  sub?: string;
  overview?: boolean;
  position?: [number, number, number];
}) {
  const focus = useTransformerStore((s) => s.focus);
  const ref = useRef<Object3D>(null);
  const zoomed = focus !== null && focus !== OVERVIEW_ID;
  const shown = overview ? !zoomed : zoomed;

  useEffect(() => {
    const object = ref.current;
    if (!object || !shown) return;
    const record: AnchorRecord = { id, text, sub, object };
    anchors.push(record);
    return () => {
      const i = anchors.indexOf(record);
      if (i >= 0) anchors.splice(i, 1);
    };
  }, [id, text, sub, shown]);

  return <object3D ref={ref} position={position} />;
}

"use client";

import type { ReactNode } from "react";

import { visibleUnder } from "@/lib/transformer/glossary";
import { useTransformerStore } from "@/lib/transformer/store";

/**
 * Draws its children only when they are in scope for the current focus.
 *
 * One component and one rule, applied everywhere, so nothing has to know which
 * particular sibling might be in the way. See `glossary.ts` for why hiding
 * siblings is necessary rather than tidy.
 *
 * `position` is taken here rather than by a wrapping group so that a scope and
 * its placement stay one node; a scope that renders nothing should not leave an
 * empty transform behind.
 */
export function Scope({
  id,
  position,
  children,
}: {
  id: string;
  position?: [number, number, number];
  children: ReactNode;
}) {
  const focus = useTransformerStore((s) => s.focus);
  if (!visibleUnder(focus, id)) return null;
  return <group position={position ?? [0, 0, 0]}>{children}</group>;
}

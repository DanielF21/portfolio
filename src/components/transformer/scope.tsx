"use client";

import { createContext, useContext, type ReactNode } from "react";

import { visibleUnder } from "@/lib/transformer/glossary";
import { useTransformerStore } from "@/lib/transformer/store";

/**
 * The scope path a subtree sits in.
 *
 * Exists so an `Anchor` can know what it belongs to without being told. Labels
 * need to appear one level down from whatever you are looking at (looking at a
 * block names its stations, looking at a station names its tensors), and the
 * alternative to reading it from the tree is a `level` prop on all twenty-three
 * call sites that would then have to be kept in step with where the component
 * is actually mounted.
 */
const ScopeContext = createContext<string>("");

export function useScopePath(): string {
  return useContext(ScopeContext);
}

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
  return (
    <ScopeContext.Provider value={id}>
      <group position={position ?? [0, 0, 0]}>{children}</group>
    </ScopeContext.Provider>
  );
}

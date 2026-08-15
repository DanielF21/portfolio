"use client";

import { useEffect } from "react";
import { create } from "zustand";

/**
 * How many previews are allowed to actually run at once.
 *
 * Without this, an index of thirty toys is thirty simultaneous animation loops
 * and, worse, several live WebGL contexts. Browsers cap contexts (Safari at
 * around 16) and silently fail to create more, so the failure mode is not
 * "slow", it is "blank tiles".
 *
 * Three rules:
 *  - at most MAX_LIGHT light previews at once
 *  - a heavy preview (one that owns a WebGL context) is EXCLUSIVE: nothing else
 *    runs while it holds the slot. Beyond raw cost, `usePlanetStore` is a module
 *    singleton, so two planet instances would corrupt each other's sceneReady
 *    and loadProgress.
 *  - eviction is least-recently-requested, not refusal, so whatever you just
 *    pointed at is the thing that comes alive. The evicted tile fades back to
 *    its poster.
 */

export type Weight = "light" | "heavy";

const MAX_LIGHT_DESKTOP = 2;
const MAX_LIGHT_SMALL = 1;

interface Holder {
  id: string;
  weight: Weight;
  at: number;
}

interface LiveBudget {
  holders: Holder[];
  /** Monotonic counter. Avoids Date.now() ties when several tiles request in
   *  the same millisecond. */
  seq: number;
  maxLight: number;
  request: (id: string, weight: Weight) => void;
  release: (id: string) => void;
  releaseAll: () => void;
  setMaxLight: (n: number) => void;
}

export const useLiveBudget = create<LiveBudget>((set, get) => ({
  holders: [],
  seq: 0,
  maxLight: MAX_LIGHT_DESKTOP,

  request: (id, weight) => {
    const { holders, seq } = get();
    if (holders.some((h) => h.id === id)) return;

    const next = seq + 1;
    const entry: Holder = { id, weight, at: next };

    if (weight === "heavy") {
      // Exclusive. Everything else is evicted.
      set({ holders: [entry], seq: next });
      return;
    }

    // A light request cannot start while a heavy one holds the floor.
    if (holders.some((h) => h.weight === "heavy")) return;

    const kept = [...holders, entry].sort((a, b) => b.at - a.at);
    set({ holders: kept.slice(0, get().maxLight), seq: next });
  },

  release: (id) =>
    set((s) => ({ holders: s.holders.filter((h) => h.id !== id) })),

  releaseAll: () => set({ holders: [] }),

  setMaxLight: (n) => set({ maxLight: n }),
}));

/**
 * Claim a live slot. Returns whether this component currently holds one.
 *
 * `wanted` should already account for device capability and user preference;
 * this hook only arbitrates between competing tiles.
 */
export function useLiveSlot(id: string, weight: Weight, wanted: boolean) {
  const request = useLiveBudget((s) => s.request);
  const release = useLiveBudget((s) => s.release);
  const granted = useLiveBudget((s) => s.holders.some((h) => h.id === id));

  useEffect(() => {
    if (wanted) request(id, weight);
    else release(id);
  }, [wanted, id, weight, request, release]);

  // Always give the slot back on unmount, or a navigated-away tile holds the
  // budget forever.
  useEffect(() => () => release(id), [id, release]);

  return granted;
}

/**
 * Mount once, high in the tree. Drops every slot when the tab is hidden, so a
 * backgrounded tab is not running animation loops, and lowers the cap on small
 * screens.
 */
export function useLiveBudgetLifecycle() {
  const releaseAll = useLiveBudget((s) => s.releaseAll);
  const setMaxLight = useLiveBudget((s) => s.setMaxLight);

  useEffect(() => {
    const small = window.matchMedia("(max-width: 767px)");
    const apply = () =>
      setMaxLight(small.matches ? MAX_LIGHT_SMALL : MAX_LIGHT_DESKTOP);
    apply();
    small.addEventListener("change", apply);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") releaseAll();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      small.removeEventListener("change", apply);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [releaseAll, setMaxLight]);
}

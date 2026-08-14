import { create } from "zustand";

/**
 * Bridge between the r3f render loop and the DOM overlay.
 *
 * The render loop reads with `usePlanetStore.getState()` (no subscription, so
 * no re-render coupling) and writes only on edges. The overlay subscribes with
 * narrow selectors.
 *
 * This file must never import `three`: it is imported eagerly by the overlay,
 * so a value import of three here would defeat the code splitting entirely.
 */

interface PlanetState {
  /** Marker the character is currently standing next to, if any. */
  nearbyId: string | null;
  /** Marker whose modal is open, if any. */
  activeId: string | null;
  visited: string[];
  /** Set while the WebGL scene has actually taken over the viewport. Flips
   *  only after the scene's assets have resolved and a frame has rendered
   *  (see SceneReadySignal in world.tsx), never on bare mount. */
  sceneReady: boolean;
  /** 0..100 asset-loading progress, bridged from drei's useProgress inside the
   *  lazy chunk. This module stays three-free. */
  loadProgress: number;

  setNearby: (id: string | null) => void;
  open: (id: string) => void;
  close: () => void;
  setSceneReady: (ready: boolean) => void;
  setLoadProgress: (progress: number) => void;
}

export const usePlanetStore = create<PlanetState>((set, get) => ({
  nearbyId: null,
  activeId: null,
  visited: [],
  sceneReady: false,
  loadProgress: 0,

  setNearby: (id) => {
    if (get().nearbyId === id) return;
    set({ nearbyId: id });
  },

  open: (id) => {
    const { visited } = get();
    set({
      activeId: id,
      visited: visited.includes(id) ? visited : [...visited, id],
    });
  },

  close: () => set({ activeId: null }),

  setSceneReady: (sceneReady) => set({ sceneReady }),

  setLoadProgress: (loadProgress) => {
    if (get().loadProgress === loadProgress) return;
    set({ loadProgress });
  },
}));

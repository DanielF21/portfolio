/**
 * The React-visible state, and only the parts that change on a human action.
 *
 * The split this file exists to enforce: zustand carries EDGES, `view.ts`
 * carries FRAMES. Which node is focused changes when someone clicks; the camera
 * pose changes 60 times a second. Only the first belongs here. The render loop
 * reads this with `getState()` and never subscribes.
 *
 * This file must never import `three`.
 */

import { create } from "zustand";

import { CONFIG } from "./config";
import { SEQ_TOKENS } from "./layout";

export type Mode = "prefill" | "decode";

/** Prompt length. Matches the sequence axis the activations are drawn with, so
 *  a filled cache and the score grid agree about how many tokens there are. */
const PROMPT_TOKENS = SEQ_TOKENS;

interface TransformerState {
  /**
   * Focused scope path, or null for the whole model.
   *
   * ISOLATION IS NOT A FLOURISH, IT IS WHAT MAKES THE INTERIOR LEGIBLE. The
   * stations sit in a line along Z, so getting a square view of any one of them
   * means looking down that line, and looking down that line puts every
   * upstream station between the camera and the subject. The Q/K/V width
   * comparison is stacked vertically and can only be read from the front, which
   * is exactly the blocked direction. Hiding the siblings is the fix, and
   * `glossary.visibleUnder` is the rule that does it.
   */
  focus: string | null;
  /** Which of the blocks is the hero, 0-indexed. Independent of `focus`,
   *  because focusing "SwiGLU MLP" should not also move you to a different
   *  layer. Starts in the middle: layer 0 and layer 27 are the two least
   *  representative blocks in the model. */
  layer: number;
  /** Node under the cursor, for the inspector. */
  hover: string | null;
  mode: Mode;
  /** How many tokens are in the KV cache. Prefill sets this to the prompt
   *  length in one go; decode raises it one at a time. */
  tokens: number;
  step: () => void;
  /** Whether the first frame has rendered, so the stage can cross-fade in
   *  rather than flashing an empty canvas. */
  ready: boolean;

  setFocus: (id: string | null) => void;
  setLayer: (i: number) => void;
  setHover: (id: string | null) => void;
  setMode: (m: Mode) => void;
  setReady: (ready: boolean) => void;
  reset: () => void;
}

const INITIAL_LAYER = Math.floor(CONFIG.numHiddenLayers / 2);

export const useTransformerStore = create<TransformerState>((set, get) => ({
  focus: null,
  layer: INITIAL_LAYER,
  hover: null,
  mode: "prefill",
  tokens: 0,
  ready: false,

  setFocus: (focus) => {
    if (get().focus === focus) return;
    set({ focus });
  },
  setLayer: (i) => {
    const layer = Math.max(0, Math.min(CONFIG.numHiddenLayers - 1, Math.round(i)));
    if (get().layer === layer) return;
    set({ layer });
  },
  // Guarded because this is written from a per-frame hover pick, and an
  // unguarded set would re-render the inspector on every frame the cursor
  // rests on the same object.
  setHover: (hover) => {
    if (get().hover === hover) return;
    set({ hover });
  },
  // Switching mode resets what is cached, because the two modes start from
  // different places: prefill begins with an empty cache and fills it in one
  // shot, decode begins with the prompt already cached and extends it.
  setMode: (mode) =>
    set({ mode, tokens: mode === "prefill" ? 0 : PROMPT_TOKENS }),

  step: () => {
    const { mode, tokens } = get();
    if (mode === "prefill") {
      // The whole prompt at once. That is the definition of prefill: every
      // token is known, so every column can be computed in parallel.
      set({ tokens: tokens === 0 ? PROMPT_TOKENS : 0 });
      return;
    }
    set({ tokens: tokens + 1 });
  },

  setReady: (ready) => set({ ready }),

  reset: () =>
    set({
      focus: null,
      layer: INITIAL_LAYER,
      hover: null,
      mode: "prefill",
      tokens: 0,
      ready: false,
    }),
}));

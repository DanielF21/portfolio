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
import { OVERVIEW_ID } from "./glossary";
import { CACHE_TOKENS, SEQ_TOKENS } from "./layout";

export type Mode = "prefill" | "decode";

/** Prompt length. Matches the sequence axis the activations are drawn with, so
 *  a filled cache and the score grid agree about how many tokens there are. */
const PROMPT_TOKENS = SEQ_TOKENS;

/**
 * Whether the next press on the cache's one button clears rather than advances.
 *
 * BOTH MODES END SOMEWHERE, and until now only prefill said so. Prefill's second
 * press has always been "Clear"; decode's kept incrementing past the last drawn
 * column, so the caption counted tokens that were not on screen and there was no
 * way back to an empty grid without switching mode and switching back.
 *
 * A full cache is also the more interesting end of decode, since running out of
 * room is what the cache costs you. So decode stops at capacity and offers the
 * same clear prefill does.
 */
export function isClearStep(mode: Mode, tokens: number): boolean {
  return mode === "prefill" ? tokens > 0 : tokens >= CACHE_TOKENS;
}

interface TransformerState {
  /**
   * Focused scope path, or null for the whole model.
   *
   * FOCUS FRAMES AND MARKS. IT DOES NOT REMOVE. Setting it points the camera at
   * a subtree (`auto-frame` measures it), brackets that subtree (`focus-mark`)
   * and opens the block if the path is inside one. Everything else in the model
   * stays drawn, so a part is always seen as part of something.
   *
   * It used to hide every sibling, because the stations sit in a line along Z
   * and a square view of one looks straight down the line at all the others.
   * That made each station legible alone and meaningless in every other way.
   * The line-of-sight problem now lives where it belongs: the stations are
   * spaced for an off-axis camera and every in-block pose uses one.
   */
  focus: string | null;
  /** Which of the blocks is the hero, 0-indexed. Independent of `focus`,
   *  because focusing "SwiGLU MLP" should not also move you to a different
   *  layer. Starts in the middle: layer 0 and layer 27 are the two least
   *  representative blocks in the model. */
  layer: number;
  /** Node under the cursor. Null the moment the cursor is on nothing. */
  hover: string | null;
  /**
   * What the detail panel is describing. A node id, or `OVERVIEW_ID`.
   *
   * IT IS NOT `hover`, AND THE DIFFERENCE IS THE WHOLE POINT: hover goes null
   * constantly and the subject never does. The panel is a docked column, not an
   * annotation over the scene, so it keeps describing the last thing you pointed
   * at rather than blinking empty between objects.
   *
   * THIS REPLACED A FLOATING CARD, and the reason is worth keeping. The card sat
   * in the bottom right of the viewport with a "Read more" button on it, so
   * reaching that button meant dragging the cursor across the scene, and the
   * scene is made of pickable objects. The residual stream conduit runs the
   * length of the frame, so the card had almost always rewritten itself to
   * "Residual stream" before the cursor arrived, and the button you aimed at now
   * belonged to something else. No timing fix helps: `hover` is not null during
   * that trip, it is a different node. A docked panel removes the trip entirely.
   */
  subject: string;
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
  /** Open a block from the scene. See the implementation for why it does not
   *  open the one that was clicked. */
  openBlock: () => void;
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
  subject: OVERVIEW_ID,
  mode: "prefill",
  tokens: 0,
  ready: false,

  setFocus: (focus) => {
    if (get().focus === focus) return;
    // NAVIGATING SETS THE SUBJECT TOO. Most of the time hover has already done
    // it, since you arrive at a station by pointing at it. The cases that
    // matter are the ones with no cursor on anything: backing out to the stack
    // by pressing empty space, and "Reset view". Without this the panel would
    // go on describing a station nobody is looking at any more.
    set({ subject: focus ?? OVERVIEW_ID });

    // ARRIVING AT THE CACHE SHOWS A CACHE. It used to open at `tokens: 0`,
    // which drew an empty rectangle and a caption reading "0 tokens cached ·
    // 0 B", so the one view whose whole subject is how much memory this costs
    // opened by showing none of it. You had to find and press a button before
    // the view had any content, and nothing on screen said so.
    //
    // Seeding to the prompt length means you land on the filled grid: 28 layers
    // by 12 tokens, one cell per KiB. Clear and re-run are still there for the
    // rhythm difference between prefill and decode, which is what the toggle is
    // actually for.
    if (focus === "kv" && get().mode === "prefill" && get().tokens === 0) {
      set({ focus, tokens: PROMPT_TOKENS });
      return;
    }
    set({ focus });
  },
  setLayer: (i) => {
    const layer = Math.max(0, Math.min(CONFIG.numHiddenLayers - 1, Math.round(i)));
    if (get().layer === layer) return;
    set({ layer });
  },

  /**
   * Clicking any of the 28 blocks opens A block, not THAT block.
   *
   * They are the same structure, and the one thing that differs between them is
   * how much room they have to open into: the hero pushes its neighbours 23
   * units aside in both directions, so opening block 0 or block 27 blooms into
   * empty space at one end and the whole stack at the other, and the shot is
   * lopsided for a reason that means nothing about the model. Opening one from
   * the middle is the representative case and it is the one the layer stepper
   * already starts on.
   *
   * The stepper is still there for anyone who wants a specific layer; this is
   * only what a click on the geometry does.
   */
  openBlock: () => {
    set({ layer: INITIAL_LAYER });
    get().setFocus("block");
  },
  // Guarded because this is written from a per-frame hover pick, and an
  // unguarded set would re-render the inspector on every frame the cursor
  // rests on the same object.
  setHover: (hover) => {
    if (get().hover === hover) return;
    // Pointing at something makes it the subject; pointing at nothing leaves the
    // subject where it was. See `subject`.
    set(hover === null ? { hover } : { hover, subject: hover });
  },
  // Switching mode resets what is cached, because the two modes start from
  // different places: prefill begins with an empty cache and fills it in one
  // shot, decode begins with the prompt already cached and extends it.
  setMode: (mode) =>
    set({ mode, tokens: mode === "prefill" ? 0 : PROMPT_TOKENS }),

  step: () => {
    const { mode, tokens } = get();
    if (isClearStep(mode, tokens)) {
      // Decode clears back to the PROMPT, not to nothing. Decode presupposes a
      // prefilled prompt: there is no such thing as decoding into an empty
      // cache, and clearing to 0 would leave the mode showing a state it cannot
      // be in. Prefill starts empty, so it clears to empty.
      set({ tokens: mode === "prefill" ? 0 : PROMPT_TOKENS });
      return;
    }
    if (mode === "prefill") {
      // The whole prompt at once. That is the definition of prefill: every
      // token is known, so every column can be computed in parallel.
      set({ tokens: PROMPT_TOKENS });
      return;
    }
    // One column, and never past the last one the grid draws.
    set({ tokens: Math.min(tokens + 1, CACHE_TOKENS) });
  },

  setReady: (ready) => set({ ready }),

  reset: () =>
    set({
      focus: null,
      layer: INITIAL_LAYER,
      hover: null,
      subject: OVERVIEW_ID,
      mode: "prefill",
      tokens: 0,
      ready: false,
    }),
}));

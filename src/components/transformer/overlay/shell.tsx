"use client";

import type { ReactNode } from "react";

import { CONFIG } from "@/lib/transformer/config";
import { formatBytes, formatCount } from "@/lib/transformer/format";
import { OVERVIEW_ID, entryById } from "@/lib/transformer/glossary";
import { DERIVED, nodeById } from "@/lib/transformer/model";
import { isClearStep, useTransformerStore } from "@/lib/transformer/store";
import { requestRefit } from "@/lib/transformer/view";
import {
  FRAME,
  RULE,
  SURFACE,
  TEXT,
  TEXT_FAINT,
  TEXT_MUTED,
  accent,
} from "@/lib/transformer/theme";

import { DetailPanel } from "./detail-panel";
import { IndexPanel } from "./index-panel";

/**
 * The body's shape, and it is two shapes.
 *
 * WIDE: three columns. The index holds labels, the detail panel holds sentences,
 * so the detail is 1.75x the index. Both are `minmax`, so a narrowing window
 * shrinks them rather than crushing the viewport between them.
 *
 * NARROW: three ROWS, and this is not a nicety. The two columns have floors of
 * 180 and 315 pixels, which is 495 before the canvas gets anything at all, so on
 * a 390 pixel phone the panels took the whole frame and the model was not on
 * screen. Stacked, each surface gets the full width and the diagram gets the
 * larger share of the height, since it is the thing.
 *
 * The switch is at `lg` rather than `md`: at 768 the three columns leave the
 * canvas 273 pixels, which is technically a layout and not a usable one.
 */
const COLUMNS =
  "grid-rows-[auto_minmax(0,1.2fr)_minmax(0,1fr)] lg:grid-rows-1 " +
  "lg:grid-cols-[minmax(180px,15rem)_minmax(0,1fr)_minmax(315px,26.25rem)]";

/**
 * The instrument the model sits inside.
 *
 * THE CANVAS IS A GRID CELL, NOT THE WHOLE VIEWPORT. That is the entire point of
 * this file. Before it, the 3D was `absolute inset-0` full bleed with a
 * `pointer-events-none` layer of text floating on top, which is what made the
 * frame read as mostly empty: nothing claimed the areas the model did not
 * occupy, so they were not composition, they were leftovers. Here the header,
 * the index and the status bar are real regions with real edges, the viewport
 * gets what remains, and "off-centre framing" falls out of the layout instead of
 * being faked with a camera offset.
 *
 * MIN-HEIGHT ZERO IS LOAD BEARING. A grid item defaults to `min-height: auto`,
 * so a canvas in a `1fr` track can push the track taller, which grows the
 * canvas, which pushes the track taller. R3F's ResizeObserver then oscillates
 * and the page grows without bound. The viewport cell pins both axes to zero and
 * hides overflow; do not remove those.
 *
 * The three-value colour relationship is the reference's, measured off it: the
 * outer frame at full accent, inner rules at a fifth of it, and a background
 * that is the accent hue at very low lightness rather than a neutral. See
 * `theme.ts`.
 */

interface Props {
  onExit: () => void;
  /** The canvas host. Handed in rather than imported so this file stays free of
   *  anything that would pull three into the eagerly loaded overlay chunk. */
  children: ReactNode;
  /** Cross-fade the viewport only. The chrome is painted immediately, because a
   *  panel that appears late reads as a layout bug rather than as loading. */
  ready: boolean;
}

function Meta({ children }: { children: ReactNode }) {
  return (
    <span
      className="font-mono text-[10px] uppercase tracking-[0.16em]"
      style={{ color: TEXT_FAINT }}
    >
      {children}
    </span>
  );
}

export function Shell({ onExit, children, ready }: Props) {
  const focus = useTransformerStore((s) => s.focus);
  const hover = useTransformerStore((s) => s.hover);
  const layer = useTransformerStore((s) => s.layer);
  const setLayer = useTransformerStore((s) => s.setLayer);
  const setFocus = useTransformerStore((s) => s.setFocus);
  const mode = useTransformerStore((s) => s.mode);
  const tokens = useTransformerStore((s) => s.tokens);
  const setMode = useTransformerStore((s) => s.setMode);
  const step = useTransformerStore((s) => s.step);

  const entry = entryById(focus ?? OVERVIEW_ID);
  const hovered = hover ? nodeById(hover) : undefined;

  // A path rather than a name, because the thing being looked at is always
  // somewhere inside something. `block.attn.scores` is more informative as
  // /block-15/attention/scores than as "Scores".
  const crumbs = (focus ?? "")
    .split(".")
    .filter(Boolean)
    .map((seg) => (seg === "block" ? `block-${layer + 1}` : seg));
  const breadcrumb = `/${["model", ...crumbs].join("/")}`;

  const home = () => {
    setFocus(null);
    requestRefit();
  };

  // The frame's inset shrinks on a phone. Sixteen pixels a side is 8% of a 390
  // pixel screen, taken from the axis with none to give.
  return (
    <div
      className="absolute inset-2 flex sm:inset-4"
      style={{ border: `1px solid ${FRAME}` }}
    >
      <div
        className="grid min-h-0 min-w-0 flex-1"
        style={{ gridTemplateRows: "auto minmax(0,1fr) auto" }}
      >
        {/* Header: identity, and every figure in it is derived. */}
        <header
          className="flex items-center justify-between gap-3 px-3 py-2 sm:gap-4 sm:px-4 sm:py-3"
          style={{ borderBottom: `1px solid ${RULE}` }}
        >
          <div className="flex min-w-0 items-baseline gap-4">
            <span
              className="font-mono text-[11px] uppercase tracking-[0.2em] sm:text-[12px]"
              style={{ color: TEXT }}
            >
              {CONFIG.name}
            </span>
            {/* The totals are the first thing to go when there is no room: the
                detail panel opens on them anyway. */}
            <span className="hidden md:inline">
              <Meta>
                {formatCount(DERIVED.paramsTotal)} params ·{" "}
                {CONFIG.numHiddenLayers} layers ·{" "}
                {formatBytes(DERIVED.weightBytes)}
              </Meta>
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={home}
              className="px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors sm:px-3"
              style={{ border: `1px solid ${RULE}`, color: TEXT_MUTED }}
            >
              Reset<span className="hidden sm:inline"> view</span>
            </button>
            <button
              type="button"
              onClick={onExit}
              className="px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors sm:px-3"
              style={{ border: `1px solid ${RULE}`, color: TEXT_MUTED }}
            >
              Exit
            </button>
          </div>
        </header>

        {/* Body: index down the left, detail down the right, viewport taking
            what is left. The viewport is the `1fr`, so the panels narrow the
            canvas rather than covering it, and `auto-frame` re-fits when they
            do. That is the point of the whole arrangement: nothing that
            describes the model is ever drawn on top of it. */}
        <div className={`grid min-h-0 min-w-0 ${COLUMNS}`}>
          <IndexPanel />

          {/* THE VIEWPORT CELL. min-h-0 / min-w-0 / overflow-hidden are what stop
              the grid blowout described at the top of this file. */}
          <div className="relative min-h-0 min-w-0 overflow-hidden">
            <div
              className={`absolute inset-0 transition-opacity duration-500 ${
                ready ? "opacity-100" : "opacity-0"
              }`}
            >
              {children}
            </div>

            {/* Breadcrumb, top left of the viewport, over the canvas. Hidden on
                a phone: the status bar already names where you are, and over a
                canvas this short it is one of three things competing for the top
                left corner. */}
            <div className="pointer-events-none absolute left-3 top-2 hidden sm:block sm:left-4 sm:top-3">
              <span
                className="font-mono text-[10px] tracking-[0.08em]"
                style={{ color: accent(0.55) }}
              >
                {breadcrumb}
              </span>
            </div>

            {/* Which of the 28 is open. Only meaningful while the stack or a
                whole block is in view: inside a station you are looking at one
                layer's worth of machinery and which layer it is changes
                nothing you can see. */}
            {(focus === null || focus === OVERVIEW_ID || focus === "block") && (
              <div
                className="absolute left-3 top-2 flex items-center gap-2 px-2 py-1 sm:left-4 sm:top-10"
                style={{ background: SURFACE, border: `1px solid ${RULE}` }}
              >
                <Meta>
                  Block {layer + 1} / {CONFIG.numHiddenLayers}
                </Meta>
                <button
                  type="button"
                  onClick={() => setLayer(layer - 1)}
                  aria-label="Previous block"
                  className="px-1.5 font-mono text-xs leading-4"
                  style={{ border: `1px solid ${RULE}`, color: TEXT_MUTED }}
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => setLayer(layer + 1)}
                  aria-label="Next block"
                  className="px-1.5 font-mono text-xs leading-4"
                  style={{ border: `1px solid ${RULE}`, color: TEXT_MUTED }}
                >
                  +
                </button>
              </div>
            )}

            {/* Prefill and decode. Only offered in the cache view, because the
                difference between them IS a statement about the cache: prefill
                fills every column at once, decode adds one at a time. */}
            {focus === "kv" && (
              <div
                className="absolute bottom-3 left-3 flex items-center gap-4 px-3 py-2 sm:bottom-8 sm:left-8"
                style={{ background: SURFACE, border: `1px solid ${RULE}` }}
              >
                <div className="flex gap-3">
                  {(["prefill", "decode"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className="font-mono text-[10px] uppercase tracking-[0.14em] transition-colors"
                      style={{ color: mode === m ? accent(1) : TEXT_MUTED }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={step}
                  className="px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em]"
                  style={{ border: `1px solid ${RULE}`, color: TEXT }}
                >
                  {/* ONE BUTTON, AND THE MODE PLUS THE FILL DECIDE WHAT IT IS.
                      Both modes end: prefill after one press, decode when the
                      cache is full. `isClearStep` is the same predicate the
                      store steps on, so the label cannot say one thing while the
                      press does another. */}
                  {isClearStep(mode, tokens)
                    ? "Clear"
                    : mode === "prefill"
                      ? "Run prefill"
                      : "Decode one token"}
                </button>
              </div>
            )}

          </div>

          <DetailPanel />
        </div>

        {/* Status bar. Says what is selected.
            THE MOUSE HINTS ARE GONE. "Drag to rotate / scroll to zoom / hover to
            inspect" is what every 3D viewer on the web does, so it told a reader
            nothing they would not have found in two seconds, and it sat in the
            one place with room for something the piece actually knows. */}
        <footer
          className="flex items-center justify-between gap-4 px-4 py-2"
          style={{ borderTop: `1px solid ${RULE}` }}
        >
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: accent(ready ? 1 : 0.3) }}
            />
            <span
              className="font-mono text-[10px] uppercase tracking-[0.16em]"
              style={{ color: TEXT_MUTED }}
            >
              {hovered?.label ?? entry?.label ?? "Model ready"}
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

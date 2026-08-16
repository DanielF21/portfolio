"use client";

import type { ReactNode } from "react";

import { CONFIG } from "@/lib/transformer/config";
import { formatBytes, formatCount } from "@/lib/transformer/format";
import { OVERVIEW_ID, entryById } from "@/lib/transformer/glossary";
import { DERIVED, nodeById } from "@/lib/transformer/model";
import { useTransformerStore } from "@/lib/transformer/store";
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

import { IndexPanel } from "./index-panel";
import { InfoCard } from "./info-card";

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

  return (
    <div className="absolute inset-4 flex" style={{ border: `1px solid ${FRAME}` }}>
      <div
        className="grid min-h-0 min-w-0 flex-1"
        style={{ gridTemplateRows: "auto minmax(0,1fr) auto" }}
      >
        {/* Header: identity, and every figure in it is derived. */}
        <header
          className="flex items-center justify-between gap-4 px-4 py-3"
          style={{ borderBottom: `1px solid ${RULE}` }}
        >
          <div className="flex items-baseline gap-4">
            <span
              className="font-mono text-[12px] uppercase tracking-[0.2em]"
              style={{ color: TEXT }}
            >
              {CONFIG.name}
            </span>
            <Meta>
              {formatCount(DERIVED.paramsTotal)} params ·{" "}
              {CONFIG.numHiddenLayers} layers · {formatBytes(DERIVED.weightBytes)}
            </Meta>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={home}
              className="px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors"
              style={{ border: `1px solid ${RULE}`, color: TEXT_MUTED }}
            >
              Reset view
            </button>
            <button
              type="button"
              onClick={onExit}
              className="px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors"
              style={{ border: `1px solid ${RULE}`, color: TEXT_MUTED }}
            >
              Exit
            </button>
          </div>
        </header>

        {/* Body: index down the left, viewport taking what is left. */}
        <div
          className="grid min-h-0 min-w-0"
          style={{ gridTemplateColumns: "minmax(180px, 15rem) minmax(0,1fr)" }}
        >
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

            {/* Breadcrumb, top left of the viewport, over the canvas. */}
            <div className="pointer-events-none absolute left-4 top-3">
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
                className="absolute left-4 top-10 flex items-center gap-2 px-2 py-1"
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
                className="absolute bottom-8 left-8 flex items-center gap-4 px-3 py-2"
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
                  {mode === "prefill"
                    ? tokens === 0
                      ? "Run prefill"
                      : "Clear"
                    : "Decode one token"}
                </button>
              </div>
            )}

            <InfoCard />
          </div>
        </div>

        {/* Status bar. Says what is selected and what the mouse does. */}
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

          <div className="flex gap-5">
            <Meta>Drag to rotate</Meta>
            <Meta>Scroll to zoom</Meta>
            <Meta>Hover to inspect</Meta>
          </div>
        </footer>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";

import { CONFIG } from "@/lib/transformer/config";
import {
  formatBytes,
  formatCount,
  formatInt,
  formatPercent,
  formatShape,
} from "@/lib/transformer/format";
import { INDEX, OVERVIEW_ID } from "@/lib/transformer/glossary";
import { SEQ_TOKENS } from "@/lib/transformer/layout";
import {
  DERIVED,
  bytesOf,
  isPerLayer,
  nodeById,
  totalParamsOf,
} from "@/lib/transformer/model";
import { readingFor } from "@/lib/transformer/reading";
import { useTransformerStore } from "@/lib/transformer/store";
import {
  RULE,
  RULE_SOFT,
  SURFACE,
  TEXT,
  TEXT_FAINT,
  TEXT_MUTED,
  accent,
} from "@/lib/transformer/theme";

import { EncodingKey } from "./key";

/**
 * The one detail surface, down the right hand side.
 *
 * A COLUMN, NOT A CARD, AND THAT IS THE WHOLE DESIGN. What stood here before was
 * a card floating in the bottom right of the viewport, carrying a "Read more"
 * button. Reaching that button meant dragging the cursor across the scene, and
 * the scene is made of pickable objects: the residual stream conduit runs the
 * length of the frame, so the card had usually rewritten itself to "Residual
 * stream" before the cursor arrived and the button now belonged to something
 * else. No delay fixes that, because `hover` is not null during the trip, it is
 * a different node. Docking the surface removes the trip.
 *
 * Three other things came with it, none of them incidental:
 *
 * - **It stops covering its own subject.** The card sat on top of the geometry
 *   it described, most visibly over the KV cache grid.
 * - **It never blinks empty.** `store.subject` holds the last thing pointed at,
 *   so sweeping the cursor across a gap does not clear the panel. The earlier
 *   objection to a card that stayed up while nothing was hovered does not apply:
 *   that was an annotation pointing at nothing over the scene, and this is a
 *   reference column beside it.
 * - **The layout claims the space.** Same argument that produced the index
 *   panel, stated at the top of `shell.tsx`.
 *
 * NO CLOSE BUTTON AND NO PROGRESSIVE DISCLOSURE. It is furniture, like the index,
 * so it does not need dismissing; and the writing is what it is for, so it shows
 * the writing rather than a summary with the writing behind a press. The
 * intermediate design had both a one line note and a "Read more", which meant a
 * reader had to ask twice for an answer the panel was already holding.
 */

/** Position in the index, so the ordinal here matches the row over there. */
function indexOf(id: string): number | null {
  const i = INDEX.findIndex((e) => e.id === id);
  return i < 0 ? null : i;
}

export function DetailPanel() {
  const subject = useTransformerStore((s) => s.subject);

  // BACK TO THE TOP ON A NEW SUBJECT. The column runs past the fold, so pointing
  // at something else while scrolled down would drop you into the middle of a
  // paragraph about it. Not `behavior: smooth`: the subject changes as fast as
  // the cursor moves.
  const scroller = useRef<HTMLElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [subject]);

  const isOverview = subject === OVERVIEW_ID;
  const node = isOverview ? undefined : nodeById(subject);
  const reading = readingFor(subject);

  // A subject that is neither the overview nor a known node cannot happen from
  // the pick layer, but the panel should not blank the layout if it ever does.
  if (!isOverview && !node) return null;

  const label = isOverview ? CONFIG.name : node!.label;
  const kind = isOverview ? "model" : node!.kind;
  const shape = isOverview
    ? `${formatCount(DERIVED.paramsTotal)} params · ${CONFIG.numHiddenLayers} layers · ${formatBytes(DERIVED.weightBytes)}`
    : formatShape(node!.shape, SEQ_TOKENS);
  const ordinal = indexOf(subject);

  const total = node ? totalParamsOf(node.id) : 0;
  const perLayer = node ? isPerLayer(node.id) : false;

  return (
    <aside
      ref={scroller}
      aria-label="Detail"
      // Below `lg` this is the bottom row rather than the right column, so the
      // rule that separates it from the canvas moves from one edge to the other.
      className="flex min-h-0 min-w-0 flex-col overflow-y-auto overscroll-contain border-t lg:border-l lg:border-t-0"
      style={{ borderColor: RULE, background: SURFACE }}
    >
      <div
        className="sticky top-0 px-4 py-3"
        style={{ background: SURFACE, borderBottom: `1px solid ${RULE_SOFT}` }}
      >
        <div
          className="font-mono text-[10px] uppercase tracking-[0.16em]"
          style={{ color: accent(0.8) }}
        >
          {ordinal !== null ? `${String(ordinal + 1).padStart(2, "0")} / ` : ""}
          {kind}
        </div>
        <h2 className="mt-1 font-mono text-[14px] leading-5" style={{ color: TEXT }}>
          {label}
        </h2>
        {shape && (
          <div
            className="mt-0.5 font-mono text-[10px] leading-4"
            style={{ color: TEXT_FAINT }}
          >
            {shape}
          </div>
        )}
      </div>

      <div className="px-4 py-4">
        {/* The per-layer line matters more than it looks. A projection's own
            count is one layer's worth and the model has 28 of them; quoting only
            the former understates the tensor by 28x, and quoting only the latter
            misdescribes the object being pointed at. It says both. */}
        {total > 0 && (
          <div
            className="font-mono text-[10px] leading-4"
            style={{ color: TEXT_FAINT }}
          >
            {/* A GROUP HAS NO PARAMETERS OF ITS OWN, so the per-layer phrasing
                rendered "0 per layer · 1.31B across 28 layers", which reads as a
                bug even though both halves are true of different things. */}
            {perLayer && node!.params > 0 ? (
              <>
                {formatInt(node!.params)} per layer · {formatCount(total)} across{" "}
                {CONFIG.numHiddenLayers} layers
              </>
            ) : perLayer ? (
              <>
                {formatCount(total)} across {CONFIG.numHiddenLayers} layers
              </>
            ) : (
              <>{formatCount(total)} params</>
            )}
            <br />
            {formatBytes(bytesOf(node!.id))} at {CONFIG.dtype} ·{" "}
            {formatPercent(total / DERIVED.paramsTotal)} of the model
          </div>
        )}

        {/* THE ONE PLACE THE AREA RULE DOES NOT HOLD, SAID OUT LOUD. A one
            dimensional weight has no second axis to scale, so it is drawn at
            MIN_AXIS and is necessarily larger than its share. The slab carries a
            bright outline; this is the sentence that says what it means. */}
        {node?.kind === "weight" && node.shape.length < 2 && (
          <div
            className="mt-3 font-mono text-[10px] leading-4"
            style={{ color: accent(0.75) }}
          >
            Outlined because it is drawn larger than scale. Area is parameter
            count everywhere else; a vector this size would be a hairline.
          </div>
        )}

        {node?.tiedTo && (
          <div
            className="mt-3 font-mono text-[10px] leading-4"
            style={{ color: accent(0.75) }}
          >
            Tied to {nodeById(node.tiedTo)?.label ?? node.tiedTo}: the same
            tensor, counted once.
          </div>
        )}

        {reading && (
          <div className={`flex flex-col gap-3 ${total > 0 ? "mt-4" : ""}`}>
            {reading.body.map((block, i) =>
              typeof block === "string" ? (
                <p
                  key={i}
                  className="text-[13px] leading-6"
                  style={{ color: TEXT_MUTED }}
                >
                  {block}
                </p>
              ) : (
                <ul key={i} className="flex flex-col gap-2 py-1">
                  {block.points.map((point) => (
                    <li
                      key={point.term}
                      className="flex gap-2 text-[13px] leading-6"
                      style={{ color: TEXT_MUTED }}
                    >
                      <span
                        className="mt-2 h-1 w-1 shrink-0"
                        style={{ background: accent(0.8) }}
                      />
                      <span>
                        <span style={{ color: TEXT }}>{point.term}:</span>{" "}
                        {point.text}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>
        )}
      </div>

      {/* The key, on the layouts where the index is a strip and cannot hold it.
          `mt-auto` inside it pins it to the bottom of the column. */}
      <EncodingKey className="lg:hidden" />
    </aside>
  );
}

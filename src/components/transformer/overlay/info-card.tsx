"use client";

import { CONFIG } from "@/lib/transformer/config";
import {
  formatBytes,
  formatCount,
  formatInt,
  formatPercent,
  formatShape,
} from "@/lib/transformer/format";
import { INDEX, OVERVIEW_ID, entryById } from "@/lib/transformer/glossary";
import { SEQ_TOKENS } from "@/lib/transformer/layout";
import {
  DERIVED,
  bytesOf,
  isPerLayer,
  nodeById,
  totalParamsOf,
} from "@/lib/transformer/model";
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

/**
 * One card, and the only text drawn over the 3D.
 *
 * WHAT THIS REPLACES. There used to be a pool of fourteen projected labels with
 * leader lines, decluttered by a screen-space overlap test. Even working
 * exactly as designed it put four or five two-line captions across the middle of
 * every station shot, over the geometry they were describing, and the
 * declutter pass meant which ones survived changed as you orbited. The reference
 * this piece answers has zero floating labels and one bordered card, and it is
 * right: a reader looks at one thing at a time.
 *
 * HOVER BEATS FOCUS. The card shows whatever the cursor is on, and falls back to
 * the focused station when the cursor is on nothing. So it is never empty while
 * you are somewhere, and pointing at a tensor always answers about that tensor.
 *
 * Every figure is read out of the model graph, so the card and the object beside
 * it cannot disagree: both are computed from the same config.
 *
 * The per-layer note matters more than it looks. A projection's own parameter
 * count is one layer's worth and the model has 28 of them; quoting only the
 * former understates the tensor by a factor of 28, and quoting only the latter
 * misdescribes the object being pointed at. It says both.
 */
export function InfoCard() {
  const hover = useTransformerStore((s) => s.hover);
  const focus = useTransformerStore((s) => s.focus);

  const id = hover ?? focus;
  const node = id ? nodeById(id) : undefined;
  const entry = entryById(focus ?? OVERVIEW_ID);

  // The overview has no single node to describe, and inventing one would mean
  // captioning the whole model as though it were a tensor.
  if (!node && (!entry || entry.id === OVERVIEW_ID)) return null;

  const title = node?.label ?? entry?.label ?? "";
  const kind = node?.kind ?? "station";
  const ordinal = indexOf(focus ?? OVERVIEW_ID);

  const total = node ? totalParamsOf(node.id) : 0;
  const perLayer = node ? isPerLayer(node.id) : false;

  return (
    <div
      className="pointer-events-none absolute bottom-8 right-8 w-[22rem] max-w-[calc(100%-4rem)]"
      style={{
        background: SURFACE,
        border: `1px solid ${RULE}`,
      }}
    >
      <div
        className="flex items-baseline justify-between px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em]"
        style={{ borderBottom: `1px solid ${RULE_SOFT}`, color: TEXT_FAINT }}
      >
        <span style={{ color: accent(0.8) }}>
          {ordinal !== null ? `${String(ordinal + 1).padStart(2, "0")} / ` : ""}
          {kind}
        </span>
        {hover && <span>cursor</span>}
      </div>

      <div className="px-3 py-3">
        <div className="font-mono text-[13px] leading-5" style={{ color: TEXT }}>
          {title}
        </div>

        {node && (
          <div
            className="mt-1 font-mono text-[11px] leading-4"
            style={{ color: TEXT_MUTED }}
          >
            {formatShape(node.shape, SEQ_TOKENS)}
          </div>
        )}

        {node && total > 0 && (
          <div
            className="mt-2 font-mono text-[10px] leading-4"
            style={{ color: TEXT_MUTED }}
          >
            {perLayer ? (
              <>
                {formatInt(node.params)} per layer · {formatCount(total)} across{" "}
                {CONFIG.numHiddenLayers} layers
              </>
            ) : (
              <>{formatCount(total)} params</>
            )}
            <br />
            {formatBytes(bytesOf(node.id))} at {CONFIG.dtype} ·{" "}
            {formatPercent(total / DERIVED.paramsTotal)} of the model
          </div>
        )}

        {node?.tiedTo && (
          <div
            className="mt-2 font-mono text-[10px] leading-4"
            style={{ color: accent(0.75) }}
          >
            Tied to {nodeById(node.tiedTo)?.label ?? node.tiedTo}: the same
            tensor, counted once.
          </div>
        )}

        {node?.note && (
          <div
            className="mt-2 text-[12px] leading-5"
            style={{ color: TEXT_MUTED }}
          >
            {node.note}
          </div>
        )}
      </div>
    </div>
  );
}

/** Position of a scope path in the index, so the card's ordinal matches the
 *  number the panel shows for the same entry. */
function indexOf(id: string): number | null {
  const i = INDEX.findIndex((e) => e.id === id);
  return i < 0 ? null : i;
}

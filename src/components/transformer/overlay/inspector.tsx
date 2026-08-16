"use client";

import { CONFIG } from "@/lib/transformer/config";
import {
  formatBytes,
  formatCount,
  formatInt,
  formatPercent,
  formatShape,
} from "@/lib/transformer/format";
import { SEQ_TOKENS } from "@/lib/transformer/layout";
import {
  DERIVED,
  bytesOf,
  isPerLayer,
  nodeById,
  totalParamsOf,
} from "@/lib/transformer/model";
import { useTransformerStore } from "@/lib/transformer/store";

/**
 * What the cursor is on.
 *
 * Everything here is read out of the model graph, so the panel and the object
 * beside it cannot disagree: both are computed from the same config. This is
 * also the piece that makes "hover to inspect" in the hint bar true rather than
 * aspirational.
 *
 * The per-layer note matters more than it looks. A projection's own parameter
 * count is one layer's worth, and the model has 28 of them; quoting only the
 * former understates the tensor by a factor of 28, and quoting only the latter
 * misdescribes the object you are pointing at. It says both.
 */
export function Inspector() {
  const hover = useTransformerStore((s) => s.hover);
  const node = hover ? nodeById(hover) : undefined;
  if (!node) return null;

  const perLayer = isPerLayer(node.id);
  const total = totalParamsOf(node.id);
  const bytes = bytesOf(node.id);

  return (
    <div className="pointer-events-none absolute bottom-6 left-1/2 w-[26rem] -translate-x-1/2 rounded-lg border border-white/10 bg-black/70 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[12px] tracking-[0.06em] text-white">
          {node.label}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
          {node.kind}
        </span>
      </div>

      <div className="mt-1 font-mono text-[11px] text-white/60">
        {formatShape(node.shape, SEQ_TOKENS)}
      </div>

      {total > 0 && (
        <div className="mt-1.5 font-mono text-[10px] leading-4 text-white/45">
          {perLayer ? (
            <>
              {formatInt(node.params)} per layer · {formatCount(total)} across{" "}
              {CONFIG.numHiddenLayers} layers
            </>
          ) : (
            <>{formatCount(total)} params</>
          )}
          <br />
          {formatBytes(bytes)} at {CONFIG.dtype} ·{" "}
          {formatPercent(total / DERIVED.paramsTotal)} of the model
        </div>
      )}

      {node.tiedTo && (
        <div className="mt-1.5 font-mono text-[10px] text-white/45">
          Tied to {nodeById(node.tiedTo)?.label ?? node.tiedTo}: the same tensor,
          counted once.
        </div>
      )}

      {node.note && (
        <div className="mt-2 text-[12px] leading-5 text-white/70">{node.note}</div>
      )}
    </div>
  );
}

"use client";

import { CONFIG } from "@/lib/transformer/config";
import { formatInt } from "@/lib/transformer/format";
import { INDEX, OVERVIEW_ID, entryById } from "@/lib/transformer/glossary";
import { PARAMS_PER_SQUARE_UNIT } from "@/lib/transformer/layout";
import { useTransformerStore } from "@/lib/transformer/store";
import { requestRefit } from "@/lib/transformer/view";
import { RULE, RULE_SOFT, TEXT, TEXT_FAINT, TEXT_MUTED } from "@/lib/transformer/theme";

/**
 * The title block, in the corner of the plate.
 *
 * WHAT IT REPLACED, AND WHY THAT MATTERED. There used to be a header bar across
 * the top (subject, then derived totals, then Reset view and Exit), a breadcrumb
 * in the corner of the canvas, and a status bar along the bottom with a dot and
 * the name of whatever was selected. All three came, element for element and in
 * places word for word, from gpu.kylejeong.com, which is the piece this one was
 * built in answer to. Same frame, same header, same `NN PARTS` index, same
 * `/path/breadcrumb`, same `● MODEL READY`. Different subject, different accent,
 * unmistakably the same instrument.
 *
 * A drawing does not have a header bar or a status bar. It has a title block in
 * one corner, and everything those three elements were doing is what a title
 * block is for: what this is, what it was drawn from, at what scale, which
 * figure you are looking at. Three regions of borrowed chrome collapse into one
 * that belongs to the register the geometry is already in.
 *
 * IT IS THE FOOT OF THE DETAIL COLUMN, not a floating panel. A block hovering
 * over the canvas would be the same mistake the hover card was: chrome drawn on
 * top of the thing it describes. In the column it is furniture, it costs the
 * model nothing, and it lands in the plate's bottom right corner because that is
 * where the column ends.
 *
 * Every value is derived. Nothing here is typed that `config.ts`, `layout.ts` or
 * the index does not already know.
 */

/** Label cell width. Fixed, so the values line up into a column rather than
 *  ragging with the label lengths. */
const LABEL_W = "5.5rem";

function Row({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  /** Rows that only earn their space when there is space: on a phone the block
   *  is the foot of a row that is already short. */
  wide?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline gap-3 px-3 py-1.5 ${wide ? "hidden lg:flex" : ""}`}
      style={{ borderTop: `1px solid ${RULE_SOFT}` }}
    >
      <span
        className="shrink-0 font-mono text-[9px] uppercase tracking-[0.18em]"
        style={{ width: LABEL_W, color: TEXT_FAINT }}
      >
        {label}
      </span>
      <span className="min-w-0 text-[12px] leading-5" style={{ color: TEXT_MUTED }}>
        {children}
      </span>
    </div>
  );
}

export function TitleBlock({ onExit }: { onExit: () => void }) {
  const focus = useTransformerStore((s) => s.focus);
  const setFocus = useTransformerStore((s) => s.setFocus);
  const layer = useTransformerStore((s) => s.layer);

  const id = focus ?? OVERVIEW_ID;
  const entry = entryById(id);
  const ordinal = INDEX.findIndex((e) => e.id === id) + 1;

  // "Block 15" only where it means something. Inside a station you are looking
  // at one layer's worth of machinery and which layer it is changes nothing you
  // can see, which is the same rule the layer stepper follows.
  const inBlock = id === "block";

  const home = () => {
    setFocus(null);
    requestRefit();
  };

  return (
    <div
      className="shrink-0"
      style={{ borderTop: `1px solid ${RULE}` }}
    >
      <Row label="Subject">
        <span style={{ color: TEXT }}>{CONFIG.name}</span>
      </Row>
      {/* No "drawn from" row. It said config.json, the dtype and the layer
          count, and all three are already in the detail column's own heading
          when the subject is the whole model. A title block states what a
          drawing cannot: the scale, and which figure this is. */}
      <Row label="Scale" wide>
        <span className="font-mono text-[11px]">
          1 unit² = {formatInt(PARAMS_PER_SQUARE_UNIT)} parameters
        </span>
      </Row>
      <Row label="Figure">
        <span className="font-mono text-[11px]">
          {String(ordinal).padStart(2, "0")}
        </span>
        <span style={{ color: TEXT }}>
          {" "}
          {entry?.label ?? "The stack"}
          {inBlock ? ` · block ${layer + 1}` : ""}
        </span>
      </Row>

      <div
        className="flex items-center justify-end gap-2 px-3 py-2"
        style={{ borderTop: `1px solid ${RULE_SOFT}` }}
      >
        <button
          type="button"
          onClick={home}
          className="px-2 py-1 text-[11px] leading-4 transition-colors"
          style={{ border: `1px solid ${RULE}`, color: TEXT_MUTED }}
        >
          Whole model
        </button>
        <button
          type="button"
          onClick={onExit}
          className="px-2 py-1 text-[11px] leading-4 transition-colors"
          style={{ border: `1px solid ${RULE}`, color: TEXT_MUTED }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

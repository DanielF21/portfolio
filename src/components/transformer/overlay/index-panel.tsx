"use client";

import { useCallback, useEffect, useRef } from "react";

import { INDEX, OVERVIEW_ID } from "@/lib/transformer/glossary";
import { useTransformerStore } from "@/lib/transformer/store";
import { requestRefit } from "@/lib/transformer/view";
import { RULE, RULE_SOFT, TEXT, TEXT_FAINT, TEXT_MUTED, accent } from "@/lib/transformer/theme";

import { EncodingKey } from "./key";

/**
 * The contents of the plate, and the piece's whole navigation model.
 *
 * Selecting an entry sets `focus` and asks for a re-frame. It never touches
 * `view.current`, and it never computes a pose: `auto-frame` measures what is in
 * scope and writes `view.desired`, which the rig chases. That is what lets a
 * drag take over mid-flight with no state to cancel and no mode to escape from.
 *
 * IT IS CONTENTS NOW, NOT AN INDEX PANEL, and the difference is the point. What
 * stood here was `INDEX` over `14 PARTS`, two digit ordinals in a gutter, and
 * fourteen rows of wide-tracked mono capitals with an accent bar down the active
 * one. That is gpu.kylejeong.com's component index, down to the phrasing, and it
 * is most of why the two pieces read as the same instrument.
 *
 * A printed contents list instead: names in the text face, indented by depth,
 * figure numbers in mono because they are numbers, a dotted leader between them
 * where there is width for one, and the current figure marked by setting its
 * name in the signal colour rather than by painting a bar beside it.
 */
/**
 * How long the cursor must rest on an entry before the camera goes there.
 *
 * HOVER NAVIGATES, and this is what stops that being chaos. Reaching the key at
 * the bottom of the panel means dragging the cursor down the whole list, and
 * without a dwell that flies the camera through all fourteen shots on the way.
 * Ninety milliseconds is below the threshold where a deliberate hover feels
 * delayed and well above the time a cursor spends passing over a row.
 */
const DWELL_MS = 90;

export function IndexPanel() {
  const focus = useTransformerStore((s) => s.focus);
  const setFocus = useTransformerStore((s) => s.setFocus);
  const setHover = useTransformerStore((s) => s.setHover);
  const current = focus ?? OVERVIEW_ID;

  /**
   * Keep the current entry in view.
   *
   * It matters most in the strip, where fourteen entries are far wider than a
   * phone and selecting from the 3D would otherwise mark a chip nobody can see.
   * It is right in the column too, for the same reason at the bottom of a short
   * window. `nearest` on both axes so it scrolls the minimum and never the page.
   */
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [current]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);

  const go = useCallback(
    (id: string) => {
      setFocus(id === OVERVIEW_ID ? null : id);
      requestRefit();
    },
    [setFocus]
  );

  return (
    /**
     * A COLUMN WHEN THERE IS ROOM, A STRIP WHEN THERE IS NOT. Below `lg` the
     * body stacks and this becomes a horizontally scrolling row of the same
     * fourteen entries, which is the one shape that costs a phone almost no
     * height. Nothing about the entries changes: same order, same ordinals, same
     * indent, same active mark, only turned through ninety degrees.
     */
    <nav
      aria-label="Model index"
      // The rule moves with the layout: underneath the strip, beside the column.
      // It is a Tailwind width plus an inline COLOUR because the palette is a JS
      // value and a breakpoint is not expressible in an inline style.
      className="flex min-h-0 min-w-0 flex-row overflow-x-auto overflow-y-hidden overscroll-contain border-b lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto lg:border-b-0 lg:border-r"
      style={{ borderColor: RULE }}
    >
      <div
        className="hidden px-4 pb-2 pt-3 text-[13px] font-medium leading-5 lg:block"
        style={{ borderBottom: `1px solid ${RULE_SOFT}`, color: TEXT }}
      >
        Contents
      </div>

      <div className="flex shrink-0 flex-row py-0 lg:flex-col lg:py-1">
        {INDEX.map((entry, i) => {
          const active = current === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              aria-current={active ? "true" : undefined}
              // THE DETAIL PANEL DOES NOT WAIT FOR THE DWELL. An index row and
              // the geometry it names are the same destination, so pointing at
              // either has to answer the same way; the dwell exists only to stop
              // the CAMERA flying through fourteen shots on the way to the key,
              // and text changing in a docked column has no such cost. Entry ids
              // are node ids, so this is the same value the pick layer writes.
              onPointerEnter={() => {
                cancel();
                setHover(entry.id);
                timer.current = setTimeout(() => go(entry.id), DWELL_MS);
              }}
              onPointerLeave={() => {
                cancel();
                setHover(null);
              }}
              // Still clickable, and a click does not wait: someone who commits
              // to the target should not be held to the dwell.
              onClick={() => {
                cancel();
                go(entry.id);
              }}
              ref={active ? activeRef : undefined}
              // The active mark is an EDGE, and which edge depends on the
              // layout: under the chip in a strip, beside the row in a column.
              // Same two pixels either way.
              className="group flex shrink-0 items-baseline gap-2 whitespace-nowrap px-3 py-2 text-left text-[13px] leading-5 transition-colors lg:w-full lg:gap-2 lg:px-4 lg:py-[3px]"
              style={{ color: active ? accent(1) : TEXT_MUTED }}
            >
              {/* The indent says what is inside what, and a strip has no room to
                  spend on it. */}
              <span
                className="lg:pl-[var(--depth)]"
                style={{ ["--depth" as string]: `${entry.depth * 12}px` }}
              >
                {entry.label}
              </span>
              {/* The leader, and it only exists where there is a width for it to
                  cross. A dotted rule between a name and its number is what a
                  printed contents page does with the space between them. */}
              <span
                className="hidden min-w-0 flex-1 translate-y-[-3px] border-b border-dotted lg:block"
                style={{ borderColor: active ? accent(0.5) : RULE }}
              />
              <span
                className="shrink-0 font-mono text-[11px] tabular-nums"
                style={{ color: active ? accent(0.8) : TEXT_FAINT }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
            </button>
          );
        })}
      </div>

      {/* Nothing in this scene is a picture of an object that exists, so the
          vocabulary has to be stated rather than recognised. See `key.tsx`.

          It cannot live in a horizontal strip, so below `lg` the detail panel
          carries it instead. Stated somewhere is the requirement; stated here is
          not. */}
      <EncodingKey className="hidden lg:block" />
    </nav>
  );
}

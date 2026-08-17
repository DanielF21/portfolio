"use client";

import { useCallback, useEffect, useRef } from "react";

import { INDEX, OVERVIEW_ID } from "@/lib/transformer/glossary";
import { useTransformerStore } from "@/lib/transformer/store";
import { requestRefit } from "@/lib/transformer/view";
import { RULE, RULE_SOFT, TEXT, TEXT_FAINT, TEXT_MUTED, accent } from "@/lib/transformer/theme";

import { EncodingKey } from "./key";

/**
 * The clickable index, and the piece's whole navigation model.
 *
 * Selecting an entry sets `focus` and asks for a re-frame. It never touches
 * `view.current`, and it never computes a pose: `auto-frame` measures what is in
 * scope and writes `view.desired`, which the rig chases. That is what lets a
 * drag take over mid-flight with no state to cancel and no mode to escape from.
 *
 * This is a REGION now rather than fourteen lines of text floating on the
 * canvas. The difference is not decoration: an unbacked column of 11px labels
 * over a 3D scene reads as debug output, and it was a large part of why the
 * piece looked unfinished. Giving it a surface, a rule down its edge, ordinals
 * and hover states costs nothing and makes the left third of the frame a place
 * rather than an emptiness.
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
    <nav
      aria-label="Model index"
      className="flex min-h-0 flex-col overflow-y-auto overscroll-contain"
      style={{ borderRight: `1px solid ${RULE}` }}
    >
      <div
        className="flex items-baseline justify-between px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em]"
        style={{ borderBottom: `1px solid ${RULE_SOFT}`, color: accent(0.75) }}
      >
        <span>Index</span>
        <span style={{ color: TEXT_FAINT }}>
          {String(INDEX.length).padStart(2, "0")} parts
        </span>
      </div>

      <div className="flex flex-col py-1">
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
              className="group flex items-baseline gap-3 px-4 py-[5px] text-left font-mono text-[11px] leading-4 tracking-[0.04em] transition-colors"
              style={{
                color: active ? TEXT : TEXT_MUTED,
                background: active ? accent(0.14) : "transparent",
                borderLeft: `2px solid ${active ? accent(1) : "transparent"}`,
              }}
            >
              <span
                className="shrink-0 tabular-nums"
                style={{ color: active ? accent(0.9) : TEXT_FAINT }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span style={{ paddingLeft: `${entry.depth * 12}px` }}>
                {entry.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Nothing in this scene is a picture of an object that exists, so the
          vocabulary has to be stated rather than recognised. See `key.tsx`. */}
      <EncodingKey />
    </nav>
  );
}

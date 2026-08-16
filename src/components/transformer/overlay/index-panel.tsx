"use client";

import { INDEX, OVERVIEW_ID } from "@/lib/transformer/glossary";
import { useTransformerStore } from "@/lib/transformer/store";
import { requestRefit } from "@/lib/transformer/view";
import { RULE, RULE_SOFT, TEXT, TEXT_FAINT, TEXT_MUTED, accent } from "@/lib/transformer/theme";

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
export function IndexPanel() {
  const focus = useTransformerStore((s) => s.focus);
  const setFocus = useTransformerStore((s) => s.setFocus);
  const current = focus ?? OVERVIEW_ID;

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
              onClick={() => {
                setFocus(entry.id === OVERVIEW_ID ? null : entry.id);
                requestRefit();
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
    </nav>
  );
}

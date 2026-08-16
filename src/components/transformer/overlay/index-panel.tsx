"use client";

import { INDEX, OVERVIEW_ID } from "@/lib/transformer/glossary";
import { useTransformerStore } from "@/lib/transformer/store";
import { view } from "@/lib/transformer/view";

/**
 * The clickable index, and the piece's whole navigation model.
 *
 * Selecting an entry does exactly two things: it sets `focus`, which decides
 * what is drawn, and it writes `view.desired`, which the rig chases. It never
 * touches `view.current`. That is what lets a drag take over mid-flight with no
 * state to cancel and no mode to escape from.
 */
export function IndexPanel() {
  const focus = useTransformerStore((s) => s.focus);
  const setFocus = useTransformerStore((s) => s.setFocus);

  const current = focus ?? OVERVIEW_ID;

  return (
    <nav
      aria-label="Model index"
      className="pointer-events-auto absolute left-6 top-1/2 flex w-56 -translate-y-1/2 flex-col gap-[3px]"
    >
      {INDEX.map((entry) => {
        const active = current === entry.id;
        return (
          <button
            key={entry.id}
            type="button"
            aria-current={active ? "true" : undefined}
            onClick={() => {
              setFocus(entry.id === OVERVIEW_ID ? null : entry.id);
              view.desired = entry.pose;
            }}
            className={`text-left font-mono text-[11px] leading-5 tracking-[0.06em] transition-colors ${
              active ? "text-white" : "text-white/35 hover:text-white/75"
            }`}
            style={{ paddingLeft: `${entry.depth * 14}px` }}
          >
            {active ? "› " : ""}
            {entry.label}
          </button>
        );
      })}
    </nav>
  );
}

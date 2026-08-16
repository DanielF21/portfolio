"use client";

import { INDEX, OVERVIEW_ID } from "@/lib/transformer/glossary";
import { useTransformerStore } from "@/lib/transformer/store";
import { requestRefit } from "@/lib/transformer/view";

/**
 * The clickable index, and the piece's whole navigation model.
 *
 * Selecting an entry sets `focus` and asks for a re-frame. It never touches
 * `view.current`, and it never computes a pose: `auto-frame` measures what is
 * in scope and writes `view.desired`, which the rig chases. That is what lets a
 * drag take over mid-flight with no state to cancel and no mode to escape from.
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
              // Setting focus is the whole action. What is drawn follows from
              // it, and so does the camera: `auto-frame` measures the new scope
              // and writes `view.desired` on the next frame. Clicking the entry
              // you are already on still re-frames, via the refit counter.
              setFocus(entry.id === OVERVIEW_ID ? null : entry.id);
              requestRefit();
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

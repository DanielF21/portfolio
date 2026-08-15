"use client";

import { useEffect, useRef, useState } from "react";

import { held } from "@/lib/planet/input";

import { StaminaBar } from "./stamina-bar";

/**
 * The control scheme, drawn as keys that light up when you press them.
 *
 * This replaces a sentence ("WASD to walk, Shift to sprint...") that testers
 * read once and then ignored. A key that visibly responds teaches the mapping
 * in the first second of walking, and doubles as feedback that input is being
 * received at all.
 *
 * Driven by an rAF loop mutating styles directly, never by React state. That
 * is the same technique `compass-chevrons.tsx` and the touch joystick use, and
 * it is worth keeping here for a different reason than theirs: a key repeat or
 * a fast tap-tap-tap would otherwise push a render through the whole overlay
 * tree per edge. The loop writes only on a change, so a held key costs nothing.
 *
 * This file must not import `three`; it reads plain booleans out of the input
 * singleton.
 */

const STORAGE_KEY = "planet:key-hints";

/** Jump is edge triggered (`input.jump` is consumed within one frame), so the
 *  cap is lit off a timestamp for long enough to actually see. */
const JUMP_FLASH_MS = 150;

type CapId = "fwd" | "left" | "back" | "right" | "sprint" | "jump";

interface Cap {
  readonly id: CapId;
  /** Top line: the key itself, in its most iconic form. */
  readonly glyph: string;
  /** Bottom line: the alternate binding for the movement caps (both WASD and
   *  the arrows work), the action for the modifiers. */
  readonly letter: string;
  readonly width?: number;
}

const SIZE = 40;

const FWD: Cap = { id: "fwd", glyph: "▲", letter: "W" };
const ROW: readonly Cap[] = [
  { id: "left", glyph: "◀", letter: "A" },
  { id: "back", glyph: "▼", letter: "S" },
  { id: "right", glyph: "▶", letter: "D" },
];
const MODS: readonly Cap[] = [
  { id: "sprint", glyph: "⇧", letter: "SPRINT", width: 74 },
  { id: "jump", glyph: "SPACE", letter: "JUMP", width: 106 },
];

function isDown(id: CapId, now: number): boolean {
  if (id === "jump") return now - held.jumpAt < JUMP_FLASH_MS;
  return held[id];
}

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "hidden";
  } catch {
    // Safari private mode throws on localStorage access. Default to visible.
    return true;
  }
}

function store(visible: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, visible ? "shown" : "hidden");
  } catch {
    // Non-fatal: the preference just does not survive the session.
  }
}

export function KeyHints() {
  const [visible, setVisible] = useState(true);
  const refs = useRef(new Map<CapId, HTMLDivElement>());
  /** Last applied state per cap, so the loop only touches the DOM on an edge. */
  const applied = useRef(new Map<CapId, boolean>());

  // `H` is a UI binding, not a movement one, so it is deliberately NOT added to
  // the key sets in lib/planet/input.ts. Those preventDefault and feed the
  // render loop; this only flips a local boolean.
  useEffect(() => {
    setVisible(readStored());

    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyH" || e.repeat) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      setVisible((v) => {
        store(!v);
        return !v;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!visible) return;
    applied.current.clear();

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();

      refs.current.forEach((el, id) => {
        const down = isDown(id, now);
        if (applied.current.get(id) === down) return;
        applied.current.set(id, down);

        el.style.borderColor = down
          ? "rgba(255,255,255,0.95)"
          : "rgba(255,255,255,0.34)";
        el.style.background = down ? "rgba(255,255,255,0.18)" : "transparent";
        el.style.color = down ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.62)";
        // Pressing collapses the offset outline into the cap, so it reads as
        // the key travelling down rather than just changing colour.
        el.style.transform = down ? "translate(2px, 2px)" : "translate(0, 0)";
        el.style.boxShadow = down
          ? "0 0 0 0 rgba(255,255,255,0)"
          : "2px 2px 0 0 rgba(255,255,255,0.14)";
      });
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  const cap = (c: Cap) => (
    <div
      key={c.id}
      ref={(el) => {
        if (el) refs.current.set(c.id, el);
        else refs.current.delete(c.id);
      }}
      className="flex select-none flex-col items-center justify-center rounded-[11px] border-[1.5px] leading-none transition-colors duration-100"
      style={{
        width: c.width ?? SIZE,
        height: SIZE,
        borderColor: "rgba(255,255,255,0.34)",
        color: "rgba(255,255,255,0.62)",
        boxShadow: "2px 2px 0 0 rgba(255,255,255,0.14)",
      }}
    >
      {c.glyph && <span className="text-[11px]">{c.glyph}</span>}
      <span
        className={`font-medium tracking-wide ${
          c.glyph ? "mt-[3px] text-[8px]" : "text-[9px]"
        }`}
      >
        {c.letter}
      </span>
    </div>
  );

  if (!visible) {
    // The stamina bar stays even with the hints hidden: it reports state, not
    // a binding, and hiding the controls should not hide how much sprint is
    // left. It renders as nothing at all while the meter is full.
    return (
      <div className="absolute bottom-6 left-6">
        <StaminaBar />
        <div className="text-[10px] text-white/35">
          <kbd className="rounded border border-white/25 px-1 py-0.5 font-mono text-[9px] text-white/50">
            H
          </kbd>{" "}
          controls
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-6 left-6 flex flex-col gap-2" aria-hidden>
      <div className="flex flex-col items-center gap-1.5">
        {cap(FWD)}
        <div className="flex gap-1.5">{ROW.map(cap)}</div>
      </div>

      {/* Sits directly above the SPRINT key it belongs to, rather than
          somewhere else on screen, so the connection needs no label. */}
      <StaminaBar />

      <div className="flex gap-1.5">{MODS.map(cap)}</div>

      {/* The two controls with no key to draw, plus the toggle. */}
      <div className="text-[10px] leading-relaxed text-white/45">
        drag to look · scroll to zoom
        <br />
        <kbd className="rounded border border-white/20 px-1 py-0.5 font-mono text-[9px] text-white/40">
          H
        </kbd>{" "}
        to hide
      </div>
    </div>
  );
}

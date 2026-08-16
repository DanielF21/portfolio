"use client";

import { CONFIG } from "@/lib/transformer/config";
import { formatBytes, formatCount } from "@/lib/transformer/format";
import { OVERVIEW_ID } from "@/lib/transformer/glossary";
import { DERIVED } from "@/lib/transformer/model";
import { useTransformerStore } from "@/lib/transformer/store";
import { requestRefit } from "@/lib/transformer/view";

import { IndexPanel } from "./index-panel";
import { Inspector } from "./inspector";
import { Labels } from "./labels";

/**
 * The DOM layer over the canvas.
 *
 * `pointer-events-none` at the root with individual controls opting back in, so
 * drag and wheel still reach the canvas everywhere except on an actual control.
 * Same arrangement as the planet's HUD and for the same reason.
 */

interface Props {
  onExit: () => void;
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
      {children}
    </span>
  );
}

export function Hud({ onExit }: Props) {
  const layer = useTransformerStore((s) => s.layer);
  const setLayer = useTransformerStore((s) => s.setLayer);
  const focus = useTransformerStore((s) => s.focus);
  const setFocus = useTransformerStore((s) => s.setFocus);
  const hover = useTransformerStore((s) => s.hover);
  const mode = useTransformerStore((s) => s.mode);
  const tokens = useTransformerStore((s) => s.tokens);
  const setMode = useTransformerStore((s) => s.setMode);
  const step = useTransformerStore((s) => s.step);

  const home = () => {
    setFocus(null);
    requestRefit();
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20 text-white">
      <Labels />

      {/* Identity. Every figure is derived, never typed. */}
      <div className="absolute left-6 top-5">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/80">
          {CONFIG.name}
        </div>
        <div className="mt-1 font-mono text-[10px] tracking-[0.1em] text-white/40">
          {formatCount(DERIVED.paramsTotal)} params · {CONFIG.numHiddenLayers} layers ·{" "}
          {formatBytes(DERIVED.weightBytes)}
        </div>
      </div>

      <button
        type="button"
        onClick={onExit}
        className="pointer-events-auto absolute right-6 top-5 rounded-full border border-white/15 bg-black/40 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/70 transition hover:border-white/35 hover:text-white"
      >
        Exit
      </button>

      <IndexPanel />

      {/* Which of the 28 is open. Only meaningful while the stack is in view;
          inside a station you are looking at one layer's worth of machinery and
          which layer it is does not change what you see. */}
      {(focus === null || focus === OVERVIEW_ID || focus === "block") && (
        <div className="pointer-events-auto absolute bottom-20 left-6 flex items-center gap-2">
          <Hint>
            Block {layer + 1} / {CONFIG.numHiddenLayers}
          </Hint>
          <button
            type="button"
            onClick={() => setLayer(layer - 1)}
            className="rounded border border-white/15 px-2 font-mono text-xs text-white/60 transition hover:text-white"
            aria-label="Previous block"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => setLayer(layer + 1)}
            className="rounded border border-white/15 px-2 font-mono text-xs text-white/60 transition hover:text-white"
            aria-label="Next block"
          >
            +
          </button>
        </div>
      )}

      {/* Prefill and decode. Only offered in the cache view, because the
          difference between them IS a statement about the cache: prefill fills
          every column at once, decode adds one at a time. */}
      {focus === "kv" && (
        <div className="pointer-events-auto absolute bottom-24 left-1/2 flex -translate-x-1/2 items-center gap-4">
          <div className="flex gap-3">
            {(["prefill", "decode"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`font-mono text-[11px] uppercase tracking-[0.14em] transition ${
                  mode === m ? "text-white" : "text-white/35 hover:text-white/70"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={step}
            className="rounded-full border border-white/20 px-4 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/70 transition hover:border-white/40 hover:text-white"
          >
            {mode === "prefill" ? (tokens === 0 ? "Run prefill" : "Clear") : "Decode one token"}
          </button>
        </div>
      )}

      <Inspector />

      {/* The hints and the inspector share the bottom centre, so the hints step
          aside rather than sitting under it. */}
      {hover === null && (
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-6">
          <Hint>Drag to rotate</Hint>
          <Hint>Scroll to zoom</Hint>
          <Hint>Hover to inspect</Hint>
        </div>
      )}

      <button
        type="button"
        onClick={home}
        className="pointer-events-auto absolute bottom-6 right-6 font-mono text-[10px] uppercase tracking-[0.16em] text-white/40 underline-offset-4 transition hover:text-white/80 hover:underline"
      >
        Reset view
      </button>
    </div>
  );
}

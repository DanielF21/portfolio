"use client";

import {
  ACTIVATION,
  CACHE,
  OP_LINE,
  RULE_SOFT,
  TEXT_MUTED,
  WEIGHT,
  accent,
} from "@/lib/transformer/theme";

/**
 * What the shapes mean.
 *
 * THE REFERENCE THIS PIECE ANSWERS DOES NOT NEED ONE. Its subject is an object
 * that exists: a reader who has never seen an H100 still knows what a circuit
 * board and a heatsink are, so its geometry arrives already interpreted. Nothing
 * here has a physical form. A weight matrix is a rectangle of numbers and any
 * shape at all is a choice, so the choices have to be stated or the reader is
 * guessing at a vocabulary and cannot tell a claim from a decoration.
 *
 * Four rows, and the first one is the one that matters. Every other row is a
 * colour convention, which a reader would eventually infer. "Area is parameter
 * count" is not inferable and is the single thing the geometry is FOR: it is why
 * the MLP dwarfs attention, why K and V are a sixth of Q, and why gate, up and
 * down come out the same size. Unstated, all of that is just drawing.
 *
 * The two departures are named too, because a rule with silent exceptions is
 * worse than no rule.
 */

/**
 * Terms only, no glosses, wrapped inline.
 *
 * The first version gave each row a sentence and came to five stacked lines,
 * which pushed the whole key below the fold of a panel that already holds
 * fourteen index entries. A key nobody scrolls to is not a key. What a colour
 * legend has to do is attach a name to a hue; the detail belongs to the card,
 * which says it for whatever the cursor is on.
 */
function Term({ swatch, children }: { swatch: React.CSSProperties; children: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className="block h-2 w-2 shrink-0" style={swatch} />
      <span style={{ color: TEXT_MUTED }}>{children}</span>
    </li>
  );
}

export function EncodingKey({ className = "" }: { className?: string }) {
  return (
    <div
      // `className` is how it gets shown in one column and hidden in the other:
      // the index carries it where there is a column to carry it, the detail
      // panel carries it on a phone. See `index-panel.tsx`.
      className={`mt-auto px-4 py-2.5 ${className}`}
      style={{ borderTop: `1px solid ${RULE_SOFT}` }}
    >
      <div
        className="pb-1.5 font-mono text-[10px] uppercase tracking-[0.16em]"
        style={{ color: accent(0.75) }}
      >
        Key
      </div>

      <ul className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] leading-4">
        <Term swatch={{ background: WEIGHT, outline: `1px solid ${OP_LINE}` }}>
          Weights
        </Term>
        {/* ONE ROW, NOT TWO. `ACTIVATION` and `STREAM` are the same hex, and
            they should be: the residual stream IS an activation, the one that
            survives the whole forward pass instead of a single station. Listing
            them separately with identical swatches would be a legend claiming a
            distinction the scene does not draw. */}
        <Term swatch={{ background: ACTIVATION }}>Activations, and the stream</Term>
        <Term swatch={{ background: CACHE }}>KV cache</Term>
        <Term swatch={{ border: `1px solid ${OP_LINE}` }}>Not to scale</Term>
      </ul>
    </div>
  );
}

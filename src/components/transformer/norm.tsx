"use client";

import { CONFIG } from "@/lib/transformer/config";
import {
  BLOCK_BASELINE,
  MIN_AXIS,
  SEQ_HEIGHT,
  SEQ_TOKENS,
  SLAB_DEPTH,
  widthFor,
} from "@/lib/transformer/layout";

import { Anchor } from "./anchor";
import { TensorSlab } from "./tensor-slab";

const { hiddenSize } = CONFIG;

/**
 * A normalisation station: what goes through it, and the gains that scale it.
 *
 * THE PARAMETER ALONE WAS NOT A PICTURE. RMSNorm's learned part is one vector of
 * 1536 gains, so drawn honestly it is a 3.0 x 0.16 bar, and a 3.0 x 0.16 bar
 * standing on a 0.6 wide tap is a letter T. That was fair comment: seen on its
 * own it was two boxes at right angles and nothing about it said "normalise".
 *
 * What was missing is that a norm is an OPERATION ON SOMETHING, and the
 * something was not drawn. So the station is the slice of residual stream
 * passing through it, at the stream's true width and the same sequence height
 * every other activation in the scene uses, with the gain vector lying across
 * the top of it. The bar is unchanged and still the only weight here; it now has
 * the thing it scales underneath it, which is both the missing picture and the
 * reason the station has a shape at all.
 *
 * THE BAR IS STILL THE ONE PLACE THE AREA RULE IS BROKEN AT THE BOTTOM END, so
 * it is still broken loudly. A [1536] vector's true second axis is
 * `heightFor(1)` = 0.002 units, sub-pixel at every distance and impossible to
 * put a cursor on, so it is drawn at `MIN_AXIS` and the `floored` flag gives it
 * the same visible break the elided axes use. An overstatement the viewer can
 * see is honest and a silent one is not.
 *
 * The width was also wrong once, and separately: it used `BLOCK_W` (4.2) for a
 * 1,536 wide tensor where `widthFor(1536)` is 3.0, a 40% overstatement of
 * `layout.ts`'s central rule with nothing in the codebase flagging it.
 */
export function RmsNorm({
  nodeId,
  label,
}: {
  nodeId: string;
  label: string;
}) {
  const w = widthFor(hiddenSize);
  return (
    <>
      {/* What is being normalised. Not a new claim: the stream is [seq, 1536]
          and this is drawn at exactly that, the same as every other activation
          in the block. */}
      <TensorSlab
        nodeId="stream"
        kind="activation"
        rows={SEQ_TOKENS}
        cols={hiddenSize}
        size={[w, SEQ_HEIGHT, 0.3]}
        position={[0, BLOCK_BASELINE + SEQ_HEIGHT / 2, 0]}
      />

      {/* The learned gains, lying across the top of it. One per channel, which
          is why it runs the full width and has no second axis of its own. */}
      <TensorSlab
        nodeId={nodeId}
        rows={1}
        cols={hiddenSize}
        floored
        size={[w, MIN_AXIS, SLAB_DEPTH]}
        position={[0, BLOCK_BASELINE + SEQ_HEIGHT + MIN_AXIS / 2, 0]}
      />

      <Anchor
        id={nodeId}
        text={label}
        position={[w / 2, BLOCK_BASELINE + SEQ_HEIGHT + MIN_AXIS, 0]}
      />
    </>
  );
}

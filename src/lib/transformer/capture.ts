/**
 * The recorded forward pass, if there is one.
 *
 * `scripts/capture-transformer.py` produces
 * `public/things/transformer/capture.json`. It is NOT required: the scene draws
 * its whole structure from the config, and this only supplies real values on
 * top. Everything here is written so that a missing file is an ordinary state
 * rather than an error, because the file is 3 GB of model download away and
 * will often not be there.
 *
 * HONESTY. A capture is one prompt through one model, once. Anything drawn from
 * it is labelled with the prompt it came from, and nothing invented is ever
 * substituted when it is absent: the score grid falls back to a flat triangle,
 * which says "structure known, values not loaded" rather than pretending.
 *
 * This file must never import `three`.
 */

export interface Capture {
  readonly model: string;
  readonly prompt: string;
  readonly seq: number;
  readonly layers: number;
  readonly heads: number;
  readonly tokens: readonly string[];
  readonly tokenIds: readonly number[];
  /** base64 u8, [layer][head][query][key] row major, value = byte / 255. */
  readonly attn: string;
  readonly streamNorm: readonly (readonly number[])[];
  readonly topLogits: readonly { id: number; text: string; prob: number }[];
}

export interface LoadedCapture extends Omit<Capture, "attn"> {
  /** Decoded attention, values 0..1. */
  readonly attn: Float32Array;
}

const URL = "/things/transformer/capture.json";

let pending: Promise<LoadedCapture | null> | null = null;

function decodeAttn(b64: string): Float32Array {
  const bin = atob(b64);
  const out = new Float32Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) / 255;
  return out;
}

/**
 * Load it once, or resolve null.
 *
 * The promise is cached including the null case, so a missing capture is
 * fetched once per session rather than on every component that asks.
 */
export function loadCapture(): Promise<LoadedCapture | null> {
  if (pending) return pending;
  pending = fetch(URL)
    .then((r) => (r.ok ? (r.json() as Promise<Capture>) : null))
    .then((raw) => {
      if (!raw) return null;
      const expected = raw.layers * raw.heads * raw.seq * raw.seq;
      const attn = decodeAttn(raw.attn);
      if (attn.length !== expected) {
        // A capture whose shape disagrees with its own header is worse than no
        // capture: it would silently index into the wrong head.
        console.warn(
          `[transformer] capture has ${attn.length} attention values, header says ${expected}; ignoring it`
        );
        return null;
      }
      return { ...raw, attn };
    })
    .catch(() => null);
  return pending;
}

/** One head's attention as a seq*seq slice, or null. */
export function headAttention(
  cap: LoadedCapture,
  layer: number,
  head: number
): Float32Array | null {
  if (layer < 0 || layer >= cap.layers || head < 0 || head >= cap.heads) return null;
  const stride = cap.seq * cap.seq;
  const start = (layer * cap.heads + head) * stride;
  return cap.attn.subarray(start, start + stride);
}

/** Forget the cached load. Called when the stage unmounts, since this module
 *  outlives it. */
export function resetCapture(): void {
  pending = null;
}

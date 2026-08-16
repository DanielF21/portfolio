/**
 * How numbers are written on screen.
 *
 * Shared by the in-scene sprite labels and the DOM inspector so a shape never
 * reads two different ways in two places. Locale is pinned to en-US rather than
 * left to the visitor's, because "1 536" and "1,536" showing up in the same
 * frame looks like a bug.
 *
 * IMPORTANT: this file must never import `three`. It is pulled in by the DOM
 * overlay, which is loaded eagerly.
 */

import type { Dim } from "./model";

const LOCALE = "en-US";

/**
 * Round to `sig` significant figures, dropping only zeros that sit AFTER a
 * decimal point. 41.29 at 3 becomes "41.3"; 2.00 becomes "2".
 *
 * The guard on `decimals > 0` is load bearing and was missing. Without it the
 * strip also eats trailing zeros of whole numbers, so 420 rendered as "42" and
 * 100 as "1". It first showed up as a KV cache of 15 tokens reporting 42 KiB
 * instead of 420, which is exactly the kind of quiet wrongness this piece is
 * built to not have.
 */
function sigFigs(n: number, sig: number): string {
  if (n === 0) return "0";
  const magnitude = Math.floor(Math.log10(Math.abs(n)));
  const decimals = Math.max(0, sig - 1 - magnitude);
  const fixed = n.toFixed(decimals);
  return decimals > 0 ? fixed.replace(/\.?0+$/, "") : fixed;
}

/** Full precision with thousands separators: "1,543,714,304". For places where
 *  the exact count is the point. */
export function formatInt(n: number): string {
  return Math.round(n).toLocaleString(LOCALE);
}

/**
 * Parameter counts the way model cards write them: "1.54B", "233M", "41.3M".
 * Anything under ten thousand is left exact, because "1.54K" for 1,536 is worse
 * than the number itself.
 */
export function formatCount(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${sigFigs(n / 1e9, 3)}B`;
  if (abs >= 1e6) return `${sigFigs(n / 1e6, 3)}M`;
  if (abs >= 1e4) return `${sigFigs(n / 1e3, 3)}K`;
  return formatInt(n);
}

const BINARY_UNITS = ["B", "KiB", "MiB", "GiB", "TiB"] as const;

/**
 * Binary units, because this is memory. A KV cache quoted in KB when it is
 * really KiB is off by 2.4%, which is not much until it is a capacity plan.
 */
export function formatBytes(n: number): string {
  let value = Math.abs(n);
  let unit = 0;
  while (value >= 1024 && unit < BINARY_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const sign = n < 0 ? "-" : "";
  return `${sign}${sigFigs(value, 3)} ${BINARY_UNITS[unit]}`;
}

/**
 * "151936 × 1536", or "seq × 1536" when a dimension is symbolic.
 *
 * `seq` substitutes a concrete sequence length when one is known, so the same
 * node reads "12 × 1536" once there are twelve tokens on screen.
 */
export function formatShape(shape: readonly Dim[], seq?: number): string {
  if (shape.length === 0) return "";
  return shape
    .map((d) => {
      if (typeof d === "number") return formatInt(d);
      if (d === "seq" && seq !== undefined) return formatInt(seq);
      return d;
    })
    .join(" × ");
}

/** "88%", "10.0%". One decimal below 10 so small shares stay distinguishable. */
export function formatPercent(fraction: number): string {
  const pct = fraction * 100;
  return pct < 10 ? `${pct.toFixed(1)}%` : `${Math.round(pct)}%`;
}

/** "6x", for ratios like the GQA saving. */
export function formatRatio(x: number): string {
  return `${sigFigs(x, 3)}×`;
}

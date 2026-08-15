/**
 * The fixed hue set from globals.css.
 *
 * Lives here rather than in `things.ts` because writing series pick from the
 * same set. A thing and a series both publish a hue to their subtree and both
 * read it back through the `thing` colour in tailwind.config.ts, so there is
 * exactly one palette on the site and no caller ever invents a colour value.
 *
 * `things.ts` re-exports both of these, so existing imports keep working.
 */

/** A thing or a series picks one of these and never a free colour value: they
 *  all sit in one narrow lightness and saturation band, so at thirty items an
 *  index reads as a designed spectrum rather than a paint spill. */
export type Hue =
  | "amber"
  | "orange"
  | "rose"
  | "magenta"
  | "violet"
  | "indigo"
  | "blue"
  | "cyan"
  | "teal"
  | "green"
  | "lime"
  | "slate";

/** Inline style that publishes a hue to its subtree. Everything inside reads it
 *  via the `thing` colour in tailwind.config.ts. */
export function hueStyle(hue: Hue): React.CSSProperties {
  return { "--thing": `var(--hue-${hue})` } as React.CSSProperties;
}

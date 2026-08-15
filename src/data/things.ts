/**
 * The collection.
 *
 * Things are interactive toys. They are not portfolio pieces and they are not
 * resume bullets: most exist because they were fun to build. Career evidence
 * lives on /work, deliberately in a different register.
 *
 * ADDING A THING (the whole checklist):
 *   1. a component directory under src/components/things/<slug>/
 *   2. one entry below
 *   3. one line in src/components/things/loaders.tsx
 *   4. a poster at public/things/<slug>/poster.png
 *   5. optionally content/things/<slug>.mdx for prose
 * No route file, no home page edit, no nav edit. The newest `shipped` date
 * takes the featured slot automatically.
 *
 * Pure data, no JSX, so this is importable from server components.
 */

/** The fixed hue set from globals.css. A thing picks one of these and never a
 *  free colour value: they all sit in one narrow lightness and saturation band
 *  so that at thirty items the index reads as a designed spectrum. */
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

export interface Poster {
  readonly src: string;
  readonly width: number;
  readonly height: number;
}

export interface Thing {
  readonly slug: string;
  readonly title: string;
  /** One sentence. Used on the index row and as the page's OG description. */
  readonly blurb: string;
  /** ISO date. The sole input to ordering and to "newest". */
  readonly shipped: string;
  readonly hue: Hue;
  readonly poster: Poster;

  /**
   * How the thing occupies its own page.
   *  - "inline": mounts directly in a stage on the page.
   *  - "immersive": shows a poster and an Enter button, then takes the screen.
   */
  readonly stage: "inline" | "immersive";

  /**
   * What the tile shows before you click through.
   *  - "none": poster only.
   *  - "video": a short muted loop. Right answer for anything whose real
   *    preview would cost a large JS chunk.
   *  - "live": the actual thing, running, with input disabled.
   */
  readonly preview: "none" | "video" | "live";

  /** "heavy" means it owns a WebGL context. The live budget treats heavy as
   *  exclusive. Defaults to "light". */
  readonly weight?: "light" | "heavy";

  /** false keeps a thing out of the big featured slot regardless of date. */
  readonly feature?: boolean;

  readonly tech?: readonly string[];
  readonly links?: readonly { label: string; href: string }[];
}

export const THINGS: readonly Thing[] = [
  {
    slug: "planet",
    title: "Planet",
    blurb: "A small world you can walk around.",
    shipped: "2026-08-14",
    hue: "violet",
    poster: { src: "/things/planet/poster.png", width: 1600, height: 1000 },
    stage: "immersive",
    // "none" until a loop exists at public/things/planet/preview.webm; then
    // change this word to "video" and it turns on.
    //
    // Deliberately NOT "live", even though the machinery supports it. The
    // planet's assets are only 784KB, but three.js, drei, and R3F together are
    // north of 200KB gzipped, which is far too much to pull onto the home page
    // for an ambient loop. A three second 720p webm looks the same and costs a
    // tenth of it.
    preview: "none",
    weight: "heavy",
    tech: ["Three.js", "React Three Fiber", "WebGL"],
  },
  {
    slug: "chess",
    title: "Chess bot",
    blurb: "A convolutional net trained on over a million lichess games.",
    shipped: "2024-09-01",
    hue: "amber",
    poster: { src: "/things/chess/poster.png", width: 1600, height: 1000 },
    stage: "inline",
    preview: "live",
    tech: ["PyTorch", "chess.js", "Flask"],
    links: [
      {
        label: "Source",
        href: "https://github.com/DanielF21/Chess-Bot",
      },
    ],
  },
  {
    slug: "scheme",
    title: "Scheme interpreter",
    blurb: "A Scheme interpreter with a live REPL.",
    shipped: "2022-12-01",
    hue: "cyan",
    poster: { src: "/things/scheme/poster.png", width: 1600, height: 1000 },
    stage: "inline",
    preview: "live",
    tech: ["Python", "Flask"],
    links: [
      {
        label: "Source",
        href: "https://github.com/DanielF21/Scheme-Interpreter",
      },
    ],
  },
];

/** Newest first. `localeCompare` on ISO strings avoids the timezone drift you
 *  get from parsing these into Dates. */
export function things(): Thing[] {
  return [...THINGS].sort((a, b) => b.shipped.localeCompare(a.shipped));
}

export function featuredThing(): Thing | undefined {
  return things().find((t) => t.feature !== false);
}

/** Everything except whatever is currently featured. */
export function restOfThings(): Thing[] {
  const featured = featuredThing();
  return things().filter((t) => t.slug !== featured?.slug);
}

export function thingBySlug(slug: string): Thing | undefined {
  return THINGS.find((t) => t.slug === slug);
}

/** Inline style that publishes a thing's hue to its subtree. Everything inside
 *  reads it via the `thing` colour in tailwind.config.ts. */
export function hueStyle(hue: Hue): React.CSSProperties {
  return { "--thing": `var(--hue-${hue})` } as React.CSSProperties;
}

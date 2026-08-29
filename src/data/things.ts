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

/** The hue set moved to `hues.ts` when writing series started picking from it
 *  too. Re-exported here so every existing `from "@/data/things"` import of
 *  `Hue` or `hueStyle` keeps working. */
export { hueStyle, type Hue } from "@/data/hues";

import type { Hue } from "@/data/hues";

export interface Poster {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  /**
   * What the picture shows, for a reader who cannot see it.
   *
   * Both places that render a poster passed `alt=""`, which declares an image
   * decorative. For an index row beside a title that is defensible; for the
   * poster on a thing's own page it is not, because on the two immersive
   * pieces that image IS the piece until someone presses Enter, and the page's
   * entire description of what is on screen was one blurb.
   *
   * Describes the frame, not the idea. "An interactive diagram" is what the
   * blurb already says; "28 dark plates receding along an orange stream" is
   * what is actually in the picture.
   */
  readonly alt: string;
}

export interface Thing {
  readonly slug: string;
  readonly title: string;
  /** One sentence. The index row and the line under the page's title. */
  readonly blurb: string;

  /** The page's meta description, 140 to 160 characters.
   *
   *  Separate from `blurb` for a reason specific to this collection: a blurb is
   *  a label beside a picture and several are under 40 characters ("Interactive
   *  diagram of Qwen2.5-1.5B"), which as a search result description says
   *  almost nothing. This names the technique as well as the subject. */
  readonly description: string;

  /** Public source, when there is one. Feeds `codeRepository` in the page's
   *  JSON-LD, and is the reason a thing can be a `SoftwareSourceCode` rather
   *  than a bare `CreativeWork`.
   *
   *  Separate from `links` even where the two coincide: `links` is display and
   *  holds whatever is worth clicking (a chess.com profile, a paper), and
   *  reading a repository out of it would mean guessing which row is the repo
   *  from its label. */
  readonly repo?: string;
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
    // `llm`, not `transformer`. A transformer is the block; what is drawn here
    // is the whole model, an embedding and 28 of them and the embedding again.
    // The code directories keep the older name (`src/lib/transformer`,
    // `src/components/transformer`) because the subject of almost every file in
    // them really is the block.
    slug: "llm",
    title: "Language Model",
    blurb: "Interactive diagram of Qwen2.5-1.5B",
    description:
      "An interactive drawing of Qwen2.5-1.5B at true scale: every weight's " +
      "on-screen area is its parameter count. Built with Three.js and React Three Fiber.",
    repo: "https://github.com/DanielF21/portfolio",
    shipped: "2026-08-16",
    hue: "indigo",
    poster: {
      src: "/things/llm/poster.png",
      width: 1600,
      height: 1000,
      alt:
        "The Qwen2.5-1.5B plate: a numbered contents rail on the left, 28 dark " +
        "transformer block plates receding along a horizontal orange residual " +
        "stream in the centre, and a detail panel on the right.",
    },
    stage: "immersive",
    // Same reasoning as the planet's: three, R3F and this scene's geometry are
    // far too much to pull onto an index page for decoration.
    preview: "none",
    weight: "heavy",
    // No `feature: false`. It used to be held out of the featured slot until the
    // piece explained itself rather than only labelling itself; the detail panel
    // does that now. Being the newest `shipped` date is the whole qualification,
    // so featuring it takes a deletion rather than a flag.
    tech: ["Three.js", "React Three Fiber", "Qwen2.5"],
  },
  {
    slug: "planet",
    title: "Planet",
    blurb: "A small world you can walk around.",
    description:
      "A walkable low-poly planet in the browser. Moving is rotating a frame " +
      "on a sphere, so it has no poles and no seams. Built with Three.js and WebGL.",
    repo: "https://github.com/DanielF21/portfolio",
    shipped: "2026-08-14",
    hue: "violet",
    poster: {
      src: "/things/planet/poster.png",
      width: 1600,
      height: 1000,
      alt:
        "A low-poly planet against a night sky. Its lit edge shows a green island " +
        "with faceted trees and a wooden windmill, pale beaches, and dark blue " +
        "water curving away over the horizon.",
    },
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
    description:
      "A chess engine that plays the way Daniel Fleming does: a convolutional " +
      "net trained on a million lichess games, fine tuned on his own openings.",
    repo: "https://github.com/DanielF21/Chess-Bot",
    shipped: "2024-09-01",
    hue: "amber",
    poster: {
      src: "/things/chess/poster.png",
      width: 1600,
      height: 1000,
      alt:
        "A white chess knight standing on a wooden board, facing a toppled black " +
        "king.",
    },
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
    description:
      "A Scheme interpreter with a live REPL in the browser. Reader, evaluator " +
      "and environment model written from scratch in Python, behind a Flask API.",
    repo: "https://github.com/DanielF21/Scheme-Interpreter",
    shipped: "2022-12-01",
    hue: "cyan",
    poster: {
      src: "/things/scheme/poster.png",
      width: 1600,
      height: 1000,
      alt:
        "A green-on-black REPL transcript: the input (define pi 3.14) returning " +
        "3.14, then (+ pi pi) returning 6.28, then an empty prompt.",
    },
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

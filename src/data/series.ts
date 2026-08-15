import type { Hue } from "@/data/hues";

/**
 * Writing that comes in parts.
 *
 * A series is a container: it owns the title, the framing and the colour, and
 * its parts live in `content/writing/<slug>/`. The alternative was to infer all
 * of that from part 1's frontmatter, which breaks the first time a part is
 * renumbered or the first part is still a draft.
 *
 * ADDING A SERIES (the whole checklist):
 *   1. one entry below
 *   2. a directory at content/writing/<slug>/
 *   3. optionally content/writing/<slug>/index.mdx for the hub's prose
 *   4. one .mdx per part in that directory, each with `series` and `part` in
 *      its frontmatter
 * No route file, no nav edit, no home page edit.
 *
 * NOTHING here describes parts that do not exist yet. The hub renders exactly
 * the files on disk, so an unfinished series is simply a short one and there is
 * no plan in the codebase to fall out of date.
 *
 * Pure data, no JSX, so this is importable from server components.
 */

/**
 * A piece of a blurb: either plain text or a link.
 *
 * A blurb is a sequence rather than one string because it has to be two things
 * at once. On the page it is markup, so a reference can point at the thing it
 * names. In an OG description and in the `/writing` index it must be flat text:
 * metadata cannot hold an anchor, and the index row is itself a link, so an
 * anchor inside it would nest.
 *
 * The alternatives were storing HTML in a string and injecting it, which gives
 * up the flat form, or hardcoding the link in a component, which puts one
 * series' content inside a component meant to serve all of them.
 */
export type BlurbPart =
  | string
  | { readonly text: string; readonly href: string };

/** The flat form. Use for metadata, and anywhere a link cannot go. */
export function blurbText(blurb: readonly BlurbPart[]): string {
  return blurb.map((part) => (typeof part === "string" ? part : part.text)).join("");
}

export interface Series {
  /** Also the content subdirectory name and the URL segment. */
  readonly slug: string;
  readonly title: string;
  /** A few sentences. Used on the hub, the home card, the writing index, and as
   *  the hub's OG description. */
  readonly blurb: readonly BlurbPart[];
  readonly hue: Hue;
  /** ISO date of the first part. Orders the series against one-off writing. */
  readonly started: string;
  /** Where the work itself lives, if it is public. */
  readonly source?: { readonly label: string; readonly href: string };
}

export const SERIES: readonly Series[] = [
  {
    slug: "inference",
    title: "Building an inference engine",
    blurb: [
      "Every token you have ever seen a model produce came out of an " +
        "inference engine, and almost nobody looks at that layer. I got " +
        "curious after reading ",
      {
        text: "Inference Engineering",
        href: "https://www.baseten.co/inference-engineering/",
      },
      ", and it is a good corner of the stack to be in right now: the " +
        "constraints are real, and the distance between a model that runs and " +
        "a model that runs well is enormous. I learn by building, so I am " +
        "building one. The code is on GitHub.",
    ],
    hue: "teal",
    started: "2026-08-08",
    source: {
      label: "github.com/DanielF21/inference",
      href: "https://github.com/DanielF21/inference",
    },
  },
];

export function seriesBySlug(slug: string): Series | undefined {
  return SERIES.find((s) => s.slug === slug);
}

export function isSeriesSlug(slug: string): boolean {
  return SERIES.some((s) => s.slug === slug);
}

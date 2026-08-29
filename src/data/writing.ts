import { cache } from "react";

import {
  type Doc,
  type DocSummary,
  getDoc,
  listDocs,
  subdirsIn,
} from "@/data/mdx";
import { isSeriesSlug, SERIES, type Series, seriesBySlug } from "@/data/series";

/**
 * What writing IS, as opposed to how markdown is loaded.
 *
 * Two kinds live under content/writing:
 *
 *   content/writing/<slug>.mdx            a one-off
 *   content/writing/<series>/<part>.mdx   a part of a series
 *   content/writing/<series>/index.mdx    the series hub's prose
 *
 * They stay disjoint by construction rather than by filtering: one-offs are the
 * files at the top level, parts are the files one directory down. Nothing here
 * ever scans recursively.
 *
 * Nothing in this module knows about parts that have not been written. A series
 * is exactly as long as its directory, so an unfinished series is simply a
 * short one and there is no plan anywhere to fall out of date.
 */

const WRITING_DIR = "content/writing";

/** The hub's prose. Named so it cannot collide with a part slug in the UI. */
const HUB_FILE = "index";

export interface Part extends DocSummary {
  series: Series;
}

/** A series and the parts that exist for it, in order. */
export interface SeriesWithParts {
  series: Series;
  parts: Part[];
  /** Supporting documents with no place in the sequence. */
  appendices: Part[];
  /** Most recent part's publishedAt, or the series' own start when it has no
   *  parts yet. Orders a series against one-off writing. */
  latest: string;
}

function published(doc: DocSummary) {
  return !doc.metadata.draft;
}

/**
 * Parts are ordered by `part`, NOT by date.
 *
 * The chain is the point: each engine's analysis closes with a prediction that
 * the next one tests. Sorting by publishedAt would reorder the argument if a
 * part were ever revised and re-dated.
 */
function byPart(a: DocSummary, b: DocSummary) {
  const pa = a.metadata.part ?? Number.MAX_SAFE_INTEGER;
  const pb = b.metadata.part ?? Number.MAX_SAFE_INTEGER;
  if (pa !== pb) return pa - pb;
  return (a.metadata.publishedAt ?? "").localeCompare(b.metadata.publishedAt ?? "");
}

function byNewest(a: DocSummary, b: DocSummary) {
  return (b.metadata.publishedAt ?? "").localeCompare(a.metadata.publishedAt ?? "");
}

/**
 * Fail loudly, naming the file.
 *
 * These are authoring mistakes made while pasting, each with exactly one
 * correct fix, and each of which otherwise shows up as a silently missing or
 * mis-sorted article weeks later. Throwing means the first `pnpm dev` after the
 * paste says what is wrong.
 */
function assertSeriesDoc(seriesSlug: string, doc: DocSummary) {
  const at = `content/writing/${seriesSlug}/${doc.slug}.mdx`;

  if (!doc.metadata.title) {
    throw new Error(`${at}: frontmatter is missing \`title\`.`);
  }
  if (!doc.metadata.publishedAt) {
    throw new Error(`${at}: frontmatter is missing \`publishedAt\`.`);
  }
  if (doc.metadata.series && doc.metadata.series !== seriesSlug) {
    throw new Error(
      `${at}: frontmatter says \`series: ${doc.metadata.series}\` but the file ` +
        `sits in ${seriesSlug}/. The directory is authoritative, so either move ` +
        `the file or fix the frontmatter.`
    );
  }
}

/** One-off articles: the .mdx files at the top level of content/writing. */
export const oneOffs = cache(async (): Promise<DocSummary[]> => {
  const docs = await listDocs(WRITING_DIR);

  for (const doc of docs) {
    if (isSeriesSlug(doc.slug)) {
      throw new Error(
        `content/writing/${doc.slug}.mdx collides with the series directory ` +
          `content/writing/${doc.slug}/. /writing/${doc.slug} resolves to the ` +
          `series hub, so this article would be unreachable. Rename one of them.`
      );
    }
  }

  return docs.filter(published).sort(byNewest);
});

export const getOneOff = (slug: string): Promise<Doc | null> =>
  isSeriesSlug(slug)
    ? Promise.resolve(null)
    : getDoc(WRITING_DIR, slug);

/**
 * Every document in a series directory except the hub, validated.
 *
 * A NUMBERED document is a part. An unnumbered one is an appendix: supporting
 * material that the parts link to and that has no place in the sequence. The
 * FLOP derivation behind the MFU table is the example. Distinguishing them by
 * the presence of `part` rather than by a second frontmatter flag keeps one
 * source of truth: if it has a number it is in the chain, if it does not it is
 * not.
 */
const seriesDocs = cache(async (seriesSlug: string): Promise<Part[]> => {
  const series = seriesBySlug(seriesSlug);
  if (!series) return [];

  const docs = (await listDocs(WRITING_DIR, seriesSlug)).filter(
    (d) => d.slug !== HUB_FILE
  );

  for (const doc of docs) assertSeriesDoc(seriesSlug, doc);

  return docs.filter(published).map((doc) => ({ ...doc, series }));
});

/** Published parts of one series, in order. */
export const seriesParts = cache(async (seriesSlug: string): Promise<Part[]> => {
  const docs = await seriesDocs(seriesSlug);
  return docs.filter((d) => typeof d.metadata.part === "number").sort(byPart);
});

/** Published supporting documents, alphabetical by title. */
export const seriesAppendices = cache(
  async (seriesSlug: string): Promise<Part[]> => {
    const docs = await seriesDocs(seriesSlug);
    return docs
      .filter((d) => typeof d.metadata.part !== "number")
      .sort((a, b) => a.metadata.title.localeCompare(b.metadata.title));
  }
);

/** The compiled body of one part. */
export const getPart = (seriesSlug: string, partSlug: string) =>
  partSlug === HUB_FILE
    ? Promise.resolve(null)
    : getDoc(WRITING_DIR, seriesSlug, partSlug);

/** The hub's prose, if it has been written. Optional: a hub works from the
 *  registry and the parts alone. */
export const getSeriesIntro = (seriesSlug: string) =>
  getDoc(WRITING_DIR, seriesSlug, HUB_FILE);

/** Every series that has a content directory, with its parts. */
export const allSeries = cache(async (): Promise<SeriesWithParts[]> => {
  const present = new Set(subdirsIn(WRITING_DIR));

  const withParts = await Promise.all(
    SERIES.filter((s) => present.has(s.slug)).map(async (series) => {
      const [parts, appendices] = await Promise.all([
        seriesParts(series.slug),
        seriesAppendices(series.slug),
      ]);
      return {
        series,
        parts,
        appendices,
        latest: parts.length
          ? parts.reduce(
              (newest, p) =>
                p.metadata.publishedAt > newest ? p.metadata.publishedAt : newest,
              parts[0].metadata.publishedAt
            )
          : series.started,
      };
    })
  );

  return withParts.sort((a, b) => b.latest.localeCompare(a.latest));
});

/** The series to feature on the home page: the most recently active one that
 *  has something to show. */
export async function featuredSeries(): Promise<SeriesWithParts | undefined> {
  return (await allSeries()).find((s) => s.parts.length > 0);
}

/** What comes before and after a part, within the published ones. Either side
 *  is undefined at the ends, and the UI renders nothing there rather than a
 *  disabled control: there is no promise that a next part exists. */
export async function neighbours(seriesSlug: string, partSlug: string) {
  const parts = await seriesParts(seriesSlug);
  const i = parts.findIndex((p) => p.slug === partSlug);

  // One shape either way. `index` is -1 for an appendix, which is in the series
  // but not in the sequence, and the caller shows no position and no pager.
  return {
    index: i,
    total: parts.length,
    previous: i > 0 ? parts[i - 1] : undefined,
    next: i !== -1 ? parts[i + 1] : undefined,
  };
}

/** When a document last changed: its revision date if it has been revised,
 *  otherwise the day it was published. Never the build date. */
export function lastChanged(doc: DocSummary): string {
  return doc.metadata.updatedAt ?? doc.metadata.publishedAt;
}

/** Everything with a URL under /writing. For the sitemap. */
export async function writingUrls() {
  const [singles, series] = await Promise.all([oneOffs(), allSeries()]);

  return [
    ...singles.map((d) => ({
      url: `/writing/${d.slug}`,
      lastModified: lastChanged(d),
    })),
    ...series.flatMap((s) => [
      {
        url: `/writing/${s.series.slug}`,
        // A hub changes when any of its documents does, appendices included:
        // the hub lists them, so a revised appendix changes the hub's page.
        lastModified: [...s.parts, ...s.appendices]
          .map(lastChanged)
          .reduce((a, b) => (b > a ? b : a), s.latest),
      },
      ...[...s.parts, ...s.appendices].map((p) => ({
        url: `/writing/${s.series.slug}/${p.slug}`,
        lastModified: lastChanged(p),
      })),
    ]),
  ];
}

/**
 * The most recent date on any piece of writing.
 *
 * The `/writing` index and the home page both list writing and nothing else
 * about them changes on its own, so this is honestly their `lastmod`. The
 * alternative the sitemap used to run, `new Date()`, told crawlers all four
 * static routes changed on every deploy.
 */
export async function latestWritingDate(): Promise<string> {
  const urls = await writingUrls();
  return urls.reduce((a, u) => (u.lastModified > a ? u.lastModified : a), "");
}

/** Every part and appendix of every series, hubs first, in reading order.
 *  What `/llms-full.txt` concatenates. */
export async function readingOrder(): Promise<
  { series: Series; hub: boolean; doc?: Part }[]
> {
  const series = await allSeries();
  return series.flatMap((s) => [
    { series: s.series, hub: true },
    ...s.parts.map((doc) => ({ series: s.series, hub: false, doc })),
    ...s.appendices.map((doc) => ({ series: s.series, hub: false, doc })),
  ]);
}

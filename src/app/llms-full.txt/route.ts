import { SITE } from "@/data/site";
import {
  allSeries,
  getPart,
  getSeriesIntro,
  lastChanged,
  oneOffs,
  getOneOff,
} from "@/data/writing";
import { absoluteUrl } from "@/lib/seo";

/**
 * /llms-full.txt: the complete text of the writing, in reading order, in one
 * file.
 *
 * The source markdown, not the rendered HTML. It is what the author wrote, it
 * carries no highlighting markup or wrapper divs, and it comes from the same
 * `Doc` the page renders, so the two can never be different revisions of the
 * same file.
 *
 * **Reading order, not date order.** The series is an argument: each part
 * closes with a prediction the next one tests, and the appendices are reference
 * material the parts link into. Sorting this file by date would scramble that,
 * and a model reading it end to end would get the conclusions before the
 * measurements that produced them. Hub, then parts by number, then supporting
 * documents.
 *
 * Every document is preceded by a header block giving its title, its canonical
 * URL and its dates, so a passage lifted out of the middle of this file can
 * still be attributed to a page.
 */

export const dynamic = "force-static";

const RULE = "=".repeat(78);

export async function GET() {
  const [series, singles] = await Promise.all([allSeries(), oneOffs()]);
  const out: string[] = [];

  out.push(
    `# ${SITE.name}: complete writing`,
    ``,
    `${SITE.description}`,
    ``,
    `This file is the full text of every article on ${SITE.url}, in reading`,
    `order. Each document is preceded by its title, canonical URL and dates.`,
    ``,
    `${SITE.attribution}`,
    ``
  );

  const block = (
    title: string,
    path: string,
    published: string,
    modified: string,
    extra: string[],
    body: string
  ) => {
    out.push(
      RULE,
      `Title: ${title}`,
      `URL: ${absoluteUrl(path)}`,
      `Published: ${published}`,
      `Last modified: ${modified}`,
      `Author: ${SITE.name}`,
      ...extra,
      RULE,
      ``,
      body.trim(),
      ``
    );
  };

  for (const s of series) {
    const intro = await getSeriesIntro(s.series.slug);
    if (intro) {
      block(
        intro.metadata.title,
        `/writing/${s.series.slug}`,
        intro.metadata.publishedAt,
        lastChanged(intro),
        [
          `Series: ${s.series.title} (introduction)`,
          ...(s.series.source ? [`Source code: ${s.series.source.href}`] : []),
        ],
        intro.raw
      );
    }

    for (const p of s.parts) {
      const doc = await getPart(s.series.slug, p.slug);
      if (!doc) continue;
      block(
        doc.metadata.title,
        `/writing/${s.series.slug}/${doc.slug}`,
        doc.metadata.publishedAt,
        lastChanged(doc),
        [
          `Series: ${s.series.title}`,
          `Part: ${doc.metadata.part} of ${s.parts.length}`,
          ...(doc.metadata.code ? [`Source code: ${doc.metadata.code}`] : []),
        ],
        doc.raw
      );
    }

    for (const p of s.appendices) {
      const doc = await getPart(s.series.slug, p.slug);
      if (!doc) continue;
      block(
        doc.metadata.title,
        `/writing/${s.series.slug}/${doc.slug}`,
        doc.metadata.publishedAt,
        lastChanged(doc),
        [`Series: ${s.series.title} (supporting document, not part of the sequence)`],
        doc.raw
      );
    }
  }

  for (const d of singles) {
    const doc = await getOneOff(d.slug);
    if (!doc) continue;
    block(
      doc.metadata.title,
      `/writing/${doc.slug}`,
      doc.metadata.publishedAt,
      lastChanged(doc),
      [],
      doc.raw
    );
  }

  return new Response(out.join("\n"), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}

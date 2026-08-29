import { SITE } from "@/data/site";
import { seriesBySlug } from "@/data/series";
import {
  getOneOff,
  getPart,
  getSeriesIntro,
  lastChanged,
} from "@/data/writing";
import { absoluteUrl } from "@/lib/seo";

/**
 * The markdown behind a writing URL, served at that URL plus ".md".
 *
 * `/writing/inference/paged.md` returns the source of the page at
 * `/writing/inference/paged`, with a short header block naming the document,
 * its canonical HTML URL and its dates.
 *
 * **Why the path does not end in .md in this file.** `.md` cannot be part of a
 * dynamic segment: `[part]` would capture "paged.md" and the segment validator
 * in `mdx.ts` rejects the dot, which is the correct behaviour and should stay.
 * So `next.config.mjs` rewrites the public `.md` URL onto this handler, which
 * takes the same segments the page does. The rewrite is the only place the
 * extension is spelled, and this handler stays a plain path.
 *
 * The header block matters as much as the body. A markdown file with no URL in
 * it is a quotation with no source, and the whole point of serving this is that
 * a passage taken from it can be attributed back to a page.
 */

interface Params {
  params: { path: string[] };
}

const notFound = () =>
  new Response("Not found\n", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });

export async function GET(_request: Request, { params }: Params) {
  const segments = params.path ?? [];
  if (segments.length === 0 || segments.length > 2) return notFound();

  const [slug, part] = segments;
  const series = seriesBySlug(slug);

  // Resolved in the same order the page is: series first, then a one-off, so
  // the markdown and the HTML can never resolve to different documents.
  const doc = series
    ? part
      ? await getPart(slug, part)
      : await getSeriesIntro(slug)
    : part
      ? null
      : await getOneOff(slug);

  if (!doc) return notFound();

  const path = part ? `/writing/${slug}/${part}` : `/writing/${slug}`;
  const header = [
    `<!--`,
    `Title: ${doc.metadata.title}`,
    `Author: ${SITE.name}`,
    `Canonical URL: ${absoluteUrl(path)}`,
    `Published: ${doc.metadata.publishedAt}`,
    `Last modified: ${lastChanged(doc)}`,
    ...(series ? [`Series: ${series.title}`] : []),
    ...(doc.metadata.part ? [`Part: ${doc.metadata.part}`] : []),
    ...(doc.metadata.code ? [`Source code: ${doc.metadata.code}`] : []),
    ``,
    SITE.attribution,
    `-->`,
    ``,
    `# ${doc.metadata.title}`,
    ``,
    ``,
  ].join("\n");

  return new Response(`${header}${doc.raw.trim()}\n`, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
      // Points a consumer at the page this text came from, for anything reading
      // headers rather than the comment block above.
      link: `<${absoluteUrl(path)}>; rel="canonical"`,
    },
  });
}

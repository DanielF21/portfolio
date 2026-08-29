import { SERIES } from "@/data/series";
import { SITE } from "@/data/site";
import { allSeries, lastChanged, oneOffs } from "@/data/writing";
import { absoluteUrl } from "@/lib/seo";

/**
 * RSS 2.0 for everything under /writing.
 *
 * A route handler rather than a static file, for the same reason the sitemap is
 * generated: a feed maintained by hand is a feed that is one post behind.
 *
 * **Series parts are items, series hubs are not.** A hub is an index and its
 * content is the list of parts, so publishing it as an item would push a
 * duplicate into every subscriber's reader every time a part shipped. Feed
 * items are things to read.
 *
 * Ordered by date, newest first, which is the one ordering a reader expects
 * even though the series itself reads in part order.
 */

export const dynamic = "force-static";

/** The five characters that are not legal as text in XML. `&` first, or it
 *  double-escapes the ampersands the others introduce. */
function xml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** RFC 822, which is what RSS 2.0 requires. The frontmatter dates are ISO
 *  calendar days with no time, so they land at midnight UTC. */
function rfc822(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toUTCString();
}

export async function GET() {
  const [series, singles] = await Promise.all([allSeries(), oneOffs()]);

  const items = [
    ...singles.map((doc) => ({
      title: doc.metadata.title,
      path: `/writing/${doc.slug}`,
      date: doc.metadata.publishedAt,
      updated: lastChanged(doc),
      description: doc.metadata.description ?? doc.metadata.summary ?? "",
      category: "Writing",
    })),
    ...series.flatMap((s) =>
      [...s.parts, ...s.appendices].map((doc) => ({
        title: doc.metadata.title,
        path: `/writing/${s.series.slug}/${doc.slug}`,
        date: doc.metadata.publishedAt,
        updated: lastChanged(doc),
        description: doc.metadata.description ?? doc.metadata.summary ?? "",
        category: s.series.title,
      }))
    ),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const newest = items[0]?.updated;

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xml(`${SITE.name}: writing`)}</title>
    <link>${absoluteUrl("/writing")}</link>
    <description>${xml(SERIES[0]?.description ?? SITE.description)}</description>
    <language>en-us</language>
    <managingEditor>${xml(SITE.name)}</managingEditor>
    <copyright>${xml(SITE.attribution)}</copyright>
    <atom:link href="${absoluteUrl("/rss.xml")}" rel="self" type="application/rss+xml"/>
${newest ? `    <lastBuildDate>${rfc822(newest)}</lastBuildDate>\n` : ""}${items
    .map(
      (item) => `    <item>
      <title>${xml(item.title)}</title>
      <link>${absoluteUrl(item.path)}</link>
      <guid isPermaLink="true">${absoluteUrl(item.path)}</guid>
      <pubDate>${rfc822(item.date)}</pubDate>
      <category>${xml(item.category)}</category>
      <description>${xml(item.description)}</description>
    </item>`
    )
    .join("\n")}
  </channel>
</rss>
`;

  return new Response(body, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}

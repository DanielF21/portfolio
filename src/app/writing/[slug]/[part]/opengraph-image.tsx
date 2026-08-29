import { SERIES, seriesBySlug } from "@/data/series";
import { getPart, seriesAppendices, seriesParts } from "@/data/writing";
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/og";

/**
 * A card for one part of a series, or one of its supporting documents.
 *
 * The kicker is the series title and the corner carries "Part N", which is the
 * one piece of context a shared link otherwise loses: a title like "One forward
 * per step" says nothing on its own in a feed.
 */
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export async function generateStaticParams() {
  const perSeries = await Promise.all(
    SERIES.map(async (series) => {
      const [parts, appendices] = await Promise.all([
        seriesParts(series.slug),
        seriesAppendices(series.slug),
      ]);
      return [...parts, ...appendices].map((doc) => ({
        slug: series.slug,
        part: doc.slug,
      }));
    })
  );

  return perSeries.flat();
}

export default async function Image({
  params,
}: {
  params: { slug: string; part: string };
}) {
  const series = seriesBySlug(params.slug);
  const doc = series ? await getPart(params.slug, params.part) : null;

  return ogImage({
    title: doc?.metadata.title ?? series?.title ?? "Writing",
    kicker: series?.title,
    meta: doc?.metadata.part
      ? `Part ${doc.metadata.part}`
      : doc?.metadata.publishedAt,
  });
}

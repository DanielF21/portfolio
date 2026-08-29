import { SERIES, seriesBySlug } from "@/data/series";
import { getOneOff, oneOffs } from "@/data/writing";
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/og";

/**
 * A card for a series hub or a one-off article.
 *
 * Same branch as the page: series first, then a one-off, so the card and the
 * page can never describe different documents.
 *
 * `generateStaticParams` is exported here as well as on the page. An image file
 * in a dynamic segment needs to know which params to draw at build time, and
 * relying on the page's copy makes this file's output depend on a sibling.
 */
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export async function generateStaticParams() {
  const singles = await oneOffs();
  return [
    ...singles.map((doc) => ({ slug: doc.slug })),
    ...SERIES.map((series) => ({ slug: series.slug })),
  ];
}

export default async function Image({
  params,
}: {
  params: { slug: string };
}) {
  const series = seriesBySlug(params.slug);

  if (series) {
    return ogImage({
      title: series.title,
      kicker: "Series",
      meta: "danielfleming.xyz/writing",
    });
  }

  const post = await getOneOff(params.slug);
  return ogImage({
    title: post?.metadata.title ?? "Writing",
    kicker: "Writing",
    meta: post?.metadata.publishedAt,
  });
}

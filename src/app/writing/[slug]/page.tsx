import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/json-ld";
import { Container } from "@/components/layout/container";
import { ArticleBody } from "@/components/writing/article-body";
import { SeriesHub } from "@/components/writing/series-hub";
import { SERIES, seriesBySlug } from "@/data/series";
import { SITE } from "@/data/site";
import {
  getOneOff,
  getSeriesIntro,
  lastChanged,
  oneOffs,
  seriesAppendices,
  seriesParts,
} from "@/data/writing";
import {
  blogPostingSchema,
  breadcrumbSchema,
  graph,
  seriesSchema,
} from "@/lib/schema";
import { pageMetadata } from "@/lib/seo";
import { formatDate } from "@/lib/utils";

/**
 * Two things live at this depth: a series hub and a one-off article.
 *
 * They cannot be sibling route segments. Next refuses two differently named
 * dynamic segments at the same position, so `[slug]` and `[series]` cannot
 * coexist and the branch has to happen inside one file either way. Doing it
 * here rather than in a `[...path]` catch-all keeps `params` narrowly typed and
 * keeps depth 3 out of this file entirely.
 *
 * The series is resolved FIRST. A one-off whose filename collides with a series
 * directory would be unreachable rather than ambiguous, and `oneOffs()` throws
 * on exactly that case so it never ships.
 */

export async function generateStaticParams() {
  const singles = await oneOffs();
  return [
    ...singles.map((doc) => ({ slug: doc.slug })),
    ...SERIES.map((series) => ({ slug: series.slug })),
  ];
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const series = seriesBySlug(params.slug);

  if (series) {
    return pageMetadata({
      path: `/writing/${series.slug}`,
      title: series.title,
      // The registry's `description`, not `blurbText(blurb)`. The blurb is
      // display prose written to sit beside the title; this one is written to
      // the length a search result shows and names the model and the hardware.
      description: series.description,
      // A hub is an index, not an article.
      type: "website",
    });
  }

  const post = await getOneOff(params.slug);
  if (!post) return {};

  const { title, publishedAt, summary, description, image } = post.metadata;
  return pageMetadata({
    path: `/writing/${post.slug}`,
    title,
    description: description ?? summary ?? SITE.description,
    type: "article",
    publishedTime: publishedAt,
    modifiedTime: lastChanged(post),
    ...(image ? { images: [image] } : {}),
  });
}

export default async function WritingSlugPage({
  params,
}: {
  params: { slug: string };
}) {
  const series = seriesBySlug(params.slug);

  if (series) {
    const [parts, appendices, intro] = await Promise.all([
      seriesParts(series.slug),
      seriesAppendices(series.slug),
      getSeriesIntro(series.slug),
    ]);

    return (
      <>
        <JsonLd
          json={graph(
            seriesSchema(series, parts),
            breadcrumbSchema([
              { name: "Daniel Fleming", path: "/" },
              { name: "Writing", path: "/writing" },
              { name: series.title, path: `/writing/${series.slug}` },
            ])
          )}
        />
        <SeriesHub
          series={series}
          parts={parts}
          appendices={appendices}
          latest={parts[0]?.metadata.publishedAt ?? series.started}
          intro={intro}
        />
      </>
    );
  }

  // getOneOff returns null for a missing file rather than throwing, so an
  // unknown slug is a 404 rather than the 500 the old blog produced.
  const post = await getOneOff(params.slug);
  if (!post) notFound();

  return (
    <Container as="article" width="page" className="py-block">
      <JsonLd
        json={graph(
          blogPostingSchema({
            doc: post,
            path: `/writing/${post.slug}`,
            section: "Writing",
          }),
          breadcrumbSchema([
            { name: "Daniel Fleming", path: "/" },
            { name: "Writing", path: "/writing" },
            { name: post.metadata.title, path: `/writing/${post.slug}` },
          ])
        )}
      />

      <header className="max-w-measure">
        <Link
          href="/writing"
          className="font-mono text-meta text-muted-foreground transition-colors hover:text-foreground"
        >
          &larr; writing
        </Link>

        <h1 className="mt-3 font-display text-page font-bold">
          {post.metadata.title}
        </h1>

        <p className="mb-8 mt-2 font-mono text-meta text-muted-foreground">
          {formatDate(post.metadata.publishedAt)}
        </p>
      </header>

      <ArticleBody source={post.source} headings={post.headings} />
    </Container>
  );
}

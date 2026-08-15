import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { ArticleBody } from "@/components/writing/article-body";
import { SeriesHub } from "@/components/writing/series-hub";
import { blurbText, SERIES, seriesBySlug } from "@/data/series";
import { SITE } from "@/data/site";
import {
  getOneOff,
  getSeriesIntro,
  oneOffs,
  seriesAppendices,
  seriesParts,
} from "@/data/writing";
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
    const url = `${SITE.url}/writing/${series.slug}`;
    // Metadata cannot hold markup, so the blurb goes in flat.
    const description = blurbText(series.blurb);
    return {
      title: series.title,
      description,
      alternates: { canonical: url },
      // A hub is an index, not an article.
      openGraph: {
        title: series.title,
        description,
        type: "website",
        url,
      },
      twitter: {
        card: "summary",
        title: series.title,
        description,
      },
    };
  }

  const post = await getOneOff(params.slug);
  if (!post) return {};

  const { title, publishedAt, summary, image } = post.metadata;
  return {
    title,
    description: summary,
    alternates: { canonical: `${SITE.url}/writing/${post.slug}` },
    openGraph: {
      title,
      description: summary,
      type: "article",
      publishedTime: publishedAt,
      url: `${SITE.url}/writing/${post.slug}`,
      // No fallback to a /og route: there isn't one, which is why every article
      // on the old site had a broken share image.
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description: summary,
      ...(image ? { images: [image] } : {}),
    },
  };
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
      <SeriesHub
        series={series}
        parts={parts}
        appendices={appendices}
        latest={parts[0]?.metadata.publishedAt ?? series.started}
        intro={intro}
      />
    );
  }

  // getOneOff returns null for a missing file rather than throwing, so an
  // unknown slug is a 404 rather than the 500 the old blog produced.
  const post = await getOneOff(params.slug);
  if (!post) notFound();

  return (
    <Container as="article" width="page" className="py-block">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.metadata.title,
            datePublished: post.metadata.publishedAt,
            dateModified: post.metadata.publishedAt,
            description: post.metadata.summary,
            ...(post.metadata.image
              ? { image: `${SITE.url}${post.metadata.image}` }
              : {}),
            url: `${SITE.url}/writing/${post.slug}`,
            author: { "@type": "Person", name: SITE.name },
          }),
        }}
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

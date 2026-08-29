import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/json-ld";
import { Container } from "@/components/layout/container";
import { ArticleBody } from "@/components/writing/article-body";
import { PartNav } from "@/components/writing/part-nav";
import { hueStyle } from "@/data/hues";
import { SERIES, seriesBySlug } from "@/data/series";
import {
  getPart,
  lastChanged,
  neighbours,
  seriesAppendices,
  seriesParts,
} from "@/data/writing";
import {
  blogPostingSchema,
  breadcrumbSchema,
  graph,
} from "@/lib/schema";
import { pageMetadata } from "@/lib/seo";
import { formatDate } from "@/lib/utils";

/**
 * One part of a series, or one of its supporting documents.
 *
 * "Part N of M" takes M from the parts that exist. It will read "of 2" today
 * and "of 6" later, and that is the honest behaviour: the page states what has
 * been published, never what is planned.
 */

interface Params {
  slug: string;
  part: string;
}

/** A GitHub tree URL reads better as the path it points at:
 *  `.../tree/main/infer/engines/naive` becomes `infer/engines/naive`. */
function codeLabel(href: string) {
  return (
    href.match(/\/tree\/[^/]+\/(.+?)\/?$/)?.[1] ??
    href.replace(/^https?:\/\//, "").replace(/\/$/, "")
  );
}

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

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const series = seriesBySlug(params.slug);
  const doc = series ? await getPart(params.slug, params.part) : null;
  if (!series || !doc) return {};

  const { title, summary, description, publishedAt, image } = doc.metadata;

  return pageMetadata({
    path: `/writing/${series.slug}/${doc.slug}`,
    title,
    // `description` is written to fit a search result; `summary` is editorial
    // and several are over 250 characters. Prefer the one that will not be
    // truncated, and fall back rather than leave a page with none.
    description: description ?? summary ?? series.description,
    type: "article",
    publishedTime: publishedAt,
    modifiedTime: lastChanged(doc),
    // No fallback image here: the segment's `opengraph-image` route generates
    // one for every part, and naming an image in the metadata would override it.
    ...(image ? { images: [image] } : {}),
  });
}

export default async function PartPage({ params }: { params: Params }) {
  const series = seriesBySlug(params.slug);
  if (!series) notFound();

  const doc = await getPart(params.slug, params.part);
  if (!doc) notFound();

  const { index, total, previous, next } = await neighbours(
    params.slug,
    params.part
  );
  const inSequence = index !== -1;
  // A part points at its own code; anything without one falls back to the
  // series' repository, so the link is never missing and never guessed.
  const code = doc.metadata.code ?? series.source?.href;

  return (
    <Container as="main" width="page" className="py-block" >
      <div style={hueStyle(series.hue)}>
        <JsonLd
          json={graph(
            blogPostingSchema({
              doc,
              path: `/writing/${series.slug}/${doc.slug}`,
              section: series.title,
              series,
            }),
            breadcrumbSchema([
              { name: "Daniel Fleming", path: "/" },
              { name: "Writing", path: "/writing" },
              { name: series.title, path: `/writing/${series.slug}` },
              {
                name: doc.metadata.title,
                path: `/writing/${series.slug}/${doc.slug}`,
              },
            ])
          )}
        />

        <header className="mb-8 max-w-measure">
          {/* Two levels, now that the URL is three deep. A bare "back to
              writing" would skip the series, which is the level a reader of
              part 2 actually wants. */}
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center gap-x-2 font-mono text-meta text-muted-foreground"
          >
            <Link href="/writing" className="transition-colors hover:text-foreground">
              writing
            </Link>
            <span aria-hidden>/</span>
            <Link
              href={`/writing/${series.slug}`}
              className="transition-colors hover:text-foreground"
            >
              {series.title}
            </Link>
          </nav>

          <h1 className="mt-3 font-display text-page font-bold">
            {doc.metadata.title}
          </h1>

          <p className="mt-2 flex flex-wrap items-center gap-x-3 font-mono text-meta text-muted-foreground">
            <span>{formatDate(doc.metadata.publishedAt)}</span>
            {inSequence && (
              <>
                <span aria-hidden>&middot;</span>
                <span>
                  Part {index + 1} of {total}
                </span>
              </>
            )}
          </p>

          {/* The analyses talk about the code constantly, so the code is one
              click away from the byline rather than only from the hub. */}
          {code && (
            <a
              href={code}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-block font-mono text-meta text-muted-foreground underline decoration-thing underline-offset-4 transition-colors hover:text-foreground"
            >
              {codeLabel(code)}
            </a>
          )}
        </header>

        <ArticleBody source={doc.source} headings={doc.headings} />

        <div className="max-w-measure">
          <PartNav previous={previous} next={next} />
        </div>
      </div>
    </Container>
  );
}

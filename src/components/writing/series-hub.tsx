import Link from "next/link";

import { Container } from "@/components/layout/container";
import { ArticleBody } from "@/components/writing/article-body";
import { Blurb } from "@/components/writing/blurb";
import { AppendixList, PartList } from "@/components/writing/part-list";
import { hueStyle } from "@/data/hues";
import type { Doc } from "@/data/mdx";
import type { SeriesWithParts } from "@/data/writing";

/**
 * A series' front door: what it is, what has been written, and how it is all
 * measured.
 *
 * The parts come BEFORE the methodology. The methodology is what makes the
 * parts legible, but it runs to a couple of hundred lines, and a reader who
 * arrived wanting part 2 should not have to scroll past the whole of it to find
 * the link. The prose sits under its own heading below, where anyone who wants
 * the ground rules can still find them.
 *
 * `intro` is optional. A series with no index.mdx renders from the registry and
 * its parts alone, so the hub works from the first part published.
 */
export function SeriesHub({
  series,
  parts,
  appendices,
  intro,
}: SeriesWithParts & { intro: Doc | null }) {
  return (
    <Container as="main" width="page" className="py-block">
      <div style={hueStyle(series.hue)}>
        <header className="max-w-measure">
          <Link
            href="/writing"
            className="font-mono text-meta text-muted-foreground transition-colors hover:text-foreground"
          >
            &larr; writing
          </Link>

          <h1 className="mt-3 flex items-center gap-3 font-display text-page font-bold">
            <span className="size-3 shrink-0 rounded-full bg-thing" aria-hidden />
            {series.title}
          </h1>

          <Blurb
            parts={series.blurb}
            className="mt-3 text-lead text-muted-foreground"
          />

          {series.source && (
            <a
              href={series.source.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block font-mono text-meta underline decoration-thing underline-offset-4"
            >
              {series.source.label}
            </a>
          )}
        </header>

        <section className="mt-10 max-w-measure" aria-labelledby="parts-heading">
          <h2
            id="parts-heading"
            className="font-mono text-meta uppercase tracking-widest text-muted-foreground"
          >
            {parts.length === 1 ? "1 part" : `${parts.length} parts`}
          </h2>
          <PartList parts={parts} className="mt-3" />
        </section>

        {appendices.length > 0 && (
          <section
            className="mt-10 max-w-measure"
            aria-labelledby="appendices-heading"
          >
            <h2
              id="appendices-heading"
              className="font-mono text-meta uppercase tracking-widest text-muted-foreground"
            >
              Supporting
            </h2>
            <AppendixList parts={appendices} className="mt-2" />
          </section>
        )}

        {intro && (
          <section className="mt-block" aria-labelledby="method-heading">
            <h2
              id="method-heading"
              className="max-w-measure border-t border-border/60 pt-8 font-mono text-meta uppercase tracking-widest text-muted-foreground"
            >
              Method
            </h2>
            <ArticleBody
              source={intro.source}
              headings={intro.headings}
              className="mt-6"
            />
          </section>
        )}
      </div>
    </Container>
  );
}

import Link from "next/link";

import { Container } from "@/components/layout/container";
import { ArticleBody } from "@/components/writing/article-body";
import { Blurb } from "@/components/writing/blurb";
import { AppendixList, PartList } from "@/components/writing/part-list";
import { PartNav } from "@/components/writing/part-nav";
import { hueStyle } from "@/data/hues";
import type { Doc } from "@/data/mdx";
import type { SeriesWithParts } from "@/data/writing";

/**
 * A series' front door: what it is, what has been written, and how it is all
 * measured.
 *
 * The introduction comes BEFORE the parts. It used to be the other way
 * around, on the theory that a reader who already wanted part 2 shouldn't
 * have to scroll past the introduction to find it. In practice almost no one
 * reaches part 2 that way: finishing part 1 already ends in a "Part 2 &rarr;"
 * link (`PartNav`, from the per-part page) that never touches this page at
 * all. The hub is overwhelmingly a first visit, and a first-time reader who
 * sees the parts list immediately, right under the header, treats it as the
 * thing to click and never scrolls down to the introduction that explains
 * what the numbers in it mean.
 *
 * The introduction ends with a `PartNav` pointing at `parts[0]`, so a reader
 * who scrolls through it top to bottom lands on the same "Part 1 &rarr;"
 * affordance every other part ends with, rather than a dead end. The parts
 * list (and the divider above it) sits below, for anyone who came back
 * already knowing what they want.
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

        {intro && (
          <section className="mt-10" aria-labelledby="intro-heading">
            <h2
              id="intro-heading"
              className="max-w-measure font-mono text-meta uppercase tracking-widest text-muted-foreground"
            >
              Introduction
            </h2>
            <ArticleBody
              source={intro.source}
              headings={intro.headings}
              className="mt-6"
            />
            {parts.length > 0 && (
              <div className="max-w-measure">
                <PartNav next={parts[0]} />
              </div>
            )}
          </section>
        )}

        <section
          className={intro ? "mt-block max-w-measure" : "mt-10 max-w-measure"}
          aria-labelledby="parts-heading"
        >
          <h2
            id="parts-heading"
            className={
              intro
                ? "border-t border-border/60 pt-8 font-mono text-meta uppercase tracking-widest text-muted-foreground"
                : "font-mono text-meta uppercase tracking-widest text-muted-foreground"
            }
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
      </div>
    </Container>
  );
}

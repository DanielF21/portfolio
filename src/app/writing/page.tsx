import Link from "next/link";

import { Container } from "@/components/layout/container";
import { blurbText } from "@/data/series";
import { hueStyle } from "@/data/hues";
import { allSeries, oneOffs } from "@/data/writing";
import { formatDate, revealDelay } from "@/lib/utils";

export const metadata = {
  title: "Writing",
  description: "Long-form writing, one-offs and series.",
};

/**
 * The index, holding two shapes at once.
 *
 * A series is ONE row here, not an expanded list of its parts. This page's job
 * is to show what there is to read at a glance, and a series that unrolled its
 * parts inline would outweigh every one-off beside it and grow without limit as
 * the series does. The parts are one click away, on the hub, which is the page
 * built to present them.
 *
 * So both kinds share a row: a title, a line about it, and one piece of
 * metadata on the right. A series shows its part count and carries its hue as a
 * dot; a one-off shows its date. Nothing else distinguishes them.
 *
 * Ordering is by latest activity: a series sorts on its most recent part, a
 * one-off on its own date, and the two interleave.
 */
export default async function WritingPage() {
  const [series, singles] = await Promise.all([allSeries(), oneOffs()]);

  const entries = [
    ...series.map((s) => ({ kind: "series" as const, at: s.latest, data: s })),
    ...singles.map((d) => ({
      kind: "single" as const,
      at: d.metadata.publishedAt,
      data: d,
    })),
  ].sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));

  return (
    <Container as="main" width="measure" className="flex flex-col gap-8 py-block">
      <header className="reveal" style={revealDelay(0)}>
        <h1 className="font-display text-page font-bold">Writing</h1>
      </header>

      {entries.length === 0 ? (
        <p className="reveal text-lead text-muted-foreground" style={revealDelay(1)}>
          Nothing here yet.
        </p>
      ) : (
        <div className="reveal -mx-3 flex flex-col" style={revealDelay(1)}>
          {entries.map((entry) => {
            const isSeries = entry.kind === "series";
            const href = isSeries
              ? `/writing/${entry.data.series.slug}`
              : `/writing/${entry.data.slug}`;

            return (
              <Link
                key={href}
                href={href}
                style={isSeries ? hueStyle(entry.data.series.hue) : undefined}
                className="flex flex-col gap-1 rounded-xl px-3 py-4 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
              >
                <span className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <span className="font-display text-title font-bold">
                    {isSeries && (
                      <span
                        className="mr-2.5 inline-block size-2.5 rounded-full bg-thing align-middle"
                        aria-hidden
                      />
                    )}
                    {isSeries
                      ? entry.data.series.title
                      : entry.data.metadata.title}
                  </span>
                  <span className="font-mono text-meta text-muted-foreground">
                    {isSeries
                      ? entry.data.parts.length === 1
                        ? "1 part"
                        : `${entry.data.parts.length} parts`
                      : formatDate(entry.data.metadata.publishedAt)}
                  </span>
                </span>

                {/* Flat text, not <Blurb>: this row IS a link, and an anchor
                    inside an anchor is invalid. */}
                <span className="text-body text-muted-foreground">
                  {isSeries
                    ? blurbText(entry.data.series.blurb)
                    : entry.data.metadata.summary}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </Container>
  );
}

import Link from "next/link";

import { type Hue, hueStyle } from "@/data/hues";
import type { DocSummary } from "@/data/mdx";
import { blurbText } from "@/data/series";
import type { SeriesWithParts } from "@/data/writing";
import { readingTime } from "@/lib/utils";

/**
 * A series, at full size, for the home page.
 *
 * Used to render a `PartList` here, so a first-time visitor could jump
 * straight to the newest part without ever seeing the introduction that
 * explains what the numbers mean. Removed: this card's only destination now
 * is the hub (`/writing/<slug>`), which shows the introduction and leads
 * forward into part 1.
 *
 * With no per-part links left inside it, the whole card is one `<Link>`, the
 * same shape as `FeaturedThing` (rounded-2xl, bg-card, ring-1,
 * `hover:border-thing`). It stays a separate component rather than merging
 * with `FeaturedThing` because the header (hue dot, part count) and the
 * blurb are specific to a series; a `variant` prop would cost more than the
 * duplication it saves for two call sites.
 *
 * Flat text via `blurbText`, not `<Blurb>`: this card IS a link, and an
 * anchor inside an anchor is invalid (same rule the `/writing` index row
 * follows).
 *
 * The part count is `parts.length`, computed. There is no count in the registry
 * and no placeholder for parts that are not written: the series is exactly as
 * long as what exists, and grows when something is published.
 */
export function SeriesCard({ series, parts }: SeriesWithParts) {
  return (
    <WritingCard
      href={`/writing/${series.slug}`}
      hue={series.hue}
      title={series.title}
      meta={parts.length === 1 ? "1 part" : `${parts.length} parts`}
      blurb={blurbText(series.blurb)}
    />
  );
}

/** What a one-off falls back to when its frontmatter names no hue. */
export const ONE_OFF_HUE: Hue = "slate";

/**
 * A one-off article, at the same size as a series.
 *
 * It used to be a bare row under the series card: no border, no dot, a smaller
 * title and nothing on the right, so it read as a footnote to the series
 * rather than as a second thing to read. The two differ only in what the right
 * hand side counts, parts for a series and minutes for an article.
 */
export function ArticleCard({ doc }: { doc: DocSummary }) {
  return (
    <WritingCard
      href={`/writing/${doc.slug}`}
      hue={doc.metadata.hue ?? ONE_OFF_HUE}
      title={doc.metadata.title}
      meta={readingTime(doc.wordCount)}
      blurb={doc.metadata.summary}
    />
  );
}

function WritingCard({
  href,
  hue,
  title,
  meta,
  blurb,
}: {
  href: string;
  hue: Hue;
  title: string;
  meta: string;
  blurb?: string;
}) {
  return (
    <Link
      href={href}
      style={hueStyle(hue)}
      className="group block rounded-2xl border-2 border-transparent bg-card p-5 ring-1 ring-border transition-colors hover:border-thing focus-visible:border-thing focus-visible:outline-none sm:p-6"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-display text-section font-bold">
          <span
            className="mr-3 inline-block size-2.5 rounded-full bg-thing align-middle"
            aria-hidden
          />
          {title}
        </h3>
        <span className="ml-auto font-mono text-meta text-muted-foreground transition-colors group-hover:text-thing">
          {meta}
        </span>
      </div>

      {blurb && (
        <p className="mt-2 max-w-measure text-lead text-muted-foreground">
          {blurb}
        </p>
      )}
    </Link>
  );
}

import Link from "next/link";

import { Blurb } from "@/components/writing/blurb";
import { PartList } from "@/components/writing/part-list";
import { hueStyle } from "@/data/hues";
import type { SeriesWithParts } from "@/data/writing";

/**
 * A series, at full size, for the home page.
 *
 * It shares a surface with `FeaturedThing` (rounded-2xl, bg-card, ring-1) and
 * deliberately does NOT share its code. FeaturedThing wraps the whole card in a
 * single `<Link>`; this card contains a list of part links, so it cannot be one
 * without nesting anchors, which is invalid HTML. Unifying them would mean a
 * component with a `variant` prop and two mutually exclusive bodies for two
 * call sites. The genuinely shared thing is `PartList`, and that is shared.
 *
 * For the same reason there is no `hover:border-thing` here: with many links
 * inside, there is no single target for a whole-card hover to describe. The hue
 * shows up as the dot beside the title and on each row's own hover instead.
 *
 * The part count is `parts.length`, computed. There is no count in the registry
 * and no placeholder for parts that are not written: the series is exactly as
 * long as what exists, and grows when something is published.
 */
export function SeriesCard({ series, parts }: SeriesWithParts) {
  return (
    <section
      style={hueStyle(series.hue)}
      className="rounded-2xl bg-card p-5 ring-1 ring-border sm:p-6"
      aria-labelledby={`series-${series.slug}`}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 id={`series-${series.slug}`} className="font-display text-section font-bold">
          <Link
            href={`/writing/${series.slug}`}
            className="transition-colors hover:text-thing focus-visible:text-thing focus-visible:outline-none"
          >
            <span
              className="mr-3 inline-block size-2.5 rounded-full bg-thing align-middle"
              aria-hidden
            />
            {series.title}
          </Link>
        </h3>
        <span className="ml-auto font-mono text-meta text-muted-foreground">
          {parts.length === 1 ? "1 part" : `${parts.length} parts`}
        </span>
      </div>

      <Blurb
        parts={series.blurb}
        className="mt-2 max-w-measure text-lead text-muted-foreground"
      />

      <PartList parts={parts} className="mt-5" />
    </section>
  );
}

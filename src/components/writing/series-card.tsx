import Link from "next/link";

import { hueStyle } from "@/data/hues";
import { blurbText } from "@/data/series";
import type { SeriesWithParts } from "@/data/writing";

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
    <Link
      href={`/writing/${series.slug}`}
      style={hueStyle(series.hue)}
      className="group block rounded-2xl border-2 border-transparent bg-card p-5 ring-1 ring-border transition-colors hover:border-thing focus-visible:border-thing focus-visible:outline-none sm:p-6"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-display text-section font-bold">
          <span
            className="mr-3 inline-block size-2.5 rounded-full bg-thing align-middle"
            aria-hidden
          />
          {series.title}
        </h3>
        <span className="ml-auto font-mono text-meta text-muted-foreground transition-colors group-hover:text-thing">
          {parts.length === 1 ? "1 part" : `${parts.length} parts`}
        </span>
      </div>

      <p className="mt-2 max-w-measure text-lead text-muted-foreground">
        {blurbText(series.blurb)}
      </p>
    </Link>
  );
}

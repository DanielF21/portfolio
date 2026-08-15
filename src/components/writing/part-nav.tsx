import Link from "next/link";

import type { Part } from "@/data/writing";

/**
 * Previous and next within a series.
 *
 * At the end of the series the right hand side renders NOTHING: no disabled
 * control, no "next part coming soon". There is no promise that another part
 * exists, and a greyed-out affordance is that promise in disguise.
 */
export function PartNav({
  previous,
  next,
}: {
  previous?: Part;
  next?: Part;
}) {
  if (!previous && !next) return null;

  return (
    <nav
      aria-label="Series"
      className="mt-block grid gap-6 border-t border-border/60 pt-6 sm:grid-cols-2"
    >
      {previous ? (
        <Link
          href={`/writing/${previous.series.slug}/${previous.slug}`}
          className="group -mx-3 rounded-xl px-3 py-2 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
        >
          <span className="font-mono text-meta text-muted-foreground">
            &larr; Part {previous.metadata.part}
          </span>
          <span className="mt-1 block font-display text-title font-bold">
            {previous.metadata.title}
          </span>
        </Link>
      ) : (
        <span />
      )}

      {next && (
        <Link
          href={`/writing/${next.series.slug}/${next.slug}`}
          className="group -mx-3 rounded-xl px-3 py-2 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none sm:text-right"
        >
          <span className="font-mono text-meta text-muted-foreground">
            Part {next.metadata.part} &rarr;
          </span>
          <span className="mt-1 block font-display text-title font-bold">
            {next.metadata.title}
          </span>
        </Link>
      )}
    </nav>
  );
}

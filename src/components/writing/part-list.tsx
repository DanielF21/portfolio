import Link from "next/link";

import type { Part } from "@/data/writing";
import { cn } from "@/lib/utils";

/**
 * The ordered parts of a series.
 *
 * A real `<ol>`, because the sequence is the substance: each part closes with a
 * prediction the next one tests, so "these are in an order" is information a
 * screen reader should be given rather than a visual accident of the numbers.
 *
 * Used on the series hub's parts section, and nowhere else. The home page
 * card used to render this too; it was removed so a first-time visitor could
 * not skip the introduction from the home page (see `series-card.tsx`). The
 * hub's introduction ends with `PartNav`, not another `PartList`: a reader who
 * just read the introduction wants the next part, not the whole list again.
 *
 * The number is `padStart(2)` so a two digit part does not shift the titles.
 */
export function PartList({
  parts,
  className,
}: {
  parts: Part[];
  className?: string;
}) {
  if (parts.length === 0) return null;

  return (
    <ol className={cn("-mx-3 flex list-none flex-col", className)}>
      {parts.map((part) => (
        <li key={part.slug}>
          <Link
            href={`/writing/${part.series.slug}/${part.slug}`}
            className={cn(
              "group flex items-baseline gap-3 rounded-xl px-3 py-2.5 transition-colors",
              "hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
            )}
          >
            <span className="font-mono text-meta tabular-nums text-muted-foreground">
              {String(part.metadata.part).padStart(2, "0")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="font-display text-title font-bold">
                {part.metadata.title}
              </span>
              {part.metadata.result && (
                <span className="mt-0.5 block truncate text-body text-muted-foreground">
                  {part.metadata.result}
                </span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

/**
 * Supporting documents. Deliberately quieter than the parts: they are reference
 * material the parts link into, not steps in the argument, so they get no
 * number and no result line.
 */
export function AppendixList({
  parts,
  className,
}: {
  parts: Part[];
  className?: string;
}) {
  if (parts.length === 0) return null;

  return (
    <ul className={cn("-mx-3 flex list-none flex-col", className)}>
      {parts.map((part) => (
        <li key={part.slug}>
          <Link
            href={`/writing/${part.series.slug}/${part.slug}`}
            className={cn(
              "block rounded-xl px-3 py-2 text-body text-muted-foreground transition-colors",
              "hover:bg-muted/60 hover:text-foreground",
              "focus-visible:bg-muted/60 focus-visible:outline-none"
            )}
          >
            {part.metadata.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}

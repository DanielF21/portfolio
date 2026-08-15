import type { Heading } from "@/data/mdx";
import { cn } from "@/lib/utils";

/**
 * The prose column, with contents alongside it on wide screens.
 *
 * On the width question: this sits inside `Container width="page"` and puts the
 * prose in a `max-w-measure` grid track rather than using
 * `Container width="measure"`. That is the arrangement container.tsx itself
 * prescribes ("`full`/`page` plus a grid inside it, not a fourth width"), and
 * `/things/[slug]` already does the same. The prose keeps its 44rem measure and
 * its left edge, and the contents rail lives in slack that a measure container
 * would simply have thrown away.
 *
 * No scrollspy. Highlighting the current section needs a client component and
 * an IntersectionObserver on an otherwise entirely static article, and it is
 * the classic thing that misbehaves against a sticky header. The document is
 * navigable without it.
 */

const MIN_HEADINGS = 4;

/** h2 and h3 only. Deeper levels make the rail longer than the argument. */
export function tocItems(headings: Heading[]): Heading[] {
  const items = headings.filter((h) => h.depth === 2 || h.depth === 3);
  return items.length >= MIN_HEADINGS ? items : [];
}

function Toc({ items, className }: { items: Heading[]; className?: string }) {
  return (
    <nav aria-label="Contents" className={className}>
      <p className="font-mono text-meta uppercase tracking-widest text-muted-foreground">
        Contents
      </p>
      <ol className="mt-3 flex list-none flex-col gap-2 border-l border-border">
        {items.map((h) => (
          <li key={h.id} className={h.depth === 3 ? "pl-7" : "pl-4"}>
            <a
              href={`#${h.id}`}
              className="block text-meta text-muted-foreground transition-colors hover:text-foreground"
            >
              {h.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function ArticleBody({
  source,
  headings,
  className,
}: {
  source: string;
  headings: Heading[];
  className?: string;
}) {
  const items = tocItems(headings);

  return (
    <div className={className}>
      {items.length > 0 && (
        <details className="mb-8 rounded-xl border border-border/60 p-4 lg:hidden">
          <summary className="cursor-pointer font-mono text-meta uppercase tracking-widest text-muted-foreground">
            Contents
          </summary>
          <Toc items={items} className="mt-4 [&>p]:sr-only" />
        </details>
      )}

      <div
        className={cn(
          "lg:grid lg:items-start lg:gap-12",
          items.length > 0 && "lg:grid-cols-[minmax(0,44rem)_1fr]"
        )}
      >
        <div
          className="prose max-w-measure dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: source }}
        />

        {items.length > 0 && (
          <aside className="hidden lg:block">
            <Toc items={items} className="sticky top-20" />
          </aside>
        )}
      </div>
    </div>
  );
}

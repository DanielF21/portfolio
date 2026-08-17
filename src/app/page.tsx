import { Briefcase, GraduationCap, MapPin } from "lucide-react";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { LiveBudgetProvider } from "@/components/things/live-budget-provider";
import { FeaturedThing, ThingRow } from "@/components/things/thing-tile";
import { SeriesCard } from "@/components/writing/series-card";
import { SITE } from "@/data/site";
import { featuredThing, restOfThings } from "@/data/things";
import { allSeries, oneOffs } from "@/data/writing";
import { revealDelay } from "@/lib/utils";

/**
 * Home: a short statement, the writing, then the things.
 *
 * Writing sits above Things, and the newest series gets a card at full size
 * rather than three loose rows at the bottom of the page. The two sections are
 * deliberately in different registers: a series is one body of work with an
 * order, so it shows its parts; the toys are individually interesting, so they
 * show pictures.
 *
 * Server component. The only client code on this page is the preview layer
 * inside each thing tile, which is lazy and only wakes on demand.
 */

/**
 * WRITING IS TEMPORARILY HIDDEN, here and in `NAV` in `data/site.ts`. Those two
 * are the whole of it.
 *
 * Nothing was deleted: `/writing` and every document under it still build, still
 * render and are still in the sitemap, so any link already pointing at one keeps
 * working. This only takes the section off the home page. A flag rather than a
 * commented out block, because the block reads `series`, `singles` and
 * `writingCount`, and commenting it out would leave those computed and unused,
 * which lint would rightly complain about. Flip this to `true` and uncomment the
 * one line in `NAV` to put it all back.
 */
const SHOW_WRITING = false;
export default async function Page() {
  const featured = featuredThing();
  const rest = restOfThings();
  const [series, singles] = await Promise.all([allSeries(), oneOffs()]);

  const featuredSeries = series.find((s) => s.parts.length > 0);

  // Things to read, not rows in an index. Counting index entries would say
  // "all 1" next to a card that visibly lists two parts. Supporting documents
  // are left out: they are reference material the parts link into.
  const writingCount =
    singles.length + series.reduce((n, s) => n + s.parts.length, 0);

  return (
    <LiveBudgetProvider>
      <Container as="main" width="page" className="flex flex-col gap-block py-block">
        <header className="max-w-measure">
          <h1
            className="reveal font-display text-display font-bold"
            style={revealDelay(0)}
          >
            {SITE.name}
          </h1>
          {/* Education, occupation, location, in that order. A list rather
              than a sentence: three unrelated facts, and a screen reader should
              hear them as three. Wraps rather than truncates on narrow screens,
              which is why the row gap exists. */}
          <ul
            className="reveal mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-lead text-muted-foreground"
            style={revealDelay(1)}
          >
            <li className="flex items-center gap-1.5">
              <GraduationCap className="size-[1em] shrink-0" aria-hidden />
              MIT
            </li>
            <li className="flex items-center gap-1.5">
              <Briefcase className="size-[1em] shrink-0" aria-hidden />
              Engineer
            </li>
            <li className="flex items-center gap-1.5">
              <MapPin className="size-[1em] shrink-0" aria-hidden />
              San Francisco, CA
            </li>
          </ul>
        </header>

        {SHOW_WRITING && writingCount > 0 && (
          <section aria-labelledby="writing-heading" className="flex flex-col gap-6">
            <div className="flex items-baseline justify-between gap-4">
              <h2
                id="writing-heading"
                className="font-mono text-meta uppercase tracking-widest text-muted-foreground"
              >
                Writing
              </h2>
              <Link
                href="/writing"
                className="font-mono text-meta text-muted-foreground transition-colors hover:text-foreground"
              >
                all {writingCount} &rarr;
              </Link>
            </div>

            {featuredSeries && (
              <div className="reveal" style={revealDelay(2)}>
                <SeriesCard {...featuredSeries} />
              </div>
            )}

            {singles.length > 0 && (
              <div className="reveal -mx-3 flex flex-col" style={revealDelay(3)}>
                {singles.slice(0, 3).map((doc) => (
                  <Link
                    key={doc.slug}
                    href={`/writing/${doc.slug}`}
                    className="flex flex-col gap-0.5 rounded-xl px-3 py-3 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                  >
                    <span className="font-display text-title font-bold">
                      {doc.metadata.title}
                    </span>
                    {doc.metadata.summary && (
                      <span className="text-body text-muted-foreground">
                        {doc.metadata.summary}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        <section aria-labelledby="things-heading" className="flex flex-col gap-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2
              id="things-heading"
              className="font-mono text-meta uppercase tracking-widest text-muted-foreground"
            >
              Things
            </h2>
            <Link
              href="/things"
              className="font-mono text-meta text-muted-foreground transition-colors hover:text-foreground"
            >
              all {1 + rest.length} &rarr;
            </Link>
          </div>

          {featured && (
            <div className="reveal" style={revealDelay(4)}>
              <FeaturedThing thing={featured} />
            </div>
          )}

          {rest.length > 0 && (
            <div className="reveal -mx-3 flex flex-col" style={revealDelay(5)}>
              {rest.map((thing) => (
                <ThingRow key={thing.slug} thing={thing} />
              ))}
            </div>
          )}
        </section>
      </Container>
    </LiveBudgetProvider>
  );
}

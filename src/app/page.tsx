import { MapPin } from "lucide-react";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { LiveBudgetProvider } from "@/components/things/live-budget-provider";
import { FeaturedThing, ThingRow } from "@/components/things/thing-tile";
import { getWriting } from "@/data/mdx";
import { SITE } from "@/data/site";
import { featuredThing, restOfThings } from "@/data/things";
import { revealDelay } from "@/lib/utils";

/**
 * Home: a short statement, the newest thing at full size, then everything else
 * as compact rows.
 *
 * Server component. The only client code on this page is the preview layer
 * inside each tile, which is lazy and only wakes on demand.
 */
export default async function Page() {
  const featured = featuredThing();
  const rest = restOfThings();
  const writing = await getWriting();

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
          <p
            className="reveal mt-4 flex items-center gap-1.5 text-lead text-muted-foreground"
            style={revealDelay(1)}
          >
            <MapPin className="size-[1em] shrink-0" aria-hidden />
            San Francisco, CA
          </p>
        </header>

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
            <div className="reveal" style={revealDelay(2)}>
              <FeaturedThing thing={featured} />
            </div>
          )}

          {rest.length > 0 && (
            <div className="reveal -mx-3 flex flex-col" style={revealDelay(3)}>
              {rest.map((thing) => (
                <ThingRow key={thing.slug} thing={thing} />
              ))}
            </div>
          )}
        </section>

        {writing.length > 0 && (
          <section aria-labelledby="writing-heading" className="flex flex-col gap-4">
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
                all {writing.length} &rarr;
              </Link>
            </div>
            <div className="flex flex-col">
              {writing.slice(0, 3).map((doc) => (
                <Link
                  key={doc.slug}
                  href={`/writing/${doc.slug}`}
                  className="-mx-3 flex flex-col gap-0.5 rounded-xl px-3 py-3 transition-colors hover:bg-muted/60"
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
          </section>
        )}
      </Container>
    </LiveBudgetProvider>
  );
}

import type { Metadata } from "next";

import { JsonLd } from "@/components/json-ld";
import { Container } from "@/components/layout/container";
import { LiveBudgetProvider } from "@/components/things/live-budget-provider";
import { ThingRow } from "@/components/things/thing-tile";
import { things } from "@/data/things";
import { breadcrumbSchema, graph } from "@/lib/schema";
import { pageMetadata } from "@/lib/seo";
import { revealDelay } from "@/lib/utils";

export const metadata: Metadata = pageMetadata({
  path: "/things",
  title: "Things",
  description:
    "Interactive things Daniel Fleming has built: a to-scale diagram of " +
    "Qwen2.5-1.5B, a walkable planet, a chess net, and a Scheme REPL you can type into.",
});

/**
 * The full index. Uniform rows, no featured slot: the home page is where one
 * thing gets to be big. This page's job is to stay readable at thirty.
 */
export default function ThingsPage() {
  const all = things();

  return (
    <LiveBudgetProvider>
      <Container as="main" width="page" className="flex flex-col gap-8 py-block">
        <JsonLd
          json={graph(
            breadcrumbSchema([
              { name: "Daniel Fleming", path: "/" },
              { name: "Things", path: "/things" },
            ])
          )}
        />

        <header>
          <h1
            className="reveal font-display text-page font-bold"
            style={revealDelay(0)}
          >
            Things
          </h1>
        </header>

        <div className="reveal -mx-3 flex flex-col" style={revealDelay(2)}>
          {all.map((thing) => (
            <ThingRow key={thing.slug} thing={thing} />
          ))}
        </div>
      </Container>
    </LiveBudgetProvider>
  );
}

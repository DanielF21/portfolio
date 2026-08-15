import { Container } from "@/components/layout/container";
import { LiveBudgetProvider } from "@/components/things/live-budget-provider";
import { ThingRow } from "@/components/things/thing-tile";
import { things } from "@/data/things";
import { revealDelay } from "@/lib/utils";

export const metadata = {
  title: "Things",
  description: "Interactive things I have built.",
};

/**
 * The full index. Uniform rows, no featured slot: the home page is where one
 * thing gets to be big. This page's job is to stay readable at thirty.
 */
export default function ThingsPage() {
  const all = things();

  return (
    <LiveBudgetProvider>
      <Container as="main" width="page" className="flex flex-col gap-8 py-block">
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

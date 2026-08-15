import Link from "next/link";

import { ThingPreview } from "@/components/things/thing-preview";
import { hueStyle, type Thing } from "@/data/things";
import { cn } from "@/lib/utils";

/**
 * The two shapes a thing takes on an index.
 *
 * The whole design has to hold at 3 things and at 30, which is why there is
 * exactly one large tile and everything else is a row. Shipping a new toy
 * rotates the feature and lengthens the list; the layout never changes shape.
 *
 * Colour discipline: a thing's hue appears on the featured tile's edge, on the
 * row's dot, and on hover. Never as a fill behind text, never as a gradient.
 */

export function FeaturedThing({ thing }: { thing: Thing }) {
  return (
    <Link
      href={`/things/${thing.slug}`}
      style={hueStyle(thing.hue)}
      className="group block rounded-2xl border-2 border-transparent bg-card ring-1 ring-border transition-colors hover:border-thing focus-visible:border-thing focus-visible:outline-none"
    >
      <ThingPreview
        thing={thing}
        placement="featured"
        priority
        sizes="(max-width: 768px) 100vw, 1024px"
        className="aspect-[16/10] rounded-t-2xl"
      />
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2 p-5">
        <h2 className="font-display text-section font-bold">{thing.title}</h2>
        <span className="ml-auto font-mono text-meta text-muted-foreground transition-colors group-hover:text-thing">
          open &rarr;
        </span>
        <p className="w-full text-lead text-muted-foreground">{thing.blurb}</p>
      </div>
    </Link>
  );
}

export function ThingRow({ thing }: { thing: Thing }) {
  return (
    <Link
      href={`/things/${thing.slug}`}
      style={hueStyle(thing.hue)}
      className={cn(
        "group flex items-center gap-4 rounded-xl px-3 py-3 transition-colors",
        "hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
      )}
    >
      <span className="size-2.5 shrink-0 rounded-full bg-thing" aria-hidden />

      <ThingPreview
        thing={thing}
        placement="row"
        sizes="120px"
        className="hidden aspect-[16/10] w-24 shrink-0 rounded-md sm:block"
      />

      <span className="min-w-0 flex-1">
        <span className="font-display text-title font-bold">{thing.title}</span>
        <span className="mt-0.5 block truncate text-body text-muted-foreground">
          {thing.blurb}
        </span>
      </span>
    </Link>
  );
}

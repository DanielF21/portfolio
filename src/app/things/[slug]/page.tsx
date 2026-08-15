import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { ThingStage } from "@/components/things/thing-stage";
import { getThingNotes } from "@/data/mdx";
import { hueStyle, THINGS, thingBySlug } from "@/data/things";
import { revealDelay } from "@/lib/utils";

export function generateStaticParams() {
  return THINGS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const thing = thingBySlug(params.slug);
  if (!thing) return {};

  return {
    title: thing.title,
    description: thing.blurb,
    openGraph: {
      title: thing.title,
      description: thing.blurb,
      type: "article",
      // Each thing's poster is its social image. The site previously pointed
      // every share card at a /og route that does not exist.
      images: [{ url: thing.poster.src }],
    },
    twitter: {
      card: "summary_large_image",
      title: thing.title,
      description: thing.blurb,
      images: [thing.poster.src],
    },
  };
}

export default async function ThingPage({
  params,
}: {
  params: { slug: string };
}) {
  const thing = thingBySlug(params.slug);
  if (!thing) notFound();

  const notes = await getThingNotes(thing.slug);

  return (
    <Container
      as="main"
      width="page"
      className="flex flex-col gap-8 py-block"
      // Publishes this thing's hue to the subtree.
      // eslint-disable-next-line react/no-unknown-property
    >
      <div style={hueStyle(thing.hue)} className="flex flex-col gap-8">
        <header className="reveal max-w-measure" style={revealDelay(0)}>
          <Link
            href="/things"
            className="font-mono text-meta text-muted-foreground transition-colors hover:text-foreground"
          >
            &larr; things
          </Link>
          <h1 className="mt-3 flex items-center gap-3 font-display text-page font-bold">
            <span className="size-3 rounded-full bg-thing" aria-hidden />
            {thing.title}
          </h1>
          <p className="mt-3 text-lead text-muted-foreground">{thing.blurb}</p>

          {(thing.tech?.length || thing.links?.length) && (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              {thing.tech?.map((t) => (
                <span key={t} className="font-mono text-meta text-muted-foreground">
                  {t}
                </span>
              ))}
              {thing.links?.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-meta underline decoration-thing underline-offset-4"
                >
                  {l.label}
                </a>
              ))}
            </div>
          )}
        </header>

        <div className="reveal" style={revealDelay(1)}>
          <ThingStage thing={thing} />
        </div>

        {notes && (
          <article
            className="reveal prose max-w-measure dark:prose-invert"
            style={revealDelay(2)}
            dangerouslySetInnerHTML={{ __html: notes.source }}
          />
        )}
      </div>
    </Container>
  );
}

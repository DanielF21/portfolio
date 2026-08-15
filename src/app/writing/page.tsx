import Link from "next/link";

import { Container } from "@/components/layout/container";
import { getWriting } from "@/data/mdx";
import { formatDate, revealDelay } from "@/lib/utils";

export const metadata = {
  title: "Writing",
  description: "Occasional long-form writing.",
};

/**
 * A tiny index, on purpose.
 *
 * Writing here is rare and substantial rather than a regular blog, so this page
 * is built to look correct holding two pieces, not two hundred. The header does
 * not link here while the directory is empty (see hasWriting in data/mdx.ts),
 * but the route always exists so nothing 404s and the door stays open.
 */
export default async function WritingPage() {
  const posts = await getWriting();

  return (
    <Container as="main" width="measure" className="flex flex-col gap-8 py-block">
      <header className="reveal" style={revealDelay(0)}>
        <h1 className="font-display text-page font-bold">Writing</h1>
      </header>

      {posts.length === 0 ? (
        <p className="reveal text-lead text-muted-foreground" style={revealDelay(1)}>
          Nothing here yet.
        </p>
      ) : (
        <div className="reveal -mx-3 flex flex-col" style={revealDelay(1)}>
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/writing/${post.slug}`}
              className="flex flex-col gap-1 rounded-xl px-3 py-4 transition-colors hover:bg-muted/60"
            >
              <span className="flex flex-wrap items-baseline justify-between gap-x-4">
                <span className="font-display text-title font-bold">
                  {post.metadata.title}
                </span>
                <span className="font-mono text-meta text-muted-foreground">
                  {formatDate(post.metadata.publishedAt)}
                </span>
              </span>
              {post.metadata.summary && (
                <span className="text-body text-muted-foreground">
                  {post.metadata.summary}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </Container>
  );
}

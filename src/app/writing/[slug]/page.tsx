import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Container } from "@/components/layout/container";
import { getWriting, getWritingPost } from "@/data/mdx";
import { SITE } from "@/data/site";
import { formatDate } from "@/lib/utils";

export async function generateStaticParams() {
  const posts = await getWriting();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await getWritingPost(params.slug);
  if (!post) return {};

  const { title, publishedAt, summary, image } = post.metadata;
  return {
    title,
    description: summary,
    openGraph: {
      title,
      description: summary,
      type: "article",
      publishedTime: publishedAt,
      url: `${SITE.url}/writing/${post.slug}`,
      // No fallback to a /og route: there isn't one, which is why every article
      // on the old site had a broken share image.
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description: summary,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function WritingPost({
  params,
}: {
  params: { slug: string };
}) {
  // getWritingPost returns null for a missing file rather than throwing, so an
  // unknown slug is a 404 rather than the 500 the old blog produced.
  const post = await getWritingPost(params.slug);
  if (!post) notFound();

  return (
    <Container as="article" width="measure" className="py-block">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.metadata.title,
            datePublished: post.metadata.publishedAt,
            dateModified: post.metadata.publishedAt,
            description: post.metadata.summary,
            ...(post.metadata.image
              ? { image: `${SITE.url}${post.metadata.image}` }
              : {}),
            url: `${SITE.url}/writing/${post.slug}`,
            author: { "@type": "Person", name: SITE.name },
          }),
        }}
      />

      <Link
        href="/writing"
        className="font-mono text-meta text-muted-foreground transition-colors hover:text-foreground"
      >
        &larr; writing
      </Link>

      <h1 className="mt-3 font-display text-page font-bold">
        {post.metadata.title}
      </h1>

      <Suspense fallback={<p className="h-5" />}>
        <p className="mb-8 mt-2 font-mono text-meta text-muted-foreground">
          {formatDate(post.metadata.publishedAt)}
        </p>
      </Suspense>

      <div
        className="prose max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: post.source }}
      />
    </Container>
  );
}

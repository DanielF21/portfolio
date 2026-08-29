import type { Metadata } from "next";

import { SITE } from "@/data/site";

/**
 * One place that turns a site path into everything the head needs to say about
 * it.
 *
 * Two problems this exists to stop recurring:
 *
 * 1. **A canonical is not optional and was missing from six of the nine route
 *    shapes.** Only the two writing routes set one, so the home page, both
 *    indexes, `/work` and every `/things/<slug>` page named no preferred URL at
 *    all. Going through one helper means a new route cannot ship without one.
 * 2. **`alternates` is replaced wholesale by a child, not merged.** The feed
 *    link therefore cannot live in the root layout's metadata: the moment a
 *    page sets `alternates.canonical` the inherited `types` disappear with it.
 *    Every caller here gets both in the same object, so the feed link survives
 *    on every page.
 */

export const FEED_PATH = "/rss.xml";

/** An absolute URL on the canonical host. Leading slash required, and the root
 *  is the bare origin rather than `https://host/`, so the sitemap and the
 *  canonical agree character for character. */
export function absoluteUrl(path = "/"): string {
  return path === "/" ? SITE.url : `${SITE.url}${path}`;
}

interface PageMeta {
  /** Site path, e.g. "/writing/inference/paged". */
  path: string;
  /** Under 60 characters. Omit on the home page, which sets its own absolute
   *  title, since the template would otherwise print the name twice. */
  title?: string;
  /** 140 to 160 characters. Checked by `scripts/check-meta.mjs`. */
  description: string;
  /** "article" for anything with a publication date, "website" otherwise. */
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  /** Only for pages that carry their own image. Everything else is served by
   *  the generated `opengraph-image` route for its segment. */
  images?: string[];
}

export function pageMetadata({
  path,
  title,
  description,
  type = "website",
  publishedTime,
  modifiedTime,
  images,
}: PageMeta): Metadata {
  const url = absoluteUrl(path);

  return {
    ...(title ? { title } : {}),
    description,
    alternates: {
      canonical: url,
      types: {
        "application/rss+xml": [
          { url: absoluteUrl(FEED_PATH), title: `${SITE.name}: writing` },
        ],
      },
    },
    openGraph: {
      ...(title ? { title } : { title: SITE.name }),
      description,
      url,
      siteName: SITE.name,
      locale: "en_US",
      type,
      ...(publishedTime ? { publishedTime } : {}),
      ...(modifiedTime ? { modifiedTime } : {}),
      ...(images ? { images: images.map((u) => ({ url: u })) } : {}),
    },
    twitter: {
      card: "summary_large_image",
      ...(title ? { title } : { title: SITE.name }),
      description,
      ...(images ? { images } : {}),
    },
  };
}

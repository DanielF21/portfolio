import type { MetadataRoute } from "next";

import { getWriting } from "@/data/mdx";
import { SITE } from "@/data/site";
import { THINGS } from "@/data/things";

/**
 * Generated from the registries, so shipping a thing or a post puts it in the
 * sitemap with no extra step.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getWriting();

  const staticRoutes = ["", "/things", "/writing", "/work"].map((path) => ({
    url: `${SITE.url}${path}`,
    lastModified: new Date(),
  }));

  const thingRoutes = THINGS.map((t) => ({
    url: `${SITE.url}/things/${t.slug}`,
    lastModified: new Date(t.shipped),
  }));

  const writingRoutes = posts.map((p) => ({
    url: `${SITE.url}/writing/${p.slug}`,
    lastModified: new Date(p.metadata.publishedAt),
  }));

  return [...staticRoutes, ...thingRoutes, ...writingRoutes];
}

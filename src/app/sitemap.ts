import type { MetadataRoute } from "next";

import { SITE } from "@/data/site";
import { THINGS } from "@/data/things";
import { writingUrls } from "@/data/writing";

/**
 * Generated from the registries, so shipping a thing or a post puts it in the
 * sitemap with no extra step.
 *
 * Writing URLs come from `writingUrls()` rather than from a flat document list,
 * because a series part lives at /writing/<series>/<part> and a flat listing
 * would emit it at the wrong depth.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const writing = await writingUrls();

  const staticRoutes = ["", "/things", "/writing", "/work"].map((path) => ({
    url: `${SITE.url}${path}`,
    lastModified: new Date(),
  }));

  const thingRoutes = THINGS.map((t) => ({
    url: `${SITE.url}/things/${t.slug}`,
    lastModified: new Date(t.shipped),
  }));

  const writingRoutes = writing.map((w) => ({
    url: `${SITE.url}${w.url}`,
    // `new Date(undefined)` is Invalid Date and Next throws when it serialises
    // one. The frontmatter validator should make that unreachable; this is the
    // cheap insurance.
    lastModified: w.lastModified ? new Date(w.lastModified) : new Date(),
  }));

  return [...staticRoutes, ...thingRoutes, ...writingRoutes];
}

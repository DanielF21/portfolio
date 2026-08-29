import type { MetadataRoute } from "next";

import { THINGS } from "@/data/things";
import { latestWritingDate, writingUrls } from "@/data/writing";
import { absoluteUrl } from "@/lib/seo";

/**
 * Generated from the registries, so shipping a thing or a post puts it in the
 * sitemap with no extra step.
 *
 * Writing URLs come from `writingUrls()` rather than from a flat document list,
 * because a series part lives at /writing/<series>/<part> and a flat listing
 * would emit it at the wrong depth.
 *
 * **`lastModified` is a real content date or it is absent.** Every static route
 * used to carry `new Date()`, which told a crawler that the home page, both
 * indexes and /work all changed on every deploy. A lastmod that is always
 * today is a lastmod that is never believed, and it costs the pages that
 * genuinely did change their signal. So:
 *
 *   - an index page takes the newest date among the things it lists,
 *   - a document takes its own revision date, or its publication date,
 *   - /work, whose content lives in a `.tsx` file, carries NO lastmod at all,
 *     since nothing on disk records when its facts changed and inventing one
 *     is worse than omitting an optional field.
 *
 * Every URL goes through `absoluteUrl`, so the host here can never disagree
 * with the host in the canonical link on the page itself. It used to: both
 * named the apex, which 308-redirects to www.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const writing = await writingUrls();
  const newestWriting = await latestWritingDate();
  const newestThing = THINGS.reduce(
    (a, t) => (t.shipped > a ? t.shipped : a),
    THINGS[0]?.shipped ?? ""
  );

  const home = {
    url: absoluteUrl("/"),
    // The home page lists both collections, so it changes when either does.
    lastModified: new Date(
      newestWriting > newestThing ? newestWriting : newestThing
    ),
  };

  const indexes = [
    { url: absoluteUrl("/writing"), lastModified: new Date(newestWriting) },
    { url: absoluteUrl("/things"), lastModified: new Date(newestThing) },
  ];

  // No lastModified: see the note above.
  const pages = [{ url: absoluteUrl("/work") }];

  const thingRoutes = THINGS.map((t) => ({
    url: absoluteUrl(`/things/${t.slug}`),
    lastModified: new Date(t.shipped),
  }));

  const writingRoutes = writing.map((w) => ({
    url: absoluteUrl(w.url),
    // `new Date(undefined)` is Invalid Date and Next throws when it serialises
    // one. The frontmatter validator should make that unreachable; this is the
    // cheap insurance.
    lastModified: w.lastModified ? new Date(w.lastModified) : undefined,
  }));

  return [home, ...indexes, ...pages, ...thingRoutes, ...writingRoutes];
}

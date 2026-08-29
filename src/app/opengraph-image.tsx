import { SITE } from "@/data/site";
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/og";

/**
 * The site's default card, inherited by every route without one of its own:
 * the home page, both indexes, /work and /about.
 *
 * The `/things/<slug>` pages override it in their metadata with their poster,
 * which is a real screenshot of the piece and says more than a title card can.
 */
export const alt = `${SITE.name}: engineer in San Francisco`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogImage({
    title: "Daniel Fleming",
    kicker: "MIT computer science",
    meta: "Engineer, San Francisco",
  });
}

import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/og";

/**
 * This segment's Open Graph card.
 *
 * It exists as its own file, rather than inheriting `app/opengraph-image.tsx`,
 * because the file convention applies to the segment it sits in and is NOT
 * inherited by nested segments. Without this file the page renders every other
 * `og:` tag and no `og:image` at all, which is the failure it is easiest to
 * ship without noticing: the tag is simply absent rather than wrong.
 */
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogImage({
    title: "Things",
    kicker: "Daniel Fleming",
    meta: "Interactive pieces",
  });
}

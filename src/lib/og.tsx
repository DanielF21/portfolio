import { ImageResponse } from "next/og";

import { SITE } from "@/data/site";

/**
 * The one Open Graph card, drawn at build time.
 *
 * Every writing page on the site used to share NO image: `DocMeta.image` exists
 * but no document sets one, so thirteen articles produced a bare text card. A
 * title on a plain background is not a design achievement, but it is the
 * difference between a link that shows what it is and one that shows nothing.
 *
 * Deliberately austere, and it uses the DEFAULT font rather than loading the
 * three the site uses. Fetching a font file at build time for a 1200x630 PNG
 * adds a network dependency to the build in exchange for a typeface nobody
 * compares side by side with the page. If that stops being true, load
 * Bricolage Grotesque here and nowhere else.
 *
 * `next/og` ships with Next. No new dependency.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/** Ink and field, hardcoded rather than read from `globals.css`.
 *  A CSS custom property means nothing to Satori, which is what renders this. */
const FIELD = "#0d0f12";
const INK = "#f4f4f5";
const MUTED = "#8b8f98";
const RULE = "#2a2e35";

export function ogImage({
  title,
  kicker,
  meta,
}: {
  /** The document's own title. Truncated by line clamp, not by slicing, so a
   *  long one degrades to three lines rather than to a broken word. */
  title: string;
  /** What kind of page this is, e.g. the series title. */
  kicker?: string;
  /** The bottom right corner: a date, a part number. */
  meta?: string;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: FIELD,
          color: INK,
          padding: "72px 80px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {kicker && (
            <div
              style={{
                fontSize: 26,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: MUTED,
              }}
            >
              {kicker}
            </div>
          )}
          <div
            style={{
              fontSize: title.length > 44 ? 68 : 84,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: -1.5,
              // Satori honours the clamp; three lines is what fits above the
              // rule at the larger size.
              display: "block",
              lineClamp: 3,
            }}
          >
            {title}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            borderTop: `1px solid ${RULE}`,
            paddingTop: 28,
            fontSize: 28,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontWeight: 600 }}>{SITE.name}</div>
            <div style={{ color: MUTED, fontSize: 24 }}>
              {SITE.url.replace(/^https?:\/\//, "")}
            </div>
          </div>
          {meta && <div style={{ color: MUTED, fontSize: 24 }}>{meta}</div>}
        </div>
      </div>
    ),
    OG_SIZE
  );
}

import type { BlurbPart } from "@/data/series";

/**
 * A series blurb, with its links live.
 *
 * Only for surfaces that are not themselves a link. The `/writing` index row
 * wraps its whole content in a `<Link>`, so it uses `blurbText` instead: an
 * anchor inside an anchor is invalid, and browsers recover from it by closing
 * the outer one early, which silently breaks the row.
 */
export function Blurb({
  parts,
  className,
}: {
  parts: readonly BlurbPart[];
  className?: string;
}) {
  return (
    <p className={className}>
      {parts.map((part, i) =>
        typeof part === "string" ? (
          part
        ) : (
          <a
            key={i}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-thing underline-offset-4 transition-colors hover:text-foreground"
          >
            {part.text}
          </a>
        )
      )}
    </p>
  );
}

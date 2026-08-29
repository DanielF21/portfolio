/**
 * One `<script type="application/ld+json">`, server rendered.
 *
 * `suppressHydrationWarning` because React re-serialises the string on the
 * client and whitespace differences in a JSON blob are not worth a warning.
 * The content is built in `lib/schema.ts` and is never user input, so
 * `dangerouslySetInnerHTML` here carries no injection surface.
 */
export function JsonLd({ json }: { json: string }) {
  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
